/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),ts=require('typescript');
const m={exports:{}};new Function('exports',ts.transpileModule(fs.readFileSync('src/lib/task-route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(m.exports);
const {taskRouteFilters,taskRequestKey}=m.exports;
test('server route filters and client request keys share defaults and explicit scope',()=>{
 const filters=taskRouteFilters({summary:'overdue',q:'launch',mine:'true',page:'2'});
 assert.equal(filters.page,2);assert.equal(filters.mine,true);
 assert.equal(taskRequestKey(filters),taskRequestKey({q:'launch',summary:'overdue',mine:true,assignee:'all',sort:'deadline',priority:'all',status:'all',archived:false,preset:'all'}));
 assert.equal(taskRouteFilters({mine:'false'},true).mine,true);
 assert.equal(taskRouteFilters({page:'invalid',project:'not-a-project',assignee:'not-a-user'}).project,undefined);
 assert.equal(taskRouteFilters({q:'x'.repeat(300)}).q.length,200);
});
