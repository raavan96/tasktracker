/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');const path=require('node:path');
const moduleData={exports:{}};
new Function('exports',ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/task-presentation.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(moduleData.exports);
const {todayKey,deadlineLabel,matchesSummary,makeCsv}=moduleData.exports;
test('deadlines and summary use India date at UTC boundary',()=>{assert.equal(todayKey(new Date('2026-09-10T19:00:00Z')),'2026-09-11');assert.equal(deadlineLabel('2026-09-12','todo','2026-09-11'),'Due tomorrow');assert.equal(deadlineLabel('2026-09-09','todo','2026-09-11'),'2 days overdue');assert.equal(matchesSummary({status:'done',due_date:'2026-09-09'},'overdue','2026-09-11'),false);});
test('CSV quotes delimiters/newlines and neutralizes formulas',()=>{const csv=makeCsv([['=SUM(A1:A2)','a,"b"\nc','@cmd','normal']]);assert.ok(csv.includes("'=SUM"));assert.ok(csv.includes('a,""b""\nc'));assert.ok(csv.includes("'@cmd"));assert.ok(csv.startsWith('\uFEFF'));});

test('review summary includes only tasks submitted for approval',()=>{assert.equal(matchesSummary({status:'in_review',due_date:null},'in_review','2026-09-11'),true);assert.equal(matchesSummary({status:'done',due_date:null},'in_review','2026-09-11'),false);});
