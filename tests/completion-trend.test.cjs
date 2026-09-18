/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
const output={};new Function('exports',ts.transpileModule(fs.readFileSync('src/lib/completion-trend.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(output);
const {completionWeeks}=output;
test('single active week retains all September buckets and clips month boundaries',()=>{
 const weeks=completionWeeks('2026-09',[{week:'2026-09-14',count:6}]);
 assert.deepEqual(weeks.map(w=>w.count),[0,0,6,0,0]);
 assert.equal(weeks[0].week,'2026-08-31');assert.equal(weeks[0].start,'2026-09-01');assert.equal(weeks[4].end,'2026-09-30');
});
test('empty month, six-week month and leap year produce finite zero-safe buckets',()=>{
 assert.equal(completionWeeks('2026-02',[]).length,5);
 assert.equal(completionWeeks('2026-03',[]).length,6);
 const leap=completionWeeks('2028-02',[]);assert.equal(leap.at(-1).end,'2028-02-29');assert.ok(leap.every(w=>w.count===0));
});
test('boundary week keeps supplied event counts without adding adjacent-month buckets',()=>{
 const weeks=completionWeeks('2026-09',[{week:'2026-08-31',count:2},{week:'2026-09-28',count:3},{week:'2026-10-05',count:99}]);
 assert.equal(weeks.reduce((sum,w)=>sum+w.count,0),5);
});
