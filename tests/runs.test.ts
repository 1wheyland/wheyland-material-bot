import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { database } from './helpers';
import { RunStore } from '../src/runs/store';
import { runDay,type RunDeps } from '../src/runs/engine';
test('concurrent SQL claims create one event; reruns remain blocked',async()=>{
 const {db,query}=await database();try {
  const store=new RunStore(query,'a');let writes=0;
  const deps:RunDeps={store,collect:async()=>[],create:async()=>{writes++;return 'event1';},writesEnabled:true,maxDescription:20000};
  const results=await Promise.all(Array.from({length:8},()=>runDay('2026-09-14',false,deps)));
  assert.equal(writes,1);assert.equal(results.filter(r=>r.status==='created').length,1);
  await runDay('2026-09-14',false,deps);assert.equal(writes,1);
  assert.equal((await store.get('2026-09-14')).event_id,'event1');
 }finally{await db.close();}
});
test('ambiguous event timeout is durable and never retried',async()=>{
 const {db,query}=await database();try {
  const store=new RunStore(query,'a');let writes=0;
  const deps:RunDeps={store,collect:async()=>[],create:async()=>{writes++;throw new Error('EVENT_OUTCOME_UNCERTAIN');},writesEnabled:true,maxDescription:20000};
  await assert.rejects(runDay('2026-09-14',false,deps),/EVENT_OUTCOME_UNCERTAIN/);
  assert.equal((await store.get('2026-09-14')).state,'uncertain');
  await runDay('2026-09-14',false,deps);assert.equal(writes,1);
  await store.reconcile('2026-09-14','recovered-event');assert.equal((await store.get('2026-09-14')).state,'created');
 }finally{await db.close();}
});
test('prewrite failure can retry; previews and weekends do not reserve dates',async()=>{
 const {db,query}=await database();try {
  const store=new RunStore(query,'a');let fail=true,writes=0;
  const deps:RunDeps={store,collect:async()=>{if(fail)throw new Error('JOBBER_GRAPHQL_ERROR');return [];},create:async()=>{writes++;return 'ok';},writesEnabled:true,maxDescription:20000};
  await assert.rejects(runDay('2026-09-14',false,deps));assert.equal((await store.get('2026-09-14')).state,'failed');
  fail=false;await runDay('2026-09-15',true,deps);assert.equal(await store.get('2026-09-15'),null);
  await runDay('2026-09-12',false,deps);assert.equal(await store.get('2026-09-12'),null);
  await runDay('2026-09-14',false,deps);assert.equal(writes,1);
 }finally{await db.close();}
});
test('expired owner cannot write after a new owner takes the lease; creating never expires',async()=>{
 const {db,query}=await database();try {
  const store=new RunStore(query,'a'),one=randomUUID(),two=randomUUID();
  await store.claim('2026-09-14',one);
  await query("UPDATE daily_runs SET lease_until=now()-interval '1 second'");
  assert.equal(await store.claim('2026-09-14',two),true);
  await assert.rejects(store.preparingWrite('2026-09-14',one,'old'),/RUN_OWNERSHIP_LOST/);
  await store.preparingWrite('2026-09-14',two,'new');
  await query("UPDATE daily_runs SET lease_until=now()-interval '1 day'");
  assert.equal(await store.claim('2026-09-14',randomUUID()),false);
 }finally{await db.close();}
});
