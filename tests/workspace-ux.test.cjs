/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const m={exports:{}};new Function('exports',ts.transpileModule(fs.readFileSync('src/lib/task-views.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(m.exports);
test('saved views accept only supported filters, not paths, identities or SQL',()=>{assert.deepEqual(m.exports.cleanView({preset:'review',q:'hello',user_id:'other',url:'https://evil.test',sort:'DROP TABLE tasks',project:'bad'}),{preset:'review',q:'hello'});assert.throws(()=>m.exports.cleanView([]));assert.equal(m.exports.cleanView({q:'x'.repeat(500)}).q.length,200);});
test('stale labels share the India-day boundary and omit completed tasks',()=>{assert.equal(m.exports.activityLabel('2026-09-07T20:00:00Z','2026-09-15','todo'),'No update for 7 days');assert.equal(m.exports.activityLabel('2026-09-08T20:00:00Z','2026-09-15','todo'),null);assert.equal(m.exports.activityLabel('2026-08-01T00:00:00Z','2026-09-15','done'),null);assert.equal(m.exports.activityLabel('invalid','2026-09-15','todo'),null);});
test('reset removes every task filter but preserves route and display settings',()=>{
 const params=new URLSearchParams('q=hello&summary=overdue&assignee=unassigned&priority=high&project=abc&status=blocked&preset=review&mine=true&sort=priority&page=3&creator=on&taskLayout=rows&view=table&tab=tasks');
 assert.deepEqual(Object.fromEntries(m.exports.clearTaskFilterParams(params)),{creator:'on',taskLayout:'rows',view:'table',tab:'tasks'});
 assert.equal(params.get('q'),'hello','Reset must not mutate its input');
});
test('all narrowing filters including legacy status and saved mine scope have visible chips',()=>{
 const input={q:'hello',summary:'today',assignee:'person',priority:'urgent',project:'project',status:'blocked',preset:'delegated',mine:'true'};
 const chips=m.exports.activeTaskFilterChips(input,{people:{person:'Alex'},projects:{project:'Launch'}});
 assert.deepEqual(new Set(chips.map(c=>c.key)),new Set(Object.keys(input)));
 assert.ok(chips.some(c=>c.label==='Also assigned to: Alex'));
 const scoped=m.exports.activeTaskFilterChips(input,{mine:true,projectId:'project'});
 assert.ok(!scoped.some(c=>c.key==='mine'||c.key==='project'),'Page scopes cannot be removed by filter chips');
});
test('saved filters retain the same task scope when encoded into a URL',()=>{
 const filters={q:'Shared launch',summary:'overdue',assignee:'00000000-0000-4000-8000-000000000001',priority:'high',project:'00000000-0000-4000-8000-000000000002',status:'in_progress',preset:'delegated',mine:'true',sort:'priority',creator:'on'};
 const saved=m.exports.cleanView(filters);
 assert.deepEqual(m.exports.cleanView(Object.fromEntries(new URLSearchParams(saved))),filters);
 assert.deepEqual(m.exports.activeTaskFilterChips(saved),m.exports.activeTaskFilterChips(filters));
});
