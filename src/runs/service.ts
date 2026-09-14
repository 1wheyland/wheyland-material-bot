import { config } from '../config';
import { query } from '../db';
import { jobberClient } from '../jobber/client';
import { dailyVisits, jobDetails, type Visit } from '../jobber/data';
import { EVENT_CREATE, EVENT_READ } from '../jobber/queries';
import { classify } from '../materials/classify';
import { sourcesFor } from '../materials/sources';
import type { WorkGroup } from '../materials/render';
import { dayWindow } from '../time';
import rules from '../../config/standard-rules.json';
import { RunStore } from './store';
import { runDay } from './engine';
import { log } from '../log';
export function store() {return new RunStore(query,config().JOBBER_ACCOUNT_ID);}
export async function collect(date:string,signal:AbortSignal):Promise<WorkGroup[]> {
 const window=dayWindow(date),gql=jobberClient(signal);
 const after=new Date(new Date(window.after).getTime()-1000).toISOString();
 const visits=(await dailyVisits(gql,after,window.before)).filter(v=>v.startAt&&Date.parse(v.startAt)>=Date.parse(window.after)&&Date.parse(v.startAt)<Date.parse(window.before));
 const groups=new Map<string,Visit[]>();
 log('visits_loaded',{date,count:visits.length});
 for(const v of visits) { const key=v.job?.id??`visit:${v.id}`;groups.set(key,[...(groups.get(key)??[]),v]); }
 const result:WorkGroup[]=[];
 for(const [key,visits] of groups) {
  signal.throwIfAborted();
  const job=visits[0].job?await jobDetails(gql,key):null;
  const sources=sourcesFor(visits,job,rules);
  log('material_analysis_started',{date,count:sources.length});
  const analysis=await classify(sources,signal);
  if(!job) analysis.warnings.push('Visit has no linked job; deeper material sources are unavailable.');
  result.push({key:job?`Job #${job.jobNumber}`:key,visits,analysis});
 }
 return result;
}
export function run(date:string,dryRun:boolean) {
 const c=config();
 return runDay(date,dryRun,{store:store(),collect,writesEnabled:c.ENABLE_EVENT_WRITES==='true',maxDescription:c.MAX_EVENT_DESCRIPTION_CHARS,
  async create(description,window,signal) {
   const data=await jobberClient(signal)<{eventCreate:{event:{id:string}|null;userErrors:{message:string}[]}}>(EVENT_CREATE,
    {input:{title:'MATERIALS FOR THE DAY',description,startAt:window.eventStart,endAt:window.eventEnd,allDay:false}},true);
   if(!data.eventCreate?.event?.id||data.eventCreate.userErrors?.length) throw new Error('EVENT_OUTCOME_UNCERTAIN');
   return data.eventCreate.event.id;
  }
 });
}
export async function reconcile(date:string,eventId:string) {
 const row=await store().get(date);
 if(!row||!['creating','uncertain'].includes(row.state)) throw new Error('RECONCILE_STATE_INVALID');
 const data=await jobberClient(AbortSignal.timeout(30000))<{event:{id:string;title:string;description:string;startAt:string}}>(EVENT_READ,{id:eventId});
 const e=data.event;
 if(!e||e.title!=='MATERIALS FOR THE DAY'||Date.parse(e.startAt)!==Date.parse(dayWindow(date).eventStart)||!e.description.includes(`Material Bot reference: ${date}/${row.run_id}`)) throw new Error('RECONCILE_EVENT_MISMATCH');
 await store().reconcile(date,eventId);
 return {status:'reconciled',date,eventId};
}
