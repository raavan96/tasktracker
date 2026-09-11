import fs from 'node:fs';import {spawn} from 'node:child_process';import assert from 'node:assert/strict';
import {request,actionValue} from './http-client.mjs';
const config=JSON.parse(fs.readFileSync(process.argv[2]||'/tmp/tasktracker-load-run.json','utf8'));
const output=process.argv[3];if(!output)throw new Error('A private output directory is required');fs.mkdirSync(output,{recursive:true,mode:0o700});
const metrics=[],host=[],checks=[],controller=new AbortController();let phase='baseline',monitorBuffer='',failures=0,liveFailures=0;
const monitor=spawn('ssh',['-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','root@168.144.155.51','python3 -u -'],{stdio:['pipe','pipe','ignore']});
monitor.stdin.end(fs.readFileSync(new URL('./monitor.py',import.meta.url)));
monitor.stdout.on('data',data=>{monitorBuffer+=data;let newline;while((newline=monitorBuffer.indexOf('\n'))>=0){const row=JSON.parse(monitorBuffer.slice(0,newline));monitorBuffer=monitorBuffer.slice(newline+1);row.phase=phase;host.push(row);liveFailures=row.liveStatus===200?0:liveFailures+1;if(row.availableMiB<96||row.oomKill>0||liveFailures>=2)controller.abort(new Error('Host safety threshold reached'));}});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function measured(actor,type,path,options={}){
 const start=performance.now();try{const r=await request(actor,path,{...options,signal:controller.signal});metrics.push({phase,actor:actor.id,type,status:r.status,ms:+r.ms.toFixed(2)});return r;}
 catch(e){metrics.push({phase,actor:actor.id,type,status:0,ms:+(performance.now()-start).toFixed(2)});throw e;}
}
async function action(actor,name,args,{denied=false}={}){
 const response=await measured(actor,name,'/dashboard/projects/'+config.project,{action:config.actions[name],args});assert.equal(response.status,200,`${name} HTTP`);const value=actionValue(response.body);
 if(denied)assert.ok(value?.error,`${name} must deny access`);else {assert.ok(!value?.error,`${name}: ${value?.error}`);assert.ok(value&&typeof value==='object',`${name} result`);}return value;
}
const summary=items=>{const xs=items.map(r=>r.ms).sort((a,b)=>a-b);return {count:xs.length,p50:xs[Math.floor(xs.length*.5)],p95:xs[Math.min(xs.length-1,Math.ceil(xs.length*.95)-1)],max:xs.at(-1)};};
let progress;
try{
 await pause(10000);assert.ok(host.length>=3,'Host monitor must be running before load');
 phase='login';console.log('Starting eight simultaneous staging sign-ins.');
 await Promise.all(config.actors.map(async actor=>{const form=new FormData();form.set('email',actor.email);form.set('password',actor.password);const r=await measured(actor,'login','/login',{action:config.actions.signIn,args:[form]});assert.equal(r.status,200);assert.ok(actor.cookie);assert.match(r.redirect||'',/dashboard/);const page=await measured(actor,'dashboard','/dashboard');assert.equal(page.status,200);assert.ok(!page.location);assert.ok(page.body.includes('Temporary eight-session load test'));}));
 fs.writeFileSync(process.argv[2],JSON.stringify(config),{mode:0o600});checks.push('eight concurrent independent logins');console.log('Eight sign-ins passed.');
 phase='access-checks';
 await action(config.actors[2],'getTaskExtras',[config.privateTask,config.privateProject],{denied:true});
 await action(config.actors[1],'updateTaskStatus',[config.actors[1].tasks[0],config.project,'done'],{denied:true});
 await action(config.actors[1],'updateTask',[config.actors[2].tasks[0],config.project,new FormData()],{denied:true});
 checks.push('private task access denied','member cannot approve','member cannot edit another creator task');
 phase='uploads';console.log('Starting eight concurrent 1 MiB uploads.');
 await Promise.all(config.actors.map(async(actor,index)=>{
  const form=new FormData();form.set('file',new File([new Uint8Array(1024*1024).fill(65+index)],`load-${index}.txt`,{type:'text/plain'}));
  await action(actor,'uploadAttachment',[actor.tasks[0],config.project,form]);
  const extras=await action(actor,'getTaskExtras',[actor.tasks[0],config.project]);const file=extras.attachments.find(f=>f.name===`load-${index}.txt`);assert.ok(file);assert.equal(Number(file.size),1048576);
  const r=await measured(actor,'download','/api/attachments/'+file.id);assert.equal(r.status,200);assert.equal(r.body.length,1048576);assert.equal(r.body,String.fromCharCode(65+index).repeat(1048576));
 }));checks.push('eight 1 MiB uploads and exact-content downloads');
 phase='steady';const until=Date.now()+180000;console.log('Starting three-minute paced task/remark/page workload.');
 progress=setInterval(()=>console.log(JSON.stringify({phase,requests:metrics.length,remainingSeconds:Math.max(0,Math.round((until-Date.now())/1000)),availableMiB:host.at(-1)?.availableMiB,stagingMiB:host.at(-1)?.stagingMiB})),30000);
 await Promise.all(config.actors.map(async(actor,index)=>{let round=0;actor.rounds=0;await pause(index*150);while(Date.now()<until&&!controller.signal.aborted){
  const begin=Date.now();const id=actor.tasks[round%4];
  const page=await measured(actor,'project','/dashboard/projects/'+config.project);assert.equal(page.status,200);assert.ok(page.body.includes('Temporary eight-session load test'));
  await action(actor,'updateTaskStatus',[id,config.project,round%2?'in_progress':'blocked']);
  await action(actor,'addComment',[id,config.project,`Synthetic load run ${config.runId}; user ${index+1}; update ${round+1}.`]);
  round++;actor.rounds=round;await pause(Math.max(0,8000-(Date.now()-begin)));
 }}));clearInterval(progress);if(controller.signal.aborted)throw controller.signal.reason;
 checks.push('three-minute eight-session paced workload');
 phase='review';await action(config.actors[1],'updateTaskStatus',[config.actors[1].tasks[0],config.project,'in_review']);await action(config.actors[0],'updateTaskStatus',[config.actors[1].tasks[0],config.project,'done']);checks.push('member review submission and admin approval');
 phase='cooldown';await pause(6000);console.log('Workload completed.');
}catch(error){failures++;controller.abort(error);console.log('TEST FAILED:',error.message);}finally{
 clearInterval(progress);monitor.kill('SIGTERM');fs.writeFileSync(process.argv[2],JSON.stringify(config),{mode:0o600});
 const report={runId:config.runId,checks,failures,host:{samples:host.length,minAvailableMiB:Math.min(...host.map(r=>r.availableMiB)),peakStagingMiB:Math.max(...host.map(r=>r.stagingMiB)),liveFailures:host.filter(r=>r.liveStatus!==200).length,oomKills:Math.max(...host.map(r=>r.oomKill)),baselineLive:summary(host.filter(r=>r.phase==='baseline').map(r=>({ms:r.liveMs}))),loadedLive:summary(host.filter(r=>!['baseline','cooldown'].includes(r.phase)).map(r=>({ms:r.liveMs})))},requests:metrics.length,httpFailures:metrics.filter(r=>r.status!==200).length,latencies:Object.fromEntries([...new Set(metrics.map(r=>r.type))].map(type=>[type,summary(metrics.filter(r=>r.type===type))])),rounds:config.actors.map(a=>a.rounds||0)};
 fs.writeFileSync(output+'/report.json',JSON.stringify(report,null,2));fs.writeFileSync(output+'/requests.json',JSON.stringify(metrics));fs.writeFileSync(output+'/host.json',JSON.stringify(host));console.log(JSON.stringify(report,null,2));if(failures)process.exitCode=1;
}
