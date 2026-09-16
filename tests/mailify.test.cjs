/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test');
const assert=require('node:assert/strict');
test('Mailify test transport preserves provider fields and sends one private recipient',async()=>{
 const {sendMailifyTest,mailifyConfig,MAILIFY_ENDPOINT}=await import('../scripts/email/mailify.mjs');
 const config=mailifyConfig({MAILIFY_API_KEY:'synthetic-key',MAILIFY_API_SECRET:'synthetic-secret',MAILIFY_FROM:'TaskTracker',MAILIFY_FROM_NAME:'TaskTracker Notification'});
 let calls=0;
 const r=await sendMailifyTest({recipient:'test@example.com',name:'Test',subject:'Test "subject"',content:'Text with "quotes" & Unicode ✓'},config,async(url,request)=>{
  calls++;assert.equal(url,MAILIFY_ENDPOINT);assert.equal(request.redirect,'error');assert.equal(request.headers['mail-setting'],'25');
  assert.equal(request.headers['x-api-key'],'synthetic-key');assert.equal(request.headers['x-api-secret'],'synthetic-secret');
  assert.equal(request.body.get('test'),'True');assert.equal(request.body.get('ecategory'),'transactional');
  const payload=JSON.parse(request.body.get('mail_data'));
  assert.equal(payload.length,1);assert.deepEqual(payload[0].recipients,[['test@example.com',{name:'Test'}]]);
  assert.equal(payload[0].from,'TaskTracker');assert.equal(payload[0].fromname,'TaskTracker Notification');assert.equal(payload[0].content,'Text with "quotes" & Unicode ✓');
  return new Response(JSON.stringify({error:'Provider rejected sender'}),{status:422});
 });
 assert.equal(calls,1);assert.equal(r.httpStatus,422);assert.equal(r.body.error,'Provider rejected sender');
});
test('Mailify never retries an ambiguous request and rejects invalid input before sending',async()=>{
 const {sendMailifyTest,mailifyConfig}=await import('../scripts/email/mailify.mjs');
 assert.throws(()=>mailifyConfig({}),/Missing server configuration/);
 let calls=0;const fail=async()=>{calls++;throw new Error('Timeout');};
 await assert.rejects(()=>sendMailifyTest({recipient:'bad'}, {},fail),/valid test recipient/);assert.equal(calls,0);
 await assert.rejects(()=>sendMailifyTest({recipient:'test@example.com',subject:'S',content:'C'}, {},fail),/Timeout/);assert.equal(calls,1);
});
test('Every dark email template escapes content and uses trusted action links',async()=>{
 const {renderEmail,categories}=await import('../scripts/email/templates.mjs');
 for(const kind of Object.keys(categories)){
  const result=renderEmail(kind,{name:'<script>alert(1)</script>',task:{id:'a/b',projectId:'x?y',title:'Long task <img src=x onerror=alert(1)>'},note:'<b>Do not execute</b>\nSecond line',items:[{title:'<script>x</script>',detail:'Safe & sound'}]});
  assert.ok(result.html.includes('background:#080f1b'));assert.ok(result.html.includes('color:#08232b'));
  assert.ok(!result.html.includes('<script>'));assert.ok(!result.html.includes('<img '));assert.ok(result.html.includes('&lt;script&gt;'));
  assert.ok(result.html.includes('https://tasktracker.top-menus.com/dashboard/projects/x%3Fy?task=a%2Fb'));
  assert.ok(result.text.includes('Email preferences:'));assert.ok(!/[\r\n]/.test(result.subject));
 }
 assert.throws(()=>renderEmail('assignment',{}, {origin:'http://evil.test'}),/HTTPS/);
 assert.throws(()=>renderEmail('assignment',{}, {origin:'https://user:pass@evil.test'}),/HTTPS/);
});
