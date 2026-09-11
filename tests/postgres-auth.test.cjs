/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
function load(file,mocks={}){
  const mod={exports:{}};
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','module','exports',code)(name=>name in mocks?mocks[name]:require(name),mod,mod.exports);return mod.exports;
}
test('local authentication: login, session storage, member permissions, password reset, expiry, throttling and deletion',async()=>{
  const db=new PGlite();
  try{
    for(const f of ['001_base.sql','002_review.sql','003_workspace.sql','004_automation.sql','005_runtime.sql'])await db.exec(fs.readFileSync('postgres/'+f,'utf8'));
    const passwords=load('src/lib/postgres/password.ts');
    const encoded=await passwords.hashPassword('Synthetic-password-1');
    assert.ok(!encoded.includes('Synthetic-password-1'));
    assert.equal(await passwords.verifyPassword('wrong',encoded),false);
    const admin='00000000-0000-0000-0000-000000000001';
    await db.query('INSERT INTO auth.users(id,email,password_hash) VALUES($1,$2,$3)',[admin,'admin@example.com',encoded]);
    await db.query("INSERT INTO profiles(id,email,role) VALUES($1,$2,'admin')",[admin,'admin@example.com']);
    await db.exec('SET ROLE tasktracker_runtime');
    const query=async(sql,args)=>{const res=await db.query(sql,args);return {...res,rowCount:res.affectedRows};};
    const connection={query,release(){}};
    const pool={query,connect:async()=>connection};
    const transaction=async(user,fn)=>{await query('BEGIN');try{await query("SELECT set_config('request.jwt.claim.sub',$1,true)",[user||'']);await query('SET LOCAL ROLE authenticated');const result=await fn(connection);await query('COMMIT');return result;}catch(e){await query('ROLLBACK');throw e;}};
    const jar=new Map();let options;
    const cookieAPI={get:name=>jar.has(name)?{value:jar.get(name)}:undefined,set:(name,value,opts)=>{jar.set(name,value);options=opts;},delete:name=>jar.delete(name)};
    const authModule=load('src/lib/postgres/auth.ts',{'server-only':{},'next/headers':{cookies:async()=>cookieAPI},react:{cache:f=>f},'./password':passwords,'./db':{pool:()=>pool,transaction}});
    const auth=authModule.localAuth();
    assert.equal((await auth.getUser()).data.user,null);
    assert.ok((await auth.admin.createUser({email:'x@example.com',password:'Synthetic-password-2',user_metadata:{full_name:'X'}})).error);
    assert.ok((await auth.signInWithPassword({email:'admin@example.com',password:'wrong'})).error);
    assert.equal((await auth.signInWithPassword({email:'admin@example.com',password:'Synthetic-password-1'})).error,null);
    assert.equal((await auth.getUser()).data.user.id,admin);assert.equal(options.httpOnly,true);assert.equal(options.sameSite,'lax');
    const adminCookie=jar.get(authModule.SESSION_COOKIE);
    const stored=(await query('SELECT token_hash FROM auth.sessions')).rows[0].token_hash;assert.notEqual(stored,adminCookie);
    const created=await auth.admin.createUser({email:'member@example.com',password:'Synthetic-password-2',user_metadata:{full_name:'Member'}});assert.equal(created.error,null);const member=created.data.user.id;
    assert.ok((await auth.admin.createUser({email:'member@example.com',password:'Synthetic-password-3',user_metadata:{full_name:'Duplicate'}})).error);
    await auth.signOut();assert.equal((await auth.getUser()).data.user,null);
    assert.equal((await auth.signInWithPassword({email:'member@example.com',password:'Synthetic-password-2'})).error,null);
    const memberCookie=jar.get(authModule.SESSION_COOKIE);
    assert.ok((await auth.admin.updateUserById(admin,{password:'Synthetic-password-4'})).error);
    // A separate admin browser resets the member password; existing member session expires.
    assert.equal((await auth.signInWithPassword({email:'admin@example.com',password:'Synthetic-password-1'})).error,null);
    const secondAdminCookie=jar.get(authModule.SESSION_COOKIE);
    assert.equal((await auth.admin.updateUserById(member,{password:'Synthetic-password-4'})).error,null);
    jar.set(authModule.SESSION_COOKIE,memberCookie);assert.equal((await auth.getUser()).data.user,null);
    assert.ok((await auth.signInWithPassword({email:'member@example.com',password:'Synthetic-password-2'})).error);
    assert.equal((await auth.signInWithPassword({email:'member@example.com',password:'Synthetic-password-4'})).error,null);
    assert.equal((await auth.updateUser({password:'Synthetic-password-5'})).error,null);
    assert.equal((await auth.getUser()).data.user.id,member);
    await query("UPDATE auth.sessions SET expires_at=now()-interval '1 second' WHERE user_id=$1",[member]);assert.equal((await auth.getUser()).data.user,null);
    for(let i=0;i<10;i++)await auth.signInWithPassword({email:'missing@example.com',password:'wrong'});
    assert.match((await auth.signInWithPassword({email:'missing@example.com',password:'wrong'})).error.message,/Too many/);
    jar.set(authModule.SESSION_COOKIE,secondAdminCookie);
    assert.ok((await auth.admin.deleteUser(admin)).error);
    assert.equal((await auth.admin.deleteUser(member)).error,null);
    assert.equal((await query('SELECT id FROM auth.users WHERE id=$1',[member])).rows.length,0);
  }finally{await db.close();}
});
