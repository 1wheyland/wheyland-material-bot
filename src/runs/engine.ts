import { randomUUID } from 'node:crypto';
import { dayWindow } from '../time';
import type { RunStore } from './store';
import type { WorkGroup } from '../materials/render';
import { render } from '../materials/render';
import { errorCode, log } from '../log';
export type RunDeps={store:RunStore;collect:(date:string,signal:AbortSignal)=>Promise<WorkGroup[]>;
 create:(description:string,window:ReturnType<typeof dayWindow>,signal:AbortSignal)=>Promise<string>;
 title?:string;writesEnabled:boolean;maxDescription:number};
export async function runDay(date:string,dryRun:boolean,deps:RunDeps) {
 const window=dayWindow(date);
 if(!window.weekday) return {status:'skipped_weekend'};
 if(!dryRun&&!deps.writesEnabled) throw new Error('EVENT_WRITES_DISABLED');
 const runId=randomUUID(),signal=AbortSignal.timeout(240000);
 if(!dryRun&&!(await deps.store.claim(date,runId))) return {status:'already_claimed',run:await deps.store.get(date)};
 log('run_started',{runId,date});
 try {
  const groups=await deps.collect(date,signal);
  signal.throwIfAborted();
  const description=render(date,groups,`${date}/${runId}`,deps.title);
  if(description.length>deps.maxDescription) throw new Error('EVENT_DESCRIPTION_TOO_LONG');
  if(dryRun) return {status:'preview',date,description,jobCount:groups.length};
  await deps.store.preparingWrite(date,runId,description);
  // Durable write intent is committed before the only eventCreate attempt.
  const id=await deps.create(description,window,signal);
  await deps.store.created(date,runId,id);
  log('run_created',{runId,date,count:groups.length});
  return {status:'created',eventId:id,date};
 } catch(error) {
  const code=signal.aborted?'RUN_TIMEOUT':errorCode(error);
  if(!dryRun) await deps.store.failed(date,runId,code);
  log('run_failed',{runId,date,code});
  throw new Error(code);
 }
}

