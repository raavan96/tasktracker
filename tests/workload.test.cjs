/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const modules={};function load(name){if(modules[name])return modules[name];const exports={};modules[name]=exports;new Function('exports','require',ts.transpileModule(fs.readFileSync('src/lib/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports,n=>load(n.replace('./','')));return exports;}
const {workloadModel}=load('workload');
const people=[{id:'a',full_name:'Alice',email:'a@example.com'},{id:'b',full_name:'Bob',email:'b@example.com',is_active:false}];
const task=(id,status,ids,due='2026-09-20')=>({id,status,assignee_ids:ids,due_date:due,title:id,project_id:'p',project:{name:'P'}});
test('Shared tasks count once overall and once for each assignee; overdue excludes review and done',()=>{
 const shared=task('shared','in_progress',['a','b']);const data=workloadModel(people,[shared,shared,task('review','in_review',['a']),task('done','done',['b']),task('unassigned','blocked',[])],'2026-09-22');
 assert.deepEqual(data.summary,{pending:3,overdue:2,in_review:1,done:1,blocked:1,unassigned:1});
 assert.equal(data.rows.find(p=>p.id==='a').pending,2);assert.equal(data.rows.find(p=>p.id==='b').pending,1);assert.equal(data.rows.find(p=>p.id==='b').active,false);
 for(const row of data.rows)assert.equal(row.segments.reduce((a,b)=>a+b,0),row.pending);
 assert.equal(data.axisMax,5);
});
test('Drilldown puts overdue first, followed by nearest dates and undated tasks; scale expands',()=>{
 const items=[task('undated','todo',['a'],null),task('review','in_review',['a'],'2026-09-01'),...Array.from({length:13},(_,i)=>task('task'+i,'todo',['a'],'2026-09-21'))];
 const data=workloadModel(people,items,'2026-09-22');assert.equal(data.axisMax,15);assert.equal(data.rows[0].tasks[0].status,'todo');assert.equal(data.rows[0].tasks.at(-1).id,'undated');assert.equal(data.rows[0].overdue,13);
});
test('Empty workspace and unassigned work retain stable zero states',()=>{
 const empty=workloadModel([],[],'2026-09-22');assert.equal(empty.rows[0].id,'unassigned');assert.equal(empty.rows[0].pending,0);assert.equal(empty.axisMax,5);
 const legacy={...task('legacy','todo',undefined),assignee_id:'a'};assert.equal(workloadModel(people,[legacy],'2026-09-22').summary.unassigned,0);
});
