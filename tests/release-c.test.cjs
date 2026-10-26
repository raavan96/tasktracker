/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),ts=require('typescript');
function read(path){const exports={};new Function('exports',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(exports);return exports;}
const {parseRemarkDraft,draftMatchesSaved,remarkDraftKey}=read('src/lib/remark-draft.ts');
const {validLandingPage}=read('src/lib/workspace-preferences.ts');
const {workspaceDate,workspaceTimestamp,taskStatusLabels}=read('src/lib/task-presentation.ts');
const user='00000000-0000-0000-0000-000000000001',task='00000000-0000-0000-0000-000000000002',id='00000000-0000-0000-0000-000000000003',now=Date.parse('2026-10-26T06:00:00Z');
const draft={version:1,userId:user,taskId:task,text:'Long update',mentions:[],editing:null,request:{key:'save',id},updatedAt:now};
test('remark recovery isolates accounts/tasks, rejects expired or malformed drafts',()=>{
 assert.equal(parseRemarkDraft(JSON.stringify(draft),user,task,now).request.id,id);
 assert.equal(parseRemarkDraft(JSON.stringify(draft),id,task,now),null);
 assert.equal(parseRemarkDraft(JSON.stringify(draft),user,id,now),null);
 assert.equal(parseRemarkDraft(JSON.stringify(draft),user,task,now+8*86400000),null);
 assert.equal(parseRemarkDraft(JSON.stringify({...draft,mentions:['not-a-uuid']}),user,task,now),null);
 assert.equal(parseRemarkDraft(JSON.stringify({...draft,request:{key:'save',id:'invalid'}}),user,task,now),null);
 assert.equal(parseRemarkDraft('{broken',user,task,now),null);
 assert.notEqual(remarkDraftKey(user,task),remarkDraftKey(id,task));
});
test('already-saved recovery matches the precise request or edit version and contents',()=>{
 const item={id,content:'Long update',mentions:[],edit_version:0};
 assert.equal(draftMatchesSaved(draft,item),true);
 assert.equal(draftMatchesSaved(draft,{...item,id:task}),false);
 assert.equal(draftMatchesSaved(draft,{...item,content:'A subsequent change'}),false);
 const edit={...draft,editing:{id,edit_version:4}};
 assert.equal(draftMatchesSaved(edit,{...item,edit_version:5}),true);
 assert.equal(draftMatchesSaved(edit,{...item,edit_version:6}),false);
});
test('start pages cannot become an external or arbitrary redirect',()=>{
 assert.equal(validLandingPage('/dashboard/my-tasks'),'/dashboard/my-tasks');
 for(const input of ['https://example.com','//example.com','/admin/users','/dashboard?unsafe=true',null])assert.equal(validLandingPage(input),'/dashboard');
});
test('shared date/status text uses calendar dates and exact India timestamps',()=>{
 assert.equal(workspaceDate('2026-10-26'),'26 Oct 2026');
 assert.match(workspaceTimestamp('2026-10-25T20:00:00Z'),/26 Oct 2026, 1:30:00 am IST/);
 assert.equal(workspaceTimestamp('invalid'),'Time unavailable');
 assert.equal(taskStatusLabels.done,'Completed');assert.equal(taskStatusLabels.todo,'To do');
});
