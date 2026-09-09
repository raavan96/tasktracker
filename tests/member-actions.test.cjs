/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Load real TS action modules with a fake Supabase boundary. Never contacts a database.
function load(filename, mocks) {
  const source = fs.readFileSync(path.join(__dirname, '..', filename), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', js)((name) => {
    if (!(name in mocks)) throw new Error(`Unexpected dependency: ${name}`);
    return mocks[name];
  }, mod, mod.exports);
  return mod.exports;
}

process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
process.env.NEXT_PUBLIC_COMPANY_DOMAIN = 'example.com';
function form(overrides = {}) {
  const f = new FormData();
  for (const [key, value] of Object.entries({email:' New@Example.com ', fullName:' New Member ', role:'member', password:'test-password-123', confirmPassword:'test-password-123', ...overrides})) f.set(key,value);
  return f;
}
function setup({user = {id:'admin'}, role = 'admin', authError = null, profileError = null, memberExists = true} = {}) {
  const writes = []; const invalidated = [];
  const client = {auth:{getUser:async()=>({data:{user}})},from(){const q={select:()=>q,eq:()=>q,single:async()=>({data:{role}})};return q;}};
  const admin = {
    auth:{admin:{
      createUser:async(payload)=>{writes.push(['create',payload]);return {data:{user:authError?null:{id:'new-id'}},error:authError};},
      updateUserById:async(id,payload)=>{writes.push(['reset',id,payload]);return {error:authError};},
    }},
    from(){const q={select:()=>q,eq:()=>q,single:async()=>({data:memberExists?{id:'new-id'}:null}),upsert:async(payload)=>{writes.push(['profile',payload]);return {error:profileError};}};return q;}
  };
  const actions=load('src/app/auth/actions.ts',{'next/cache':{revalidatePath:p=>invalidated.push(p)},'next/navigation':{redirect:()=>{}},'@/lib/supabase/server':{createClient:async()=>client,createAdminClient:()=>admin}});
  return {actions,writes,invalidated};
}
test('signed-out users and members cannot create accounts or reset passwords',async()=>{
  for(const options of [{user:null},{role:'member'}]){
    const t=setup(options);
    assert.ok((await t.actions.createMember(form())).error);
    assert.ok((await t.actions.resetMemberPassword('target',form())).error);
    assert.equal(t.writes.length,0);
  }
});
test('invalid member details never reach the admin API',async()=>{
  for(const fields of [{email:'invalid'},{email:'a@outside.com'},{fullName:' '},{role:'owner'},{password:'short'},{confirmPassword:'different'}]){
    const t=setup();assert.ok((await t.actions.createMember(form(fields))).error);assert.equal(t.writes.length,0);
  }
});
test('creates confirmed email/password login and a roster profile without email APIs',async()=>{
  const t=setup();const result=await t.actions.createMember(form({role:'admin'}));
  assert.ok(result.success);
  assert.deepEqual(t.writes,[['create',{email:'new@example.com',password:'test-password-123',email_confirm:true,user_metadata:{full_name:'New Member'}}],['profile',{id:'new-id',email:'new@example.com',full_name:'New Member',role:'admin'}]]);
  assert.ok(!JSON.stringify(result).includes('test-password-123'));
  assert.deepEqual(t.invalidated,['/admin/users']);
});
test('duplicate or failed creation never overwrites an existing profile or password',async()=>{
  const t=setup({authError:{message:'User already registered'}});
  assert.equal((await t.actions.createMember(form())).error,'User already registered');assert.equal(t.writes.length,1);
});
test('partial profile failure explains that the login already exists',async()=>{
  const t=setup({profileError:{message:'Database unavailable'}});
  assert.match((await t.actions.createMember(form())).error,/login.*was created/);
});
test('admin reset rejects self, missing members, and invalid passwords',async()=>{
  const t=setup();assert.ok((await t.actions.resetMemberPassword('admin',form())).error);
  assert.ok((await t.actions.resetMemberPassword('target',form({password:'short'}))).error);assert.equal(t.writes.length,0);
  const missing=setup({memberExists:false});assert.ok((await missing.actions.resetMemberPassword('target',form())).error);assert.equal(missing.writes.length,0);
});
test('admin can assign a replacement password without sending a recovery email',async()=>{
  const t=setup();assert.ok((await t.actions.resetMemberPassword('target',form())).success);
  assert.deepEqual(t.writes,[['reset','target',{password:'test-password-123',email_confirm:true}]]);
  const failed=setup({authError:{message:'Password rejected'}});assert.equal((await failed.actions.resetMemberPassword('target',form())).error,'Password rejected');
});
