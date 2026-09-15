import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groupByVan} from '../src/materials/vans';
import {render,jobDescription,type WorkGroup} from '../src/materials/render';
import {runVanDay,type VanDeps} from '../src/runs/vans';
import {RunStore} from '../src/runs/store';
import {VAN_SCHEMA} from '../src/runs/van-schema';
import {database} from './helpers';
const group=(names:string[]):WorkGroup=>({key:'Job #44',visits:[{id:'v',title:'Long scope',startAt:'2026-09-14T15:00:00Z',endAt:null,visitStatus:'TODAY',instructions:null,client:null,property:null,job:null,assignedUsers:{nodes:names.map(name=>({id:name,name:{full:name}})),pageInfo:{hasNextPage:false,endCursor:null}}}],analysis:{materials:[{name:'EMT',specification:'3/4 inch',quantity:150,unit:'ft',classification:'REQUIRED',procurement:'NEED TO BUY',evidence:[{sourceId:'private-id',excerpt:'source quote'}],reason:'verbose reasoning',uncertainties:[]}],warnings:[]}});
test('vans absorb floating Curren; solo Curren stays separate; shared jobs retain full quantities on both vans',()=>{
 const groups=groupByVan([group(['Tim Wheyland','Curren Provost']),group(['Niall Smith']),group(['Curren Provost'])]);
 assert.equal(groups.tim.length,1);assert.equal(groups.niall.length,1);assert.equal(groups.curren.length,1);
 const shared=groupByVan([group(['Tim Wheyland','Niall Smith'])]);
 assert.equal(shared.tim[0].analysis.materials[0].quantity,150);
 assert.equal(shared.niall[0].analysis.materials[0].quantity,150);
 assert.equal(shared.tim[0].analysis.materials[0].classification,'REQUIRED');
 assert.deepEqual(shared.tim[0].analysis.materials,shared.niall[0].analysis.materials);
 assert.match(render('2026-09-14',shared.tim,''),/job total/);
 const text=render('2026-09-14',groups.tim,'',"Tim’s Van");
 assert.match(text,/150 ft/);assert.ok(!text.includes('private-id'));assert.ok(!text.includes('verbose reasoning'));
});
test('two van events are independently durable across concurrency, failure and retries',async()=>{
 const {db,query}=await database();try{
  await db.exec(VAN_SCHEMA);
  const counts={tim:0,niall:0};let fail=true;
  const deps:VanDeps={legacy:new RunStore(query,'a'),store:v=>new RunStore(query,'a',v),writesEnabled:true,maxDescription:20000,
   collect:async()=>[group(['Tim Wheyland']),group(['Niall Smith'])],
   create:async(v)=>{counts[v]++;if(v==='niall'&&fail)throw new Error('EVENT_OUTCOME_UNCERTAIN');return v+'-event';}};
  await Promise.all([runVanDay('2026-09-14',false,deps),runVanDay('2026-09-14',false,deps)]);
  assert.deepEqual(counts,{tim:1,niall:1});
  assert.equal((await deps.store('tim').get('2026-09-14')).state,'created');
  assert.equal((await deps.store('niall').get('2026-09-14')).state,'uncertain');
  fail=false;await runVanDay('2026-09-14',false,deps);assert.deepEqual(counts,{tim:1,niall:1});
  await deps.store('niall').reconcile('2026-09-14','niall-recovered');
  assert.equal((await deps.store('tim').get('2026-09-14')).event_id,'tim-event');
  let reads=0;deps.collect=async()=>{reads++;return [group(['Curren Provost'])];};
  const preview=await runVanDay('2026-09-15',true,deps);
  assert.equal(reads,1);assert.equal(preview.sections?.length,3);
  assert.equal(await deps.store('tim').get('2026-09-15'),null);
 }finally{await db.close();}
});

test('van migration is repeatable, legacy events block writes, and preview works with writes disabled',async()=>{
 const {db,query}=await database();try{
  await db.exec(VAN_SCHEMA);await db.exec(VAN_SCHEMA);
  const deps:VanDeps={legacy:new RunStore(query,'a'),store:v=>new RunStore(query,'a',v),writesEnabled:false,maxDescription:20000,collect:async()=>[],create:async()=>{throw new Error('unexpected write');}};
  await assert.rejects(runVanDay('2026-09-14',false,deps),/EVENT_WRITES_DISABLED/);
  assert.equal((await runVanDay('2026-09-14',true,deps)).sections?.length,2);
  deps.writesEnabled=true;
  await deps.legacy.claim('2026-09-14','00000000-0000-4000-8000-000000000001');
  await assert.rejects(runVanDay('2026-09-14',false,deps),/LEGACY_DAILY_EVENT_REVIEW_REQUIRED/);
 }finally{await db.close();}
});


test('brief job descriptions use Jobber wording and stay above materials',()=>{
 const g=group(['Tim Wheyland']);
 g.visits[0].instructions='Install conduit on the roof and wire the bidet.';
 const text=render('2026-09-14',[g],'');
 assert.match(text,/Work: Install conduit on the roof and wire the bidet\./);
 assert.ok(text.indexOf('Work:')<text.indexOf('150 ft'));
 g.visits[0].instructions='Install conduit. '.repeat(30);
 assert.ok(jobDescription([g]).length<=200);
 assert.ok(jobDescription([g]).endsWith('…'));
 g.visits[0].instructions=null;g.visits[0].title=null;
 assert.equal(jobDescription([g]),'See Jobber for work details.');
});
