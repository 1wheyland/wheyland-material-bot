import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAnalysis,type Material } from '../src/materials/classify';
import { aggregate,render,type WorkGroup } from '../src/materials/render';
import { sourcesFor,type Source } from '../src/materials/sources';
import type { Visit } from '../src/jobber/data';
const source:Source={id:'line:1',priority:2,kind:'job line',text:'20A GFCI',quantity:1,optional:false};
const material=():Material=>({name:'GFCI',specification:'20A',quantity:1,unit:'each',classification:'REQUIRED',procurement:'VERIFY',evidence:[{sourceId:source.id,excerpt:source.text}],reason:'Explicit material line.',uncertainties:[]});
test('fabricated evidence fails and optional-only or inferred materials cannot be required',()=>{
 const m=material();m.evidence[0].excerpt='not real';assert.throws(()=>validateAnalysis({materials:[m],warnings:[]},[source]),/AI_INVALID_EVIDENCE/);
 assert.equal(validateAnalysis({materials:[material()],warnings:[]},[{...source,optional:true}]).materials[0].classification,'VERIFY');
 const guessed=material();guessed.evidence=[];
 const safe=validateAnalysis({materials:[guessed],warnings:[]},[]).materials[0];
 assert.equal(safe.classification,'VERIFY');assert.equal(safe.quantity,null);assert.equal(safe.specification,null);
});
test('unsupported quantities, exact specifications and supplier certainty are removed',()=>{
 const m=material();m.quantity=20;m.specification='30A';m.procurement='CED';
 const safe=validateAnalysis({materials:[m],warnings:[]},[source]).materials[0];
 assert.equal(safe.quantity,null);assert.equal(safe.specification,null);assert.equal(safe.procurement,'VERIFY');
});
const visit:Visit={id:'v',title:'Replace GFCI',startAt:'2026-09-14T15:00:00Z',endAt:null,visitStatus:'SCHEDULED',instructions:null,
 assignedUsers:{nodes:[{id:'u1',name:{full:'Alex'}},{id:'u2',name:{full:'Sam'}}],pageInfo:{hasNextPage:false,endCursor:null}},client:null,property:null,
 job:{id:'j',jobNumber:1,title:null,instructions:null,jobStatus:'active'}};
test('crew assignments do not multiply shared buying quantities',()=>{
 const group:WorkGroup={key:'Job #1',visits:[visit,{...visit,id:'v2'}],analysis:{materials:[material()],warnings:[]}};
 assert.equal(aggregate([group])[0].quantity,1);
 const text=render('2026-09-14',[group],'ref');assert.match(text,/EMPLOYEE: Alex/);assert.match(text,/EMPLOYEE: Sam/);
 assert.match(text,/VERIFY STOCK/);assert.match(text,/Material Bot reference: ref/);
 assert.match(text,/8:00 AM/);assert.ok(!text.includes('15:00:00Z'));
});
test('units and different specifications never combine; unknown quantities remain unknown',()=>{
 const g=(key:string,m:Material):WorkGroup=>({key,visits:[visit],analysis:{materials:[m],warnings:[]}});
 assert.equal(aggregate([g('1',material()),g('2',{...material(),unit:'box'})]).length,2);
 assert.equal(aggregate([g('1',material()),g('2',{...material(),specification:'15A'})]).length,2);
 assert.equal(aggregate([g('1',material()),g('2',{...material(),quantity:null})])[0].quantity,null);
});
test('empty custom rules do not invent Wheyland standards',()=>{
 assert.equal(sourcesFor([visit],null,[]).some(s=>s.priority===6),false);
});
