import {chromium,expect} from '@playwright/test';
import pg from 'pg';
import AxeBuilder from '@axe-core/playwright';
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
await db.query('UPDATE review_settings SET enabled=true');
const browser=await chromium.launch();const contexts=[];const pages=[];const external=[];
const base='http://localhost:3104';
try{
  for(let n=0;n<8;n++){
    const context=await browser.newContext();contexts.push(context);const page=await context.newPage();pages.push(page);
    page.on('request',request=>{if(request.url().includes('supabase.co'))external.push(request.url());});
  }
  const homeResponse=await pages[0].goto(base+'/');
  assert.equal(homeResponse.status(),200);
  await expect(pages[0].getByRole('heading',{level:1})).toContainText('Great work starts');
  await pages[0].getByRole('link',{name:'Open workspace'}).click();
  await pages[0].waitForURL('**/login');
  await Promise.all(pages.map(async(page,n)=>{await page.goto(base+'/login');await page.locator('input[name=email]').fill(users[n].email);await page.locator('input[name=password]').fill(password);await page.getByRole('button',{name:'Sign In',exact:true}).click();await page.waitForURL('**/dashboard',{timeout:30000});}));
  const admin=pages[0],member=pages[1],outsider=pages[2];
  await expect(admin.getByRole('button',{name:'Go back',exact:true})).toHaveCount(0);

  // Back reserves the same space on direct entry, navigation, and return.
  for(const width of [430,1440]){
   await admin.setViewportSize({width,height:1000});await admin.goto(base+'/dashboard');
   const shell=width===430?'.workspace-header':'aside';
   await expect(admin.locator(shell+' .workspace-search-pill')).toBeVisible();
   await expect(admin.locator(shell).getByRole('button',{name:'Go back',exact:true})).toHaveCount(0);
   const positions=()=>admin.locator(shell+' .workspace-nav-stack').evaluate(el=>[...el.querySelectorAll('.workspace-search-pill,.workspace-nav-main')].map(n=>{const r=n.getBoundingClientRect();return [r.x,r.y,r.width];}));
   const before=await positions();
   await admin.locator(shell).getByRole('link',{name:'All Tasks',exact:true}).click();
   await expect(admin).toHaveURL(base+'/dashboard/tasks');
   await expect(admin.locator(shell).getByRole('button',{name:'Go back',exact:true})).toBeVisible();
   assert.deepEqual(await positions(),before,'Back appearing must not move navigation');
   await admin.locator(shell).getByRole('button',{name:'Go back',exact:true}).click();
   await expect(admin).toHaveURL(base+'/dashboard');
   await expect(admin.locator(shell).getByRole('button',{name:'Go back',exact:true})).toHaveCount(0);
   assert.deepEqual(await positions(),before,'Back disappearing must not move navigation');
  }

  await admin.getByRole('button',{name:'New Project'}).click();
  await admin.locator('dialog input[name=name]').fill('Private staging workflow');
  await admin.getByLabel('Search team members',{exact:true}).fill(users[1].email.toUpperCase());
  await admin.locator(`input[name=members][value="${users[1].id}"]`).check();
  await admin.getByLabel('Search team members',{exact:true}).fill('No matching person');
  await expect(admin.getByText('No members match your search.',{exact:true})).toBeVisible();
  await expect(admin.getByText('0 matching members · 1 selected',{exact:true})).toBeVisible();
  await admin.getByRole('button',{name:'Create Project',exact:true}).click();
  await admin.getByRole('link').filter({hasText:'Private staging workflow'}).click();
  await admin.waitForURL('**/dashboard/projects/*');
  const projectURL=admin.url();
  await expect(admin.getByText('Created by Staging 0',{exact:true})).toBeVisible();
  await admin.getByRole('button',{name:'Add Task',exact:true}).click();
  await admin.locator('dialog input[name=title]').fill('Retained task draft');
  await admin.getByRole('button',{name:'Add a teammate from the Team tab'}).click();
  await admin.getByLabel('Search teammates to add',{exact:true}).fill(users[2].email.toUpperCase());
  await expect(admin.locator('#newProjectMemberSelect option')).toHaveCount(2);
  await admin.getByLabel('Teammate to add',{exact:true}).selectOption(users[2].id);
  await admin.getByLabel('Search teammates to add',{exact:true}).fill('No matching person');
  await expect(admin.getByRole('button',{name:'Add to Project',exact:true})).toBeDisabled();
  await expect(admin.getByText('No teammates match your search.',{exact:true})).toBeVisible();
  await admin.getByLabel('Search teammates to add',{exact:true}).fill('');
  await expect(admin.getByRole('button',{name:'Resume task draft'})).toBeVisible();
  await admin.getByRole('button',{name:'Resume task draft'}).click();
  await expect(admin.locator('dialog input[name=title]')).toHaveValue('Retained task draft');
  await admin.locator('dialog input[name=title]').fill('Verify local task workflow');
  await admin.getByRole('checkbox',{name:'Staging 1',exact:true}).check();
  await admin.getByRole('button',{name:'Create task',exact:true}).click();
  await expect.poll(async()=>Number((await db.query('SELECT count(*) FROM tasks')).rows[0].count)).toBe(1);
  const task=(await db.query('SELECT id FROM tasks')).rows[0].id;
  await expect(admin.getByRole('button',{name:'Edit project',exact:true})).toBeHidden();
  await admin.getByText('Project actions',{exact:true}).click();
  await admin.keyboard.press('Escape');
  await expect(admin.getByRole('button',{name:'Edit project',exact:true})).toBeHidden();
  await admin.getByText('Project actions',{exact:true}).click();
  await admin.getByRole('button',{name:'Edit project',exact:true}).click();
  await expect(admin.locator('dialog')).toBeVisible();
  await admin.locator('dialog input[name=name]').fill('Unsaved project title');
  const discardPrompt=admin.waitForEvent('dialog');
  const escape=admin.keyboard.press('Escape');
  await (await discardPrompt).dismiss();await escape;
  await expect(admin.locator('dialog input[name=name]')).toHaveValue('Unsaved project title');
  await admin.locator('dialog input[name=name]').fill('Private staging workflow');
  await admin.keyboard.press('Escape');
  await expect(admin.locator('dialog')).toHaveCount(0);
  for (const width of [1440,430]) {
    await admin.setViewportSize({width,height:932});
    const geometry=()=>admin.evaluate(()=>[...document.querySelectorAll('.workspace-main,.workspace-main h1,.dark-workspace-sidebar,.workspace-header-inner,.board-column,.task-card')].map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return [el.className,Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height),s.fontSize,s.padding,s.display];}));
    await admin.evaluate(()=>document.fonts.ready);
    await admin.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));
    const beforeTheme=await geometry();
    await admin.getByRole('button',{name:/Switch to (light|dark) mode/}).click();
    await admin.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));
    assert.deepEqual(await geometry(),beforeTheme,'Theme changes must preserve layout and typography');
    await admin.getByRole('button',{name:/Switch to (light|dark) mode/}).click();

    await admin.getByText('Project actions',{exact:true}).click();
    await expect.poll(async()=>{const box=await admin.locator('details[open] > [data-actions-menu]').boundingBox();return box.x>=0&&box.x+box.width<=width;}).toBe(true);
    await admin.keyboard.press('Escape');
    await admin.getByRole('button',{name:'Table & export',exact:true}).click();
    await expect(admin.getByRole('region',{name:'Table view',exact:true})).toBeVisible();
    if(width===430)for(const select of await admin.locator('.task-table-view select:visible').all())assert.ok((await select.boundingBox()).width>=140,'Mobile filters must keep their selected values readable');
    if(!await admin.getByLabel('Show Created by column').isVisible())await admin.getByText('More filters & columns',{exact:true}).click();await admin.getByLabel('Show Created by column').check();
    await expect(admin.getByRole('columnheader',{name:'Created by',exact:true})).toBeVisible();
    await expect(admin.getByRole('cell',{name:'Staging 0',exact:true})).toBeVisible();
    await expect(admin.getByRole('region',{name:'Board view',exact:true})).toHaveCount(0);
    await admin.getByRole('button',{name:'Board',exact:true}).click();
    await expect(admin.getByRole('region',{name:'Board view',exact:true})).toBeVisible();
    await expect(admin.getByRole('region',{name:'Table view',exact:true})).toHaveCount(0);
    assert.equal(await admin.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  }
  await admin.getByRole('button',{name:'Add Task',exact:true}).click();
  await admin.locator('dialog input[name=title]').fill('Separate unsaved draft');
  await admin.getByRole('button',{name:'Add a teammate from the Team tab'}).click();
  await admin.getByRole('button',{name:/^Tasks \(/}).click();
  await admin.getByRole('button',{name:'Open task: Verify local task workflow',exact:true}).click();
  await admin.getByText('Task actions',{exact:true}).click();
  const draftDiscard=admin.waitForEvent('dialog');
  const editExisting=admin.getByRole('button',{name:'Edit task',exact:true}).click();
  await (await draftDiscard).accept();await editExisting;
  await expect(admin.locator('dialog input[name=title]')).toHaveValue('Verify local task workflow');
  await admin.keyboard.press('Escape');
  await admin.goto(projectURL+'?task='+task);
  // Reproduce the wrapped, left-aligned task action row from a long assignee list.
  const taskActions=admin.locator('dialog details').filter({has:admin.locator('summary').filter({hasText:'Task actions'})});
  const originalRowStyle=await taskActions.evaluate(el=>{const parent=el.parentElement;const old=parent.getAttribute('style');parent.style.flexDirection='column';parent.style.alignItems='flex-start';return old;});
  for(const width of [1440,430,375]){
   await admin.setViewportSize({width,height:950});
   if(!await taskActions.getAttribute('open').then(value=>value!==null))await taskActions.locator('summary').click();
   await expect.poll(()=>taskActions.locator('[data-actions-menu]').evaluate(menu=>{
    const box=menu.getBoundingClientRect(),dialog=menu.closest('dialog').getBoundingClientRect();
    return box.left>=dialog.left+1&&box.right<=dialog.right-1&&box.left>=0&&box.right<=innerWidth;
   })).toBe(true);
   await expect(taskActions.getByRole('button',{name:'Edit task',exact:true})).toBeVisible();
  }
  await admin.keyboard.press('Escape');await expect(taskActions).not.toHaveAttribute('open','');
  await expect(admin.locator('dialog')).toBeVisible();
  await taskActions.evaluate((el,old)=>{if(old===null)el.parentElement.removeAttribute('style');else el.parentElement.setAttribute('style',old);},originalRowStyle);
  await admin.setViewportSize({width:1440,height:1000});
  await expect(admin.getByRole('button',{name:'Edit task',exact:true})).toBeHidden();
  await admin.getByText('Task actions',{exact:true}).click();
  await admin.getByRole('button',{name:'Edit task',exact:true}).click();
  await expect(admin.locator('dialog input[name=title]')).toHaveValue('Verify local task workflow');
  await admin.keyboard.press('Escape');
  await admin.goto(projectURL+'?task='+task);
  await admin.getByRole('button',{name:/^Updates \(/}).click();
  await expect(admin.getByRole('heading',{name:'Task history',exact:true})).toBeVisible();
  assert.equal(await admin.evaluate(()=>{
    const notes=document.querySelector('textarea[aria-label="Write a task update"]');
    const history=[...document.querySelectorAll('h3')].find(el=>el.textContent==='Task history');
    return !!(notes.compareDocumentPosition(history)&Node.DOCUMENT_POSITION_FOLLOWING);
  }),true);

  await member.goto(projectURL+'?task='+task);
  await expect(member.getByText('Created by Staging 0',{exact:true}).last()).toBeVisible();
  await member.getByText('Add attachments',{exact:true}).click();await member.getByLabel('Task attachment').setInputFiles({name:'proof.txt',mimeType:'text/plain',buffer:Buffer.from('Synthetic task attachment')});
  await member.getByRole('button',{name:'Upload file',exact:true}).click();
  await expect(member.getByRole('button',{name:/^proof.txt/})).toBeVisible();
  const attachment=(await db.query('SELECT id FROM task_attachments')).rows[0].id;
  const download=await contexts[1].request.get(base+'/api/attachments/'+attachment);assert.equal(download.status(),200);assert.equal(await download.text(),'Synthetic task attachment');
  assert.equal((await contexts[2].request.get(base+'/api/attachments/'+attachment)).status(),404);
  await member.getByRole('button',{name:'Ready for review',exact:true}).click();
  await expect.poll(async()=>(await db.query('SELECT status FROM tasks WHERE id=$1',[task])).rows[0].status).toBe('in_review');
  await expect(member.getByRole('button',{name:'Approve & complete',exact:true})).toBeHidden();
  await admin.goto(projectURL+'?task='+task);
  await admin.getByRole('button',{name:'Approve & complete',exact:true}).click();
  await expect.poll(async()=>(await db.query('SELECT status FROM tasks WHERE id=$1',[task])).rows[0].status).toBe('done');

  // Exercise archive/restore as a user without changing production records.
  await admin.goto(projectURL);
  await admin.getByText('Project actions',{exact:true}).click();
  await admin.getByRole('button',{name:'Complete project',exact:true}).click();
  await admin.getByRole('button',{name:'Confirm',exact:true}).click();
  await expect.poll(async()=>(await db.query('SELECT is_archived FROM projects WHERE id=$1',[projectURL.split('/').pop()])).rows[0].is_archived).toBe(true);
  await admin.goto(base+'/dashboard/archive?section=completed');
  await expect(admin.getByRole('link',{name:'Private staging workflow',exact:true})).toBeVisible();
  await member.goto(projectURL+'?task='+task);
  await expect(member.getByRole('button',{name:'Ready for review',exact:true})).toBeHidden();
  await expect(member.getByLabel('Task attachment')).toHaveCount(0);
  assert.equal((await contexts[1].request.get(base+'/api/attachments/'+attachment)).status(),200);
  await admin.getByRole('button',{name:'Restore project',exact:true}).click();
  await admin.getByRole('button',{name:'Confirm',exact:true}).click();
  await expect.poll(async()=>(await db.query('SELECT is_archived FROM projects WHERE id=$1',[projectURL.split('/').pop()])).rows[0].is_archived).toBe(false);
  await admin.goto(projectURL+'?task='+task);
  await admin.getByText('Task actions',{exact:true}).click();
  await admin.getByRole('button',{name:'Archive task',exact:true}).click();
  await admin.getByRole('button',{name:'Confirm',exact:true}).click();
  await expect.poll(async()=>(await db.query('SELECT is_archived FROM tasks WHERE id=$1',[task])).rows[0].is_archived).toBe(true);
  await admin.goto(base+'/dashboard/archive');
  await expect(admin.getByRole('link',{name:'Verify local task workflow',exact:true})).toBeVisible();
  await admin.getByRole('button',{name:'Restore task',exact:true}).click();
  await admin.getByRole('button',{name:'Confirm',exact:true}).click();
  await expect.poll(async()=>(await db.query('SELECT is_archived FROM tasks WHERE id=$1',[task])).rows[0].is_archived).toBe(false);
  await admin.getByText('Automatic archiving settings',{exact:true}).click();
  await admin.getByLabel('tasks retention days').fill('45');
  await admin.getByRole('button',{name:'Save archiving settings',exact:true}).click();
  await expect(admin.getByRole('status')).toHaveText('Archiving settings saved.');
  await expect.poll(async()=>(await db.query('SELECT task_days FROM archive_settings')).rows[0].task_days).toBe(45);
  await member.goto(base+'/dashboard/archive');
  await expect(member.getByText('Automatic archiving settings',{exact:true})).toHaveCount(0);
  await admin.goto(base+'/admin/users');
  await admin.getByRole('textbox',{name:'Search members'}).fill(users[1].email);
  await admin.getByRole('button',{name:'Edit details',exact:true}).click();
  await admin.getByLabel('Job title',{exact:true}).fill('QA coordinator');
  await admin.getByLabel('Department',{exact:true}).fill('Workflow QA');
  await admin.getByRole('button',{name:'Save details',exact:true}).click();
  await expect.poll(async()=>(await db.query('SELECT department FROM profiles WHERE id=$1',[users[1].id])).rows[0].department).toBe('Workflow QA');
  await admin.goto(projectURL);
  await admin.getByRole('button',{name:/^Notes \(/}).click();
  await admin.getByRole('button',{name:'New Note',exact:true}).click();
  await admin.locator('dialog input[name=title]').fill('Workflow audit note');
  await admin.locator('dialog textarea[name=content]').fill('Decisions and context stay with the project.');
  await admin.locator('dialog button[type=submit]').click();
  await expect(admin.getByText('Workflow audit note',{exact:true})).toBeVisible();
  await admin.goto(base+'/dashboard/workload');
  await expect(admin.getByRole('heading',{name:'Team workload'})).toBeVisible();
  await admin.getByRole('link',{name:'Staging 1: pending tasks',exact:true}).click();
  await expect(admin.getByLabel('Filter by assignee')).toHaveValue(users[1].id);
  await expect(admin.getByLabel('Task summary filter')).toHaveValue('pending');
  await admin.getByRole('button',{name:'Reset filters',exact:true}).click();
  await admin.getByLabel('Sort tasks').selectOption('title');
  await admin.reload();
  await expect(admin.getByLabel('Sort tasks')).toHaveValue('title');
  await admin.goto(base+'/dashboard/tasks');
  const downloadPromise=admin.waitForEvent('download');
  await admin.getByRole('button',{name:'Export CSV',exact:true}).click();
  assert.equal((await downloadPromise).suggestedFilename(),'tasktracker-tasks.csv');
  await member.goto(base+'/dashboard/notifications');
  await member.getByRole('button',{name:'Mark all as read',exact:true}).click();
  await expect.poll(async()=>Number((await db.query('SELECT count(*) FROM notifications WHERE user_id=$1 AND NOT is_read',[users[1].id])).rows[0].count)).toBe(0);
  await member.getByRole('button',{name:'Mark as unread',exact:true}).first().click();
  await member.getByLabel('Notification filter').selectOption('unread');
  await expect(member.locator('article')).toHaveCount(1);
  await member.getByRole('button',{name:'Mark as read',exact:true}).click();
  await expect(member.getByText('You’re all caught up.',{exact:true})).toBeVisible();
  // Release 3 member-created delegation and lifecycle flow, synthetic accounts only.
  const delegated=(await db.query("INSERT INTO tasks(project_id,title,created_by,assignee_id) VALUES($1,'Member delegation QA',$2,$3) RETURNING id",[projectURL.split('/').pop(),users[1].id,users[0].id])).rows[0].id;
  await member.goto(projectURL+'?task='+delegated);
  await member.getByRole('button',{name:'Ready for review',exact:true}).click();
  await admin.goto(projectURL+'?task='+delegated);
  await expect.poll(async()=>(await db.query('SELECT status FROM tasks WHERE id=$1',[delegated])).rows[0].status).toBe('in_review');
  await expect(admin.getByRole('button',{name:'Approve & complete',exact:true})).toBeVisible();
  await member.goto(projectURL+'?task='+delegated);
  await expect(member.getByRole('button',{name:'Request changes',exact:true})).toBeDisabled();
  await member.getByLabel('Review feedback / reason').fill('Please revise the deliverable');
  await member.getByRole('button',{name:'Request changes',exact:true}).click();
  await expect.poll(async()=>(await db.query('SELECT status FROM tasks WHERE id=$1',[delegated])).rows[0].status).toBe('in_progress');
  await admin.reload();await admin.getByRole('button',{name:'Ready for review',exact:true}).click();
  await expect.poll(async()=>(await db.query('SELECT status FROM tasks WHERE id=$1',[delegated])).rows[0].status).toBe('in_review');
  await member.reload();await member.getByRole('button',{name:'Approve & complete',exact:true}).click();
  await expect.poll(async()=>(await db.query('SELECT status FROM tasks WHERE id=$1',[delegated])).rows[0].status).toBe('done');
  await admin.goto(base+'/admin/users');await admin.getByRole('textbox',{name:'Search members'}).fill(users[1].email);
  await admin.getByText('Member actions',{exact:true}).click();await admin.getByRole('button',{name:'Deactivate / reassign',exact:true}).click();
  await admin.getByLabel('Reason for access change').fill('Synthetic lifecycle test');
  await admin.getByRole('button',{name:'Confirm deactivation',exact:true}).click();
  await expect.poll(async()=>(await db.query('SELECT disabled FROM auth.users WHERE id=$1',[users[1].id])).rows[0].disabled).toBe(true);
  await member.goto(base+'/dashboard');await member.waitForURL('**/login');
  await admin.getByLabel('Member account status').selectOption('inactive');
  await admin.getByText('Member actions',{exact:true}).click();await admin.getByRole('button',{name:'Reactivate / reassign',exact:true}).click();
  await admin.getByLabel('Reason for access change').fill('Restore synthetic access');
  await admin.getByRole('button',{name:'Confirm reactivation',exact:true}).click();
  await expect.poll(async()=>(await db.query('SELECT disabled FROM auth.users WHERE id=$1',[users[1].id])).rows[0].disabled).toBe(false);
  console.log('Release 3 browser: member creator requests changes and approves delegated work; admin self-review available; deactivation revokes existing browser session; reactivation preserves account.');
  console.log('UI audit: completion archive, project/task restore, read-only archived work, retained download, settings permissions, team details, project notes, workload and CSV export passed.');
  await outsider.goto(projectURL);await expect(outsider.getByText('Verify local task workflow',{exact:true})).toHaveCount(0);
  await Promise.all(pages.map(p=>p.goto(base+'/dashboard')));
  const ownReview=(await db.query("INSERT INTO tasks(project_id,title,created_by,assignee_ids) VALUES($1,'Admin self review QA',$2,ARRAY[$2::uuid]) RETURNING id",[projectURL.split('/').pop(),users[0].id])).rows[0].id;
  await admin.goto(projectURL+'?task='+ownReview);await admin.getByRole('button',{name:'Ready for review',exact:true}).click();
  await expect(admin.getByRole('button',{name:'Approve & complete',exact:true})).toBeVisible();
  await admin.getByRole('button',{name:'Approve & complete',exact:true}).click();
  await expect.poll(async()=>(await db.query('SELECT status FROM tasks WHERE id=$1',[ownReview])).rows[0].status).toBe('done');
  // Real PostgreSQL row locks: two eligible reviewers cannot approve one version twice.
  await db.query('INSERT INTO project_members(project_id,user_id) VALUES($1,$2)',[projectURL.split('/').pop(),users[3].id]);
  const raceTask=(await db.query("INSERT INTO tasks(project_id,title,created_by,assignee_id,status) VALUES($1,'Concurrent review QA',$2,$3,'in_review') RETURNING id",[projectURL.split('/').pop(),users[1].id,users[3].id])).rows[0].id;
  async function concurrentAs(id,sql,args){const c=new pg.Client({connectionString:process.env.DATABASE_ADMIN_URL});await c.connect();try{await c.query('BEGIN');await c.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[id]);await c.query('SET LOCAL ROLE authenticated');const result=await c.query(sql,args);if(sql.startsWith('UPDATE')&&result.rowCount!==1)throw new Error('The actor no longer has permission to change this profile.');await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{await c.end();}}
  const approvals=await Promise.allSettled([users[0],users[1]].map(u=>concurrentAs(u.id,"SELECT review_task($1,0,'approve','')",[raceTask])));
  assert.equal(approvals.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(approvals.filter(r=>r.status==='rejected').length,1);
  await db.query("UPDATE profiles SET role='admin' WHERE id=$1",[users[4].id]);
  const demotions=await Promise.allSettled([[users[0],users[4]],[users[4],users[0]]].map(([actor,target])=>concurrentAs(actor.id,"UPDATE profiles SET role='member' WHERE id=$1",[target.id])));
  assert.equal(demotions.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(demotions.filter(r=>r.status==='rejected').length,1);
  assert.equal(Number((await db.query("SELECT count(*) FROM profiles WHERE role='admin' AND is_active")).rows[0].count),1);
  await db.query("UPDATE profiles SET role='admin' WHERE id=$1",[users[0].id]);
  console.log('Real PostgreSQL concurrency: one winning approval per task version; competing admin demotions preserve an active administrator.');

  await member.goto(base+'/login');await member.locator('input[name=email]').fill(users[1].email);await member.locator('input[name=password]').fill(password);await member.getByRole('button',{name:'Sign In',exact:true}).click();await member.waitForURL('**/dashboard');
  // Release 4: synthetic collaboration, discovery, reporting and scale.
  const r4project=projectURL.split('/').pop();
  const r4task=(await db.query("INSERT INTO tasks(project_id,title,created_by,assignee_id,due_date,recurrence) VALUES($1,'Discovery specimen',$2,$3,current_date+1,'weekly') RETURNING id",[r4project,users[0].id,users[3].id])).rows[0].id;
  await admin.goto(projectURL+'?task='+r4task+'&discussion=true');
  await admin.getByLabel('Write a task update').fill('Please check @Staging 3');
  await expect(admin.getByRole('option',{name:'Mention Staging 3',exact:true})).toBeVisible();await admin.getByLabel('Write a task update',{exact:true}).press('Enter');await expect(admin.getByRole('listbox',{name:'Mention suggestions'})).toBeHidden();
  await admin.getByLabel('Write a task update',{exact:true}).press('Control+Enter');
  await expect(admin.getByRole('button',{name:'Edit remark',exact:true})).toBeVisible();
  await admin.getByRole('button',{name:'Edit remark',exact:true}).click();
  const deepRemark=(await db.query('SELECT id FROM task_comments WHERE task_id=$1 ORDER BY created_at DESC LIMIT 1',[r4task])).rows[0].id;
  await admin.goto(projectURL+'?task='+r4task+'&discussion=true#remark-'+deepRemark);
  await expect(admin.locator('#remark-'+deepRemark)).toBeVisible();
  await expect(admin.locator('#remark-'+deepRemark)).toHaveClass(/remark-flash/);
  const remarkInput=admin.getByLabel('Write a task update',{exact:true});
  await remarkInput.fill('Again @Staging 3');await expect(admin.getByRole('option',{name:'Mention Staging 3',exact:true})).toBeVisible();
  await remarkInput.press('Escape');await expect(admin.getByRole('listbox',{name:'Mention suggestions'})).toBeHidden();
  await remarkInput.press('Backspace');await remarkInput.press('3');await remarkInput.press('Enter');
  await expect(remarkInput).toHaveValue('Again @Staging 3 ');
  await expect(admin.getByRole('button',{name:'@Staging 3 ×',exact:true})).toHaveCount(1);
  await remarkInput.fill('Please @Staging 3 after');await remarkInput.press('End');for(let n=0;n<6;n++)await remarkInput.press('ArrowLeft');
  await expect(admin.getByRole('option',{name:'Mention Staging 3',exact:true})).toBeVisible();await remarkInput.press('Enter');
  await expect(remarkInput).toHaveValue('Please @Staging 3  after');
  // Mention insertion restores its caret on the next animation frame.
  await admin.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await remarkInput.fill('Discovery remark revised');
  await expect(remarkInput).toHaveValue('Discovery remark revised');
  await admin.getByRole('button',{name:'Save remark',exact:true}).click();
  await expect(admin.getByText('Discovery remark revised',{exact:true})).toBeVisible();
  await admin.getByRole('button',{name:'Edit history',exact:true}).click();
  await expect(admin.getByRole('heading',{name:'Previous remark versions'})).toBeVisible();
  assert.equal(Number((await db.query("SELECT count(*) FROM notifications WHERE user_id=$1 AND task_id=$2 AND dedupe_key LIKE 'mention:%'",[users[3].id,r4task])).rows[0].count),1);
  { // Loading a recurring schedule and opening its fields is not an edit.
  await admin.setViewportSize({width:1440,height:1000});
  await admin.goto(projectURL+'?task='+r4task);
  await admin.getByText('Edit future occurrences',{exact:true}).click();
  await expect(admin.getByLabel('Future task title',{exact:true})).toBeVisible();
  const unexpectedPrompts=[];
  const dismissUnexpected=async dialog=>{unexpectedPrompts.push(dialog.message());await dialog.dismiss();};
  admin.on('dialog',dismissUnexpected);
  await admin.mouse.click(10,300);
  await expect(admin.locator('dialog[open]')).toHaveCount(0);
  admin.off('dialog',dismissUnexpected);
  assert.deepEqual(unexpectedPrompts,[],'An untouched async schedule must close without a warning');
  await admin.goto(projectURL+'?task='+r4task);
  await admin.getByText('Edit future occurrences',{exact:true}).click();
  const futureTitle=admin.getByLabel('Future task title',{exact:true});
  const savedTitle=await futureTitle.inputValue();
  await futureTitle.fill('Unsaved schedule change');
  const discardPrompt=admin.waitForEvent('dialog');
  const tryClose=admin.getByRole('button',{name:'Close dialog',exact:true}).click();
  const prompt=await discardPrompt;assert.equal(prompt.message(),'Discard your unsaved changes?');await prompt.dismiss();await tryClose;
  await expect(futureTitle).toHaveValue('Unsaved schedule change');
  await futureTitle.fill(savedTitle);
  admin.on('dialog',dismissUnexpected);
  await admin.keyboard.press('Escape');await expect(admin.locator('dialog[open]')).toHaveCount(0);
  admin.off('dialog',dismissUnexpected);assert.deepEqual(unexpectedPrompts,[],'Reverted edits must close quietly');
  }
  await admin.goto(projectURL+'?task='+r4task);
  await admin.getByText('Edit future occurrences',{exact:true}).click();
  await admin.getByLabel('Future task title',{exact:true}).fill('Next specimen');
  await admin.getByLabel('Pause schedule',{exact:true}).check();
  await admin.getByRole('button',{name:'Preview future schedule',exact:true}).click();
  await admin.getByRole('button',{name:'Confirm future schedule',exact:true}).click();
  await expect.poll(async()=>(await db.query('SELECT paused FROM task_schedules WHERE task_id=$1',[r4task])).rows[0].paused).toBe(true);
  assert.equal((await db.query('SELECT title FROM tasks WHERE id=$1',[r4task])).rows[0].title,'Discovery specimen');
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=','base64');
  await admin.getByText('Add attachments',{exact:true}).click();await admin.getByLabel('Task attachment').setInputFiles({name:'preview.png',mimeType:'image/png',buffer:png});
  await admin.getByRole('button',{name:'Upload file',exact:true}).click();
  await expect.poll(async()=>Number((await db.query('SELECT count(*) FROM task_attachments WHERE task_id=$1',[r4task])).rows[0].count)).toBe(1);
  const previewId=(await db.query('SELECT id FROM task_attachments WHERE task_id=$1',[r4task])).rows[0].id;
  const previewResponse=await contexts[0].request.get(base+'/api/attachments/'+previewId+'?preview=1');assert.equal(previewResponse.status(),200);assert.equal(previewResponse.headers()['content-type'],'image/png');assert.equal((await contexts[2].request.get(base+'/api/attachments/'+previewId+'?preview=1')).status(),404);
  await admin.goto(base+'/dashboard/search?q=Discovery');await expect(admin.getByText('Discovery specimen',{exact:true}).first()).toBeVisible();await expect(admin.getByText('Discovery remark revised',{exact:true})).toBeVisible();
  await outsider.goto(base+'/dashboard/search?q=Discovery');await expect(outsider.getByText('No accessible results match these words.',{exact:true})).toBeVisible();
  await admin.goto(base+'/dashboard/reports');await expect(admin.getByRole('heading',{name:'Completion events by week'})).toBeVisible();const reportExport=await contexts[0].request.get(base+'/api/reports/export?from=2020-01-01&to=2029-12-31');assert.equal(reportExport.status(),200,await reportExport.text());
  // Project preferences and shared-task review controls.
  for(const name of ['View controls QA B','View controls QA C','View controls QA D'])await db.query('INSERT INTO projects(name,created_by,is_private) VALUES($1,$2,true)',[name,users[0].id]);
  await admin.goto(base+'/dashboard');await admin.getByRole('button',{name:'List view',exact:true}).click();await expect(admin.locator('[data-project-view="list"]')).toBeVisible();await admin.reload();await expect(admin.getByRole('button',{name:'List view',exact:true})).toHaveAttribute('aria-pressed','true');
  await admin.getByRole('button',{name:'Grid view',exact:true}).click();await admin.getByRole('button',{name:'Grid size',exact:true}).click();await admin.getByRole('menuitemradio',{name:'Small grid',exact:true}).click();await expect(admin.locator('[data-grid-size="small"]')).toBeVisible();await admin.getByRole('button',{name:'Sort projects',exact:true}).click();await admin.getByRole('menuitemradio',{name:'Name A–Z',exact:true}).click();await admin.reload();await expect(admin.getByRole('button',{name:'Grid size',exact:true})).toHaveAttribute('title','Grid size: Small grid');await expect(admin.getByRole('button',{name:'Sort projects',exact:true})).toHaveAttribute('title','Sort projects: Name A–Z');
  await admin.getByRole('button',{name:'Sort projects',exact:true}).click();await admin.keyboard.press('Escape');await expect(admin.getByRole('button',{name:'Sort projects',exact:true})).toBeFocused();await expect(admin.getByRole('menu',{name:'Sort projects'})).toHaveCount(0);
  for(const width of [375,430,1280]){await admin.setViewportSize({width,height:932});await admin.getByRole('button',{name:'List view',exact:true}).click();await admin.getByRole('button',{name:'Grid view',exact:true}).click();await expect.poll(()=>admin.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await admin.evaluate(()=>window.scrollTo(0,0));await admin.screenshot({path:`/tmp/release5-controls-${width}.png`,fullPage:true,animations:'disabled'});}
  for(const width of [375,430,1440]){
   await admin.setViewportSize({width,height:1000});
   await admin.getByRole('button',{name:'Grid size',exact:true}).click();await admin.getByRole('menuitemradio',{name:'Small grid',exact:true}).click();
   await admin.waitForTimeout(350);
   const area=()=>admin.locator('.project-card').first().evaluate(el=>{const r=el.getBoundingClientRect();return r.width*r.height;});
   const smallArea=await area();
   await admin.getByRole('button',{name:'Grid size',exact:true}).click();await admin.getByRole('menuitemradio',{name:'Extra small grid',exact:true}).click();
   await expect(admin.locator('[data-grid-size="extra-small"]')).toBeVisible();await admin.waitForTimeout(350);
   const ratio=(await area())/smallArea;assert.ok(ratio<.7&&ratio>.25,`Extra small footprint at ${width}: ${ratio}`);
   assert.equal(await admin.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await admin.reload();await expect(admin.getByRole('button',{name:'Grid size',exact:true})).toHaveAttribute('title','Grid size: Extra small grid');
   await admin.screenshot({path:`/tmp/release5-extra-small-${width}.png`,fullPage:true});
  }
  await admin.getByRole('button',{name:'Grid size',exact:true}).click();await admin.getByRole('menuitemradio',{name:'Small grid',exact:true}).click();
  const nav=admin.locator('aside').getByRole('navigation',{name:'Workspace',exact:true});await expect(nav.getByRole('link')).toHaveText(['Dashboard','Projects','My Tasks','All Tasks','Calendar','Reports','Templates','Archive','Workload','Team Users']);await expect(admin.locator('aside .workspace-search-pill')).toBeVisible();
  await admin.emulateMedia({reducedMotion:'reduce'});await admin.getByRole('button',{name:'List view',exact:true}).click();await expect(admin.locator('[data-project-view="list"]')).toBeVisible();assert.equal(await admin.locator('[data-project-view]').evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.playState==='running'&&a.constructor.name==='Animation').length),0);await admin.emulateMedia({reducedMotion:'no-preference'});
  await admin.goto(projectURL);await admin.getByRole('button',{name:'Archived tasks',exact:true}).click();await expect(admin.getByRole('button',{name:'Archived tasks',exact:true})).toHaveAttribute('aria-pressed','true');await admin.getByRole('button',{name:'Active tasks',exact:true}).click();await expect(admin.getByRole('button',{name:'Active tasks',exact:true})).toHaveAttribute('aria-pressed','true');

  await admin.goto(projectURL);await admin.getByRole('button',{name:'Add Task',exact:true}).click();await admin.locator('dialog input[name=title]').fill('Shared browser assignment');await admin.getByRole('checkbox',{name:'Staging 1',exact:true}).check();await admin.getByRole('checkbox',{name:'Staging 3',exact:true}).check();await admin.getByRole('button',{name:'Create task',exact:true}).click();
  const shared=await expect.poll(async()=>(await db.query("SELECT id FROM tasks WHERE title='Shared browser assignment'")).rows[0]?.id).toBeTruthy();void shared;
  const sharedId=(await db.query("SELECT id FROM tasks WHERE title='Shared browser assignment'")).rows[0].id;
  for(const n of [1,3]){await pages[n].goto(base+'/dashboard/my-tasks');await expect(pages[n].getByRole('link',{name:'Shared browser assignment',exact:true})).toBeVisible();}
  await pages[3].goto(projectURL+'?task='+sharedId);await expect(pages[3].getByRole('button',{name:'Approve & complete',exact:true})).toBeHidden();await pages[3].getByRole('button',{name:'Ready for review',exact:true}).click();await expect.poll(async()=>(await db.query('SELECT status FROM tasks WHERE id=$1',[sharedId])).rows[0].status).toBe('in_review');await expect(pages[3].getByRole('button',{name:'Ready for review',exact:true})).toBeHidden();await expect(pages[3].getByRole('button',{name:'Approve & complete',exact:true})).toBeHidden();
  await admin.goto(projectURL+'?task='+sharedId);await expect(admin.getByRole('button',{name:'Approve & complete',exact:true})).toBeVisible();await admin.getByRole('button',{name:'Approve & complete',exact:true}).click();await expect.poll(async()=>(await db.query('SELECT status FROM tasks WHERE id=$1',[sharedId])).rows[0].status).toBe('done');await expect(admin.getByRole('button',{name:'Approve & complete',exact:true})).toBeHidden();
  console.log('Project list/grid sizes/sorting preferences and multi-assignee picker, My Tasks and permitted-only review buttons passed.');


  // Release 5: actual previews, private templates, copies and responsive calendar.
  await admin.setViewportSize({width:1280,height:900});
  await admin.goto(projectURL+'?task='+sharedId);await admin.getByText('Task actions',{exact:true}).click();await admin.getByRole('link',{name:'Duplicate task',exact:true}).click();
  await expect(admin.getByRole('heading',{name:'Duplicate task',exact:true})).toBeVisible();
  await admin.getByText('Save this source as a reusable template',{exact:true}).click();
  await admin.getByLabel('Template name',{exact:true}).fill('R5 personal template');await admin.getByRole('button',{name:'Save template',exact:true}).click();await expect(admin.getByText('Saved to your templates.',{exact:true})).toBeVisible();
  const templateId=(await db.query("SELECT id FROM planning_templates WHERE name='R5 personal template'")).rows[0].id;
  await admin.getByLabel('New task title',{exact:true}).fill('R5 shared copy');await admin.getByLabel('Copy deadline 1',{exact:true}).fill('2026-09-20');
  await admin.getByRole('checkbox',{name:'Staging 1',exact:true}).check();await admin.getByRole('checkbox',{name:'Staging 3',exact:true}).check();await admin.getByRole('button',{name:'Create task copy',exact:true}).click();await admin.waitForURL('**/dashboard/projects/*');
  await expect.poll(async()=>(await db.query("SELECT count(*) n FROM tasks WHERE title='R5 shared copy'")).rows[0].n).toBe('1');
  const r5copy=(await db.query("SELECT * FROM tasks WHERE title='R5 shared copy'")).rows[0];assert.equal(r5copy.status,'todo');assert.deepEqual(r5copy.assignee_ids,[users[1].id,users[3].id]);assert.equal(r5copy.created_by,users[0].id);
  await admin.goto(base+'/dashboard/templates');await admin.getByLabel('Search templates',{exact:true}).fill('R5 personal');await expect(admin.getByRole('heading',{name:'R5 personal template',exact:true})).toBeVisible();await admin.getByRole('link',{name:'Use template',exact:true}).click();await expect(admin.getByRole('heading',{name:'Use template',exact:true})).toBeVisible();await expect(admin.getByRole('checkbox',{checked:true})).toHaveCount(0);
  await outsider.goto(base+'/dashboard/planning?kind=template&id='+templateId);await expect(outsider.getByText('Template unavailable or source project access was removed.',{exact:true})).toBeVisible();
  await admin.goto(base+'/dashboard/planning?kind=project&id='+r4project);await admin.getByLabel('New project name',{exact:true}).fill('R5 project copy');await admin.getByRole('button',{name:'Create project copy',exact:true}).click();await admin.waitForURL('**/dashboard/projects/*');await expect.poll(async()=>(await db.query("SELECT id FROM projects WHERE name='R5 project copy'")).rows[0]?.id).toBeTruthy();
  const r5project=(await db.query("SELECT id,is_private FROM projects WHERE name='R5 project copy'")).rows[0];assert.equal(r5project.is_private,true);assert.equal(Number((await db.query('SELECT count(*) n FROM project_members WHERE project_id=$1',[r5project.id])).rows[0].n),1);assert.equal(Number((await db.query("SELECT count(*) n FROM tasks WHERE project_id=$1 AND (status<>'todo' OR cardinality(assignee_ids)>0 OR recurrence<>'none')",[r5project.id])).rows[0].n),0);
  assert.equal(Number((await db.query('SELECT count(*) n FROM task_attachments a JOIN tasks t ON t.id=a.task_id WHERE t.project_id=$1',[r5project.id])).rows[0].n),0);
  await admin.goto(base+'/dashboard/calendar?date=2026-09-20&project='+r4project+'&assignee='+users[1].id);await expect(admin.getByRole('heading',{name:'Calendar',exact:true})).toBeVisible();await expect(admin.getByRole('link').filter({hasText:'R5 shared copy'})).toHaveCount(1);await admin.getByRole('link',{name:'Week',exact:true}).click();await expect(admin.getByRole('link',{name:'Week',exact:true})).toHaveAttribute('aria-current','page');
  for(const width of [375,430]){await admin.setViewportSize({width,height:932});await expect.poll(()=>admin.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await admin.screenshot({path:`/tmp/release5-calendar-${width}.png`,fullPage:true});}
  await admin.getByRole('button',{name:'Switch to dark mode',exact:true}).click();await admin.screenshot({path:'/tmp/release5-calendar-dark-430.png',fullPage:true});
  await admin.getByRole('link').filter({hasText:'R5 shared copy'}).click();await expect(admin.getByRole('dialog').getByRole('heading',{name:'R5 shared copy',exact:true})).toBeVisible();
  for(const width of [375,430]){await admin.setViewportSize({width,height:932});await admin.goto(base+'/dashboard/planning?kind=template&id='+templateId);await expect.poll(()=>admin.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await admin.screenshot({path:`/tmp/release5-planning-dark-${width}.png`,fullPage:true});}
  await admin.setViewportSize({width:1280,height:900});
  await admin.getByRole('button',{name:'Switch to light mode',exact:true}).click();await admin.screenshot({path:'/tmp/release5-planning-light-desktop.png',fullPage:true});
  console.log('Release 5 browser: menu copies, personal template save/use/outsider denial, shared assignments, reset approval/status, private project defaults, attachment exclusion, calendar filters/single shared task, task navigation and 375/430px layouts passed.');

  await db.query("INSERT INTO tasks(project_id,title,created_by,assignee_id,due_date) SELECT $1,'Scale specimen '||lpad(n::text,4,'0'),$2,$3,current_date+(n%30) FROM generate_series(1,1000)n",[r4project,users[0].id,users[3].id]);
  await admin.goto(base+'/dashboard/tasks?q=Scale&sort=title');await expect(admin.getByText('1000 matching tasks',{exact:false})).toBeVisible();await expect(admin.locator('tbody tr')).toHaveCount(25);
  const first=await admin.locator('tbody tr').first().innerText();await admin.getByRole('button',{name:'Next',exact:true}).click();await expect(admin.getByText('Page 2 of 40',{exact:true})).toBeVisible();assert.notEqual(await admin.locator('tbody tr').first().innerText(),first);
  const allDownload=admin.waitForEvent('download');await admin.getByRole('button',{name:'Export CSV',exact:true}).click();const exported=await allDownload;const stream=await exported.createReadStream();let csv='';for await(const chunk of stream)csv+=chunk;assert.equal((csv.match(/Scale specimen/g)||[]).length,1000);
  for(const width of [375,430]){await admin.setViewportSize({width,height:932});await expect.poll(()=>admin.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);}
  const timings=await Promise.all(pages.map(async p=>{const start=Date.now();await p.goto(base+'/dashboard/search?q=Scale');return Date.now()-start;}));console.log('Release 4 eight-session search timings (ms): '+JSON.stringify(timings));
  console.log('Release 4 browser: own remark editing/history, one mention alert, private search, schedule pause/future-only template, content-sniffed private preview, reports/export, 1,000 task pagination/full CSV and 375/430px overflow checks passed.');

  // Release A/B: synthetic update timings and an actual commit followed by response loss.
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[users[0].id]);
  const perfProject=(await db.query("SELECT create_workspace_project('Save performance QA','', $1::uuid[],true) id",[users.slice(1).map(u=>u.id)])).rows[0].id;
  const perfTask=(await db.query("INSERT INTO tasks(project_id,title,created_by,assignee_ids) VALUES($1,'Save benchmark',$2,$3::uuid[]) RETURNING id",[perfProject,users[0].id,users.slice(1).map(u=>u.id)])).rows[0].id;
  await db.query("SELECT set_config('request.jwt.claim.sub','',false)");
  async function openUpdates(page){await page.goto(base+`/dashboard/projects/${perfProject}?task=${perfTask}&discussion=true`);await expect(page.getByRole('heading',{name:'Task history',exact:true})).toBeVisible();await expect(page.getByText('Loading remarks…',{exact:true})).toHaveCount(0);}
  await openUpdates(admin);
  const saveTimings=[];let savePosts=0;const countSave=request=>{if(request.method()==='POST')savePosts++;};admin.on('request',countSave);
  for(let i=0;i<30;i++){
    await admin.getByLabel('Write a task update',{exact:true}).fill('Save timing '+i);
    const started=Date.now();await admin.getByRole('button',{name:'Post update',exact:true}).click();
    await expect(admin.getByRole('status').filter({hasText:'Saved.'})).toBeVisible();
    await expect(admin.getByLabel('Write a task update',{exact:true})).toHaveValue('');saveTimings.push(Date.now()-started);
  }
  admin.off('request',countSave);assert.equal(savePosts,30,'Each save should use one request without reloading the project or remarks');
  const sorted=[...saveTimings].sort((a,b)=>a-b);
  console.log('Release A confirmed-save timings: '+JSON.stringify({samples:30,medianMs:sorted[14],p95Ms:sorted[28],maxMs:sorted[29]}));
  await admin.getByLabel('Write a task update',{exact:true}).fill('Lost response QA');
  let intercepted=false;
  await admin.route('**/dashboard/projects/**',async route=>{if(!intercepted&&route.request().method()==='POST'&&(route.request().postData()||'').includes('Lost response QA')){intercepted=true;await route.fetch();await route.abort('failed');}else await route.continue();});
  await admin.getByRole('button',{name:'Post update',exact:true}).click();
  await expect(admin.getByRole('alert').filter({hasText:'Your draft is kept'})).toBeVisible();
  await expect(admin.getByLabel('Write a task update',{exact:true})).toHaveValue('Lost response QA');
  await admin.unroute('**/dashboard/projects/**');
  await admin.getByRole('button',{name:'Post update',exact:true}).click();await expect(admin.getByRole('status').filter({hasText:'Saved.'})).toBeVisible();
  assert.equal((await db.query("SELECT count(*)::int n FROM task_comments WHERE task_id=$1 AND content='Lost response QA'",[perfTask])).rows[0].n,1);
  await Promise.all(pages.map(openUpdates));
  const parallelSaves=await Promise.all(pages.map(async(page,n)=>{await page.getByLabel('Write a task update',{exact:true}).fill('Concurrent save '+n);const started=Date.now();await page.getByRole('button',{name:'Post update',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Saved.'})).toBeVisible();return Date.now()-started;}));
  console.log('Release A eight concurrent confirmed saves (ms): '+JSON.stringify(parallelSaves));
  assert.equal((await db.query("SELECT count(*)::int n FROM task_comments WHERE task_id=$1 AND content LIKE 'Concurrent save %'",[perfTask])).rows[0].n,8);
  // Notes and board remain reachable when the initial server route is table-only.
  await admin.goto(base+`/dashboard/projects/${perfProject}?view=table`);
  await expect(admin.getByRole('button',{name:'Save benchmark',exact:true})).toBeVisible();
  await admin.getByRole('button',{name:'Save benchmark',exact:true}).click();await expect(admin.getByRole('heading',{name:'Save benchmark',exact:true})).toBeVisible();
  await admin.getByRole('button',{name:'Close dialog'}).click();await admin.getByRole('button',{name:'Board',exact:true}).click();await expect(admin.getByRole('button',{name:'Open task: Save benchmark',exact:true})).toBeVisible();
  await db.query("INSERT INTO notifications(user_id,title,message) SELECT $1,'Pagination QA '||n,'Synthetic notice' FROM generate_series(1,65) n",[users[0].id]);
  await admin.goto(base+'/dashboard/notifications');await expect(admin.locator('article')).toHaveCount(50);await admin.getByRole('link',{name:'Next',exact:true}).click();await expect(admin.locator('article').first()).toBeVisible();
  console.log('Release A/B browser: draft retained after lost response, retry stored once, table-to-task/board and paginated notifications passed.');

  // Release C/D: private saved filters, guarded bulk edits and account preferences.
  await admin.goto(base+'/dashboard/tasks?project='+perfProject);
  await admin.getByText('Saved views',{exact:true}).click();
  await admin.getByLabel('Saved view name').fill('My delivery view');await admin.getByRole('button',{name:'Save current view',exact:true}).click();
  await expect(admin.getByRole('link',{name:'My delivery view',exact:true})).toBeVisible();
  await admin.reload();await admin.getByText('Saved views (1)',{exact:true}).click();await expect(admin.getByRole('link',{name:'My delivery view',exact:true})).toBeVisible();
  await member.goto(base+'/dashboard/tasks');await member.getByText('Saved views',{exact:true}).click();await expect(member.getByRole('link',{name:'My delivery view',exact:true})).toHaveCount(0);
  await admin.getByLabel('Select task Save benchmark',{exact:true}).check();await admin.getByRole('button',{name:'Bulk actions (1)',exact:true}).click();
  await admin.getByLabel('New deadline',{exact:true}).fill('2026-12-01');await admin.getByRole('button',{name:'Preview changes',exact:true}).click();
  await expect(admin.getByText('New deadline: 2026-12-01',{exact:true})).toBeVisible();await admin.getByRole('button',{name:'Confirm 1 changes',exact:true}).click();await expect(admin.getByText('Batch results',{exact:true})).toBeVisible();await expect(admin.getByText('Updated',{exact:true})).toBeVisible();await admin.getByRole('button',{name:'Done',exact:true}).click();
  assert.equal((await db.query('SELECT due_date::text due FROM tasks WHERE id=$1',[perfTask])).rows[0].due,'2026-12-01');
  await admin.goto(base+'/dashboard/notifications');await admin.getByRole('button',{name:'Notification settings',exact:true}).click();await admin.getByText('Notification preferences',{exact:true}).click();await admin.getByLabel('Deadline reminders per task',{exact:true}).selectOption('7');await admin.getByLabel('Mentions',{exact:true}).uncheck();await admin.getByRole('button',{name:'Save preferences',exact:true}).click();await expect(admin.getByText('Preferences saved.',{exact:true})).toBeVisible();
  await admin.reload();await admin.getByRole('button',{name:'Notification settings',exact:true}).click();await admin.getByText('Notification preferences',{exact:true}).click();await expect(admin.getByLabel('Deadline reminders per task',{exact:true})).toHaveValue('7');await expect(admin.getByLabel('Mentions',{exact:true})).not.toBeChecked();
  await admin.goto(base+'/dashboard/tasks?preset=delegated&q=Save%20benchmark');await expect(admin.getByRole('link',{name:'Save benchmark',exact:true})).toBeVisible();
  for(const width of [375,430,1280]){await admin.setViewportSize({width,height:932});await expect.poll(()=>admin.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await admin.screenshot({path:`/tmp/release5-cd-${width}.png`,fullPage:true,animations:'disabled'});}
  await admin.getByText('My account',{exact:true}).click();await expect(admin.getByRole('link',{name:'Change password',exact:true})).toBeVisible();
  console.log('Release C/D browser: private saved views persist, bulk preview/confirmation saves, notification settings persist, delegated quick view, account menu and 375/430/1280 widths passed.');
  // Email subscriptions are workspace-managed, without member controls.
  for(const page of [admin,member]){
   await page.goto(base+'/dashboard/notifications');
   await expect(page.getByRole('region',{name:'Workspace email notifications'})).toBeHidden();
   await page.getByRole('button',{name:'Notification settings',exact:true}).click();
   await expect(page.getByRole('region',{name:'Workspace email notifications'})).toBeVisible();
   await expect(page.getByRole('button',{name:'Save email preferences',exact:true})).toHaveCount(0);
   await expect(page.getByLabel('Receive email notifications',{exact:true})).toHaveCount(0);
  }
  assert.equal((await db.query('SELECT enabled FROM email_delivery_settings')).rows[0].enabled,false);
  assert.equal(Number((await db.query('SELECT count(*) n FROM profiles p LEFT JOIN email_preferences e ON e.user_id=p.id WHERE e.enabled IS DISTINCT FROM true')).rows[0].n),0);
  assert.equal(Number((await db.query('SELECT count(*) n FROM email_queue')).rows[0].n),0);
  await db.query("INSERT INTO notifications(user_id,task_id,title,message) VALUES($1,$2,'Task assigned','Notification layout sample')",[users[0].id,ownReview]);
  await admin.goto(base+'/dashboard/notifications');
  for(const width of [430,1280]){
   await admin.setViewportSize({width,height:932});
   await admin.evaluate(()=>document.documentElement.dataset.theme='dark');
   const article=admin.locator('article').filter({has:admin.getByRole('link',{name:'Open task',exact:true})}).first();
   const linkBox=await article.getByRole('link',{name:'Open task',exact:true}).boundingBox();
   const buttonBox=await article.getByRole('button',{name:/Mark as (unread|read)/}).boundingBox();
   assert.ok(linkBox&&buttonBox&&Math.abs(linkBox.y+linkBox.height/2-buttonBox.y-buttonBox.height/2)<2);
   assert.ok(await admin.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await admin.screenshot({path:`/tmp/release5-notifications-${width}.png`,fullPage:true});
  }
  await admin.setViewportSize({width:1440,height:1000});
  console.log('Managed email and compact notification settings; mobile/desktop action alignment passed.');


  // Glass appearance persists per account/browser, with opaque fallback and unclipped labels.
  await admin.goto(base+'/dashboard');
  await admin.getByRole('button',{name:'Customize background',exact:true}).click();
  await admin.getByRole('button',{name:'Coast',exact:true}).click();
  await admin.getByRole('checkbox',{name:'Reduce transparency',exact:true}).check();
  await expect(admin.locator('html')).toHaveAttribute('data-opaque-glass','true');
  await admin.getByRole('button',{name:'Close dialog',exact:true}).click();
  await admin.reload();
  await expect(admin.locator('html')).toHaveAttribute('data-opaque-glass','true');
  await admin.getByRole('button',{name:'Customize background',exact:true}).click();
  await expect(admin.getByRole('button',{name:'Coast',exact:true})).toHaveAttribute('aria-pressed','true');
  await admin.getByLabel('Background image',{exact:true}).setInputFiles({name:'background.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=','base64')});
  await expect(admin.getByRole('dialog',{name:'Personalize your workspace'}).getByRole('status')).toContainText('Saved for your account');
  await expect.poll(()=>admin.evaluate(()=>document.documentElement.style.getPropertyValue('--user-wallpaper').startsWith('url('))).toBe(true);
  await admin.getByRole('button',{name:'Reset background',exact:true}).click();
  await admin.getByRole('button',{name:'Close dialog',exact:true}).click();
  const projectNav=admin.locator('aside').getByRole('link',{name:'Projects',exact:true});
  await projectNav.hover();await expect(admin.getByRole('tooltip')).toHaveText('Projects');
  await expect(admin.getByRole('tooltip')).toBeVisible();
  await admin.keyboard.press('Escape');await expect(admin.getByRole('tooltip')).toBeHidden();
  await projectNav.focus();await expect(admin.getByRole('tooltip')).toBeVisible();
  await admin.keyboard.press('Tab');
  console.log('Glass appearance: upload, persistence, presets, reset, opacity and tooltip checks passed.');

  async function openDashboard(){
   const desktop=admin.locator('aside').getByRole('link',{name:'Dashboard',exact:true});
   await (await desktop.isVisible()?desktop:admin.locator('.workspace-mobile-nav').getByRole('link',{name:'Dashboard',exact:true})).click();
  }

  // Insights must aggregate all visible records under the requesting user's RLS.
  for(const index of [0,1,2]){
   const response=await contexts[index].request.get(base+'/api/dashboard-insights');assert.equal(response.status(),200);
   assert.match(response.headers()['cache-control'],/no-store/);const insights=await response.json();
   await db.query('BEGIN');await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[users[index].id]);await db.query('SET LOCAL ROLE authenticated');
   const visible=(await db.query('SELECT id FROM projects ORDER BY id')).rows.map(p=>p.id);
   const activeCount=Number((await db.query('SELECT count(*) n FROM tasks t JOIN projects p ON p.id=t.project_id WHERE NOT t.is_archived AND NOT p.is_archived')).rows[0].n);
   const taskRows=(await db.query('SELECT t.id,t.project_id,t.status,t.is_archived,t.due_date::text,t.assignee_ids,p.is_archived project_archived FROM tasks t JOIN projects p ON p.id=t.project_id')).rows;
   const eventCount=Number((await db.query("SELECT count(*) n FROM completion_events WHERE occurred_at>=($1::date::timestamp AT TIME ZONE 'Asia/Kolkata') AND occurred_at<(($1::date+interval '1 month')::timestamp AT TIME ZONE 'Asia/Kolkata')",[insights.month+'-01'])).rows[0].n);
   const activeRows=taskRows.filter(t=>!t.is_archived&&!t.project_archived);
   assert.equal(insights.overdue,activeRows.filter(t=>!['done','in_review'].includes(t.status)&&t.due_date&&t.due_date<insights.today).length);
   assert.equal(insights.trend.reduce((n,w)=>n+w.count,0),eventCount);
   for(const project of insights.projects){const tasks=taskRows.filter(t=>t.project_id===project.id);assert.equal(project.total,tasks.length);assert.equal(project.done,tasks.filter(t=>t.status==='done').length);}
   for(const person of insights.workload)assert.equal(person.count,activeRows.filter(t=>t.status!=='done'&&(person.id?t.assignee_ids.includes(person.id):!t.assignee_ids.length)).length);
   for(const date of insights.calendar)assert.equal(date.count,activeRows.filter(t=>t.status!=='done'&&t.due_date===date.day).length);
   assert.equal(insights.deadlineTotal,activeRows.filter(t=>t.status!=='done'&&t.due_date===insights.day).length);
   await db.query('ROLLBACK');
   assert.deepEqual(insights.projects.map(p=>p.id).sort(),visible.sort());
   assert.equal(insights.status.reduce((n,x)=>n+x.count,0),activeCount);
   if(index!==0){assert.equal(insights.isAdmin,false);assert.ok(insights.workload.every(p=>p.id===users[index].id));}
  }
  assert.equal((await contexts[0].request.get(base+'/api/dashboard-insights?month=2026-13')).status(),400);
  assert.equal((await contexts[0].request.get(base+'/api/dashboard-insights?month=2026-02&day=2026-02-30')).status(),400);
  const anonymous=await browser.newContext();assert.equal((await anonymous.request.get(base+'/api/dashboard-insights')).status(),401);await anonymous.close();
  await admin.goto(base+'/dashboard');await openDashboard();
  await expect(admin).toHaveURL(base+'/dashboard/insights');
  await expect(admin.getByRole('heading',{name:'Dashboard',exact:true})).toBeVisible();
  await expect(admin.getByRole('dialog')).toHaveCount(0);
  await expect(admin.getByText('Loading dashboard…',{exact:true})).toBeHidden();
  await expect(admin.getByRole('heading',{name:'Project health',exact:true})).toBeVisible();
  await admin.getByRole('button',{name:/Needs attention.*View projects|Needs attention.*Subset/}).click().catch(async()=>{await admin.locator('.insights-project-stats button').nth(2).click();});
  await expect(admin.getByRole('heading',{name:/Projects needing attention/})).toBeVisible();
  const calendarDate=admin.locator('.insights-calendar button[aria-pressed="false"]').first();
  await calendarDate.scrollIntoViewIfNeeded();const calendarScroll=await admin.evaluate(()=>window.scrollY);
  await calendarDate.click();await expect(admin.getByText('Loading dashboard…',{exact:true})).toHaveCount(0);
  await expect(admin.locator('.insights-agenda')).toHaveAttribute('aria-busy','false');
  assert.ok(Math.abs((await admin.evaluate(()=>window.scrollY))-calendarScroll)<8,'Selecting a dashboard date must preserve scroll');
  await admin.getByRole('button',{name:'Next month',exact:true}).click();await expect(admin.getByText('Loading dashboard…',{exact:true})).toBeHidden();
  await expect(admin.getByRole('heading',{name:'Completion trend',exact:true})).toBeVisible();
  await expect(admin.locator('.insights-bars')).toHaveAttribute('aria-busy','false');
  const buckets=await admin.locator('.insights-bars>div').count();assert.ok(buckets>=4&&buckets<=6);
  for(const value of await admin.locator('.insights-bars>div>span').evaluateAll(nodes=>nodes.map(n=>n.style.height)))assert.ok(Number.isFinite(parseFloat(value)));
  const statLinks=admin.locator('section[aria-label="Task insights"] .insights-stat');
  for(const [i,summary] of ['', 'pending','overdue','done'].entries())await expect(statLinks.nth(i)).toHaveAttribute('href','/dashboard/tasks'+(summary?'?summary='+summary:''));

  await admin.goto(base+'/dashboard');
  await admin.route('**/api/dashboard-insights?*',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Temporary test error'})}));
  await openDashboard();await expect(admin.locator('.insights-page').getByRole('alert')).toContainText('Temporary test error');
  await admin.unroute('**/api/dashboard-insights?*');await admin.getByRole('button',{name:'Retry dashboard',exact:true}).click();await expect(admin.getByRole('heading',{name:'Project health',exact:true})).toBeVisible();await admin.goto(base+'/dashboard');
  console.log('Dashboard insights: RLS, aggregate counts, member workload scope, validation, calendar and retry passed.');

  await admin.getByRole('button',{name:'Filter projects',exact:true}).click();
  await admin.getByLabel('Search projects',{exact:true}).fill('View controls QA B');
  await expect(admin.locator('[data-project-id]')).toHaveCount(1);
  await admin.getByRole('button',{name:'Clear filters',exact:true}).click();
  await admin.getByLabel('Created by',{exact:true}).selectOption(users[0].id);
  await expect(admin.getByText('Filters applied',{exact:false})).toBeVisible();
  await admin.getByRole('button',{name:'Clear filters',exact:true}).click();
  await admin.getByRole('button',{name:'Filter projects',exact:true}).click();
  await admin.getByRole('button',{name:'Help and tutorial',exact:true}).click();
  await expect(admin.getByRole('dialog',{name:'TaskTracker help',exact:true})).toBeVisible();
  for(let step=0;step<4;step++)await admin.getByRole('button',{name:'Next',exact:true}).click();
  await admin.getByRole('button',{name:'Finish tutorial',exact:true}).click();
  await expect(admin.getByRole('button',{name:'Start tutorial',exact:true})).toHaveCount(0);
  console.log('Dashboard scroll preservation, project filters and first-time tutorial passed.');

  // Theme changes must not remove controls or change action/field state.
  async function themeControls(theme){
   await admin.evaluate(value=>document.documentElement.dataset.theme=value,theme);
   return admin.locator('button,a,input,select,textarea,summary,[role="button"]').evaluateAll(elements=>elements.map(e=>{
    const r=e.getBoundingClientRect(),s=getComputedStyle(e);
    return {tag:e.tagName,name:(e.getAttribute('aria-label')||e.textContent||'').trim().replace(/Switch to (light|dark) mode/,'Theme toggle'),href:e.getAttribute('href'),type:e.getAttribute('type'),disabled:e.matches(':disabled'),visible:r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none',pointer:s.pointerEvents,value:'value' in e?e.value:null};
   }));
  }
  const contrastFailures=[];
  async function auditLight(label,width){
   for(const theme of ['light','dark']){
    await themeControls(theme);
    await admin.waitForTimeout(250); // Measure the settled theme after control transitions.
    const result=await new AxeBuilder({page:admin}).withRules(['color-contrast']).analyze();
    for(const v of result.violations)contrastFailures.push({width,theme,route:label,id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))});
   }
   await themeControls('light');
  }
  for(const width of [430,1440]){
   await admin.setViewportSize({width,height:1000});
   for(const route of ['/dashboard','/dashboard/my-tasks','/dashboard/tasks','/dashboard/calendar','/dashboard/reports','/dashboard/templates','/dashboard/archive','/dashboard/workload','/admin/users','/dashboard/notifications',projectURL.replace(base,'')+'?task='+r4task+'&discussion=true']){
    await admin.goto(base+route);await expect(admin.locator('.workspace-main')).toBeVisible();await admin.evaluate(()=>document.fonts.ready);
    if(route.includes('discussion=true')){await expect(admin.getByLabel('Write a task update',{exact:true})).toBeVisible();await expect(admin.getByText('Loading remarks…',{exact:true})).toBeHidden();}
    await expect(async()=>{assert.deepEqual(await themeControls('light'),await themeControls('dark'),`Theme controls differ: ${width} ${route}`);}).toPass({timeout:10000});
    await auditLight(route,width);
    if(width===1440&&['/dashboard/tasks','/dashboard/my-tasks'].includes(route)){
     const isMine=route.includes('my-tasks');
     const expected=(await db.query(`SELECT t.status,t.due_date::text FROM tasks t JOIN projects p ON p.id=t.project_id WHERE NOT t.is_archived AND NOT p.is_archived AND (NOT $1::boolean OR $2::uuid=ANY(t.assignee_ids))`,[isMine,users[0].id])).rows;
     const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
     for(const id of ['overdue','today','in_progress','in_review','done']){
      const count=expected.filter(t=>id==='overdue'?!['done','in_review'].includes(t.status)&&t.due_date&&t.due_date<today:id==='today'?!['done','in_review'].includes(t.status)&&t.due_date===today:t.status===id).length;
      const card=admin.locator(`.overview-cards [data-summary="${id}"]`);
      await expect(card.locator('.text-3xl')).toHaveText(String(count));
      await expect(card).toHaveAttribute('href',`${route}?summary=${id}`);
     }
    }
    if(['/dashboard','/dashboard/tasks','/dashboard/my-tasks','/dashboard/archive','/dashboard/workload'].includes(route)){
     const pageName=route==='/dashboard'?'projects':route.split('/').at(-1);
     for(const theme of ['light','dark']){
      await themeControls(theme);
      // Theme CSS transitions take 180ms; avoid awaiting paused background animations.
      await admin.waitForTimeout(250);
      await expect(admin.getByText('Loading tasks…',{exact:true})).toBeHidden({timeout:10000});
      await admin.screenshot({path:`/tmp/release5-overview-${pageName}-${theme}-${width}.png`,fullPage:true});
     }
     await themeControls('light');
    }
    if(route==='/dashboard'){
     await themeControls('light');await admin.screenshot({path:`/tmp/release5-light-theme-${width}.png`,fullPage:true});
     await admin.getByRole('button',{name:'Grid view',exact:true}).click();
     for(const name of ['Sort projects','Grid size']){
      await admin.getByRole('button',{name,exact:true}).click();
      await expect(admin.getByRole('menu',{name,exact:true})).toBeVisible();
      await auditLight(name,width);
      await admin.keyboard.press('Escape');
     }
     await openDashboard();
     await expect(admin.getByRole('heading',{name:'Project health',exact:true})).toBeVisible();
     await auditLight('Dashboard insights',width);
     for(const theme of ['light','dark']){await themeControls(theme);await admin.waitForTimeout(250);await admin.screenshot({path:`/tmp/release5-insights-${theme}-${width}.png`,fullPage:true});}
     assert.ok(await admin.locator('.insights-page').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Dashboard must not overflow horizontally');
     await admin.goto(base+'/dashboard');await themeControls('light');
     await admin.getByRole('button',{name:'New Project',exact:true}).click();
     await expect(admin.getByRole('heading',{name:'Create new project',exact:true})).toBeVisible();
     await auditLight('Create project form and member picker',width);
     await admin.screenshot({path:`/tmp/release5-light-form-${width}.png`,fullPage:true});
     await admin.keyboard.press('Escape');
    }
   }
  }
  for(const route of ['/','/login']){await admin.goto(base+route);await auditLight(route,1440);}
  console.log('CONTRAST_AUDIT '+JSON.stringify(contrastFailures));
  assert.deepEqual(contrastFailures,[],'Light-mode contrast failures');
  console.log('Light/dark control parity: 11 pages including task drawer, at phone and desktop widths; names, destinations, visibility, enabled state and field values match.');
  await admin.goto(base+'/dashboard');
  await admin.goto(projectURL+'?view=board');
  await admin.getByRole('button',{name:'Collapse Done column',exact:true}).click();
  await expect(admin.locator('.board-column[data-status="done"]')).toHaveAttribute('data-collapsed','true');
  await admin.getByRole('button',{name:'Expand Done column',exact:true}).click();
  await admin.setViewportSize({width:1440,height:1000});
  await admin.locator('aside').getByRole('link',{name:'Projects',exact:true}).click();
  await expect(admin).toHaveURL(base+'/dashboard');
  await expect(admin.locator('aside .workspace-back-pill')).toBeVisible();
  await admin.screenshot({path:'/tmp/release5-split-navigation-desktop.png',fullPage:false});
  await admin.setViewportSize({width:430,height:932});
  await expect(admin.locator('.workspace-mobile-nav summary')).toHaveCount(0);
  await expect(admin.locator('.workspace-header').getByRole('button',{name:'Go back',exact:true})).toBeVisible();
  await expect(admin.locator('.workspace-mobile-nav a')).toHaveCount(10);
  await expect(admin.locator('.workspace-header .workspace-search-pill')).toBeVisible();
  await expect(admin.locator('.workspace-page-heading').getByRole('button',{name:'Go back'})).toHaveCount(0);
  await admin.locator('.app-footer').scrollIntoViewIfNeeded();
  await admin.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
  const geometry=await admin.evaluate(()=>({gap:document.documentElement.scrollHeight-(document.querySelector('.app-footer').getBoundingClientRect().bottom+window.scrollY),top:document.querySelector('.workspace-header').getBoundingClientRect().top,radius:getComputedStyle(document.querySelector('.workspace-header')).borderTopLeftRadius}));
  assert.ok(geometry.gap<=32,'No excessive space after footer');assert.ok(Math.abs(geometry.top-10)<2,'Wallpaper gap remains above the sticky header');assert.equal(geometry.radius,'22px');
  await admin.screenshot({path:'/tmp/release5-rounded-header-scrolled-430.png',fullPage:false});
  await admin.getByRole('button',{name:'Support via UPI',exact:true}).click();
  await expect(admin.getByRole('dialog')).toContainText('naidu.aishwarya9-1@okhdfcbank');
  await expect(admin.getByRole('link',{name:'Open UPI app'})).toHaveAttribute('href',/upi:\/\/pay\?pa=naidu\.aishwarya9-1%40okhdfcbank/);
  await admin.getByRole('button',{name:'Close dialog',exact:true}).click();
  await admin.setViewportSize({width:1440,height:1000});
  await admin.locator('aside').getByRole('link',{name:'All Tasks',exact:true}).click();
  await expect(admin).toHaveURL(base+'/dashboard/tasks');await admin.getByRole('button',{name:'Go back',exact:true}).click();await expect(admin).toHaveURL(base+'/dashboard');
  // Preview adjustable transparency using the real appearance controls; no production defaults changed.
  await admin.goto(base+'/dashboard');await expect(admin.getByRole('heading',{name:'Projects',exact:true})).toBeVisible();
  for(const theme of ['dark','light']){
   await themeControls(theme);
   for(const level of [10,25,40]){
    await admin.getByRole('button',{name:'Customize background',exact:true}).click();
    await admin.getByRole('button',{name:'Aurora',exact:true}).click();
    await admin.getByRole('checkbox',{name:'Reduce transparency',exact:true}).uncheck();
    const slider=admin.getByRole('slider',{name:'Window transparency',exact:true});
    await slider.press('Home');for(let step=0;step<level/5;step++)await slider.press('ArrowRight');
    await expect(slider).toHaveValue(String(level));
    await admin.getByRole('button',{name:'Close dialog',exact:true}).click();
    await expect.poll(()=>admin.evaluate(()=>document.documentElement.style.getPropertyValue('--window-opacity'))).toBe(String(1-level/100));
    const transparencyContrast=await new AxeBuilder({page:admin}).withRules(['color-contrast']).analyze();
    assert.deepEqual(transparencyContrast.violations,[],`Transparency contrast ${theme} ${level}`);
    await admin.screenshot({path:`/tmp/release5-transparency-${theme}-${level}.png`,fullPage:false});
   }
  }
  await admin.reload();await admin.getByRole('button',{name:'Customize background',exact:true}).click();
  await expect(admin.getByRole('slider',{name:'Window transparency',exact:true})).toHaveValue('40');
  await admin.screenshot({path:'/tmp/release5-transparency-settings.png',fullPage:false});
  await admin.getByRole('checkbox',{name:'Reduce transparency',exact:true}).check();
  await expect(admin.getByRole('slider',{name:'Window transparency',exact:true})).toBeDisabled();
  assert.equal(await admin.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--effective-window-opacity').trim()),'1');
  await admin.getByRole('button',{name:'Reset background',exact:true}).click();
  await expect(admin.getByRole('slider',{name:'Window transparency',exact:true})).toHaveValue('25');
  await admin.getByRole('button',{name:'Close dialog',exact:true}).click();
  await admin.goto(base+'/dashboard/history');
  await expect(admin.getByRole('heading',{name:'History',exact:true})).toBeVisible();
  const historyRows=admin.locator('section[aria-label="Recent workspace history"] article');
  assert.equal(await historyRows.count(),20);
  await historyRows.first().locator('summary').click();await expect(historyRows.first().locator('dl')).toBeVisible();
  await admin.getByLabel('Search recent history').fill('no-such-audit-event-xyz');await expect(historyRows).toHaveCount(0);
  await admin.getByRole('button',{name:'Reset',exact:true}).click();await expect(historyRows).toHaveCount(20);
  for(const width of [430,1440]){
   await admin.setViewportSize({width,height:1000});
   for(const theme of ['light','dark']){await themeControls(theme);await admin.waitForTimeout(100);assert.ok(await admin.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await admin.screenshot({path:`/tmp/release5-history-${theme}-${width}.png`,fullPage:true});}
  }
  await admin.getByText('My account',{exact:true}).click();await admin.getByRole('button',{name:'Sign out',exact:true}).click();await expect(admin).toHaveURL(base+'/');
  assert.equal(external.length,0,'Staging must not contact Supabase');
  console.log('Eight browser logins, private project, task assignment, local upload/download, outsider denial, review and admin approval passed against PostgreSQL 16.');
}finally{await browser.close();await db.end();}
