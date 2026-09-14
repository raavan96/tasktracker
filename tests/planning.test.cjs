/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const helpers={};new Function('exports',ts.transpileModule(fs.readFileSync('src/lib/planning-types.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(helpers);
test('Calendar dates handle year boundaries, leap years and invalid input',()=>{
 assert.equal(helpers.validDate('2026-02-30'),false);assert.equal(helpers.validDate('2026-99-99'),false);assert.equal(helpers.validDate('2024-02-29'),true);
 assert.deepEqual(helpers.calendarRange('2026-01-03','month'),{from:'2025-12-29',to:'2026-02-01'});
 assert.deepEqual(helpers.calendarRange('2026-12-31','week'),{from:'2026-12-28',to:'2027-01-03'});
 assert.equal(helpers.shiftDate('2024-02-28',1),'2024-02-29');assert.equal(helpers.shiftDate('2026-12-31',1),'2027-01-01');
 assert.throws(()=>helpers.calendarRange('nonsense','month'));
});
