import {chromium,expect} from '@playwright/test';
import pg from 'pg';
import {randomBytes,scrypt as callback} from 'node:crypto';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
// Synthetic CI database only. Never point this runner at an existing workspace.
const db=new pg.Client({connectionString:process.env.DATABASE_ADMIN_URL});await db.connect();
if((await db.query('SELECT id FROM profiles LIMIT 1')).rows.length)throw new Error('Browser test requires an empty database.');
const password='Synthetic-browser-password-2026';
const salt=randomBytes(16).toString('hex'),key=await promisify(callback)(password,salt,64,{N:32768,r:8,p:3,maxmem:64*1024*1024});
const users=[];
for(let n=0;n<8;n++){
  const email=`staging${n}@collegedunia.com`;
  const id=(await db.query('INSERT INTO auth.users(id,email,password_hash) VALUES(gen_random_uuid(),$1,$2) RETURNING id',[email,`scrypt-v1$${salt}$${key.toString('hex')}`])).rows[0].id;
  await db.query('INSERT INTO profiles(id,email,full_name,role) VALUES($1,$2,$3,$4)',[id,email,`Staging ${n}`,n===0?'admin':'member']);users.push({id,email});
}
const browser=await chromium.launch();const contexts=[];const pages=[];const external=[];
const base='http://localhost:3104';
try{
  for(let n=0;n<8;n++){
    const context=await browser.newContext();contexts.push(context);const page=await context.newPage();pages.push(page);
    page.on('request',request=>{if(request.url().includes('supabase.co'))external.push(request.url());});
  }
  await Promise.all(pages.map(async(page,n)=>{await page.goto(base+'/login');await page.locator('input[name=email]').fill(users[n].email);await page.locator('input[name=password]').fill(password);await page.getByRole('button',{name:'Sign In',exact:true}).click();await page.waitForURL('**/dashboard',{timeout:30000});}));
  const admin=pages[0],member=pages[1],outsider=pages[2];
  await admin.getByRole('button',{name:'New Project'}).click();
  await admin.locator('dialog input[name=name]').fill('Private staging workflow');
  await admin.locator(`input[name=members][value="${users[1].id}"]`).check();
  await admin.getByRole('button',{name:'Create Project',exact:true}).click();
  await admin.getByRole('link').filter({hasText:'Private staging workflow'}).click();
  await admin.waitForURL('**/dashboard/projects/*');
  const projectURL=admin.url();
  await admin.getByRole('button',{name:'Add Task',exact:true}).click();
  await admin.locator('dialog input[name=title]').fill('Verify local task workflow');
  await admin.locator('dialog select[name=assigneeId]').selectOption(users[1].id);
  await admin.getByRole('button',{name:'Create task',exact:true}).click();
  await expect.poll(async()=>Number((await db.query('SELECT count(*) FROM tasks')).rows[0].count)).toBe(1);
  const task=(await db.query('SELECT id FROM tasks')).rows[0].id;
  await member.goto(projectURL+'?task='+task);
  await member.getByLabel('Task attachment').setInputFiles({name:'proof.txt',mimeType:'text/plain',buffer:Buffer.from('Synthetic task attachment')});
  await member.getByRole('button',{name:'Upload file',exact:true}).click();
  await expect(member.getByRole('button',{name:/proof.txt/})).toBeVisible();
  const attachment=(await db.query('SELECT id FROM task_attachments')).rows[0].id;
  const download=await contexts[1].request.get(base+'/api/attachments/'+attachment);assert.equal(download.status(),200);assert.equal(await download.text(),'Synthetic task attachment');
  assert.equal((await contexts[2].request.get(base+'/api/attachments/'+attachment)).status(),404);
  await member.getByRole('button',{name:'Ready for review',exact:true}).click();
  await expect.poll(async()=>(await db.query('SELECT status FROM tasks WHERE id=$1',[task])).rows[0].status).toBe('in_review');
  await expect(member.getByRole('button',{name:'Approve & complete',exact:true})).toBeDisabled();
  await admin.goto(projectURL+'?task='+task);
  await admin.getByRole('button',{name:'Approve & complete',exact:true}).click();
  await expect.poll(async()=>(await db.query('SELECT status FROM tasks WHERE id=$1',[task])).rows[0].status).toBe('done');
  await outsider.goto(projectURL);await expect(outsider.getByText('Verify local task workflow',{exact:true})).toHaveCount(0);
  await Promise.all(pages.map(p=>p.goto(base+'/dashboard')));
  assert.equal(external.length,0,'Staging must not contact Supabase');
  console.log('Eight browser logins, private project, task assignment, local upload/download, outsider denial, review and admin approval passed against PostgreSQL 16.');
}finally{await browser.close();await db.end();}
