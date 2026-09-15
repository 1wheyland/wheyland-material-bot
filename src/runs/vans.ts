import { VANS,groupByVan,type VanKey } from '../materials/vans';
import { render,renderDetails } from '../materials/render';
import { runDay,type RunDeps } from './engine';
import { dayWindow } from '../time';
import { errorCode } from '../log';
export type VanDeps=Omit<RunDeps,'store'|'create'> & {
 store:(van:VanKey)=>RunDeps['store']; legacy:RunDeps['store'];
 create:(van:VanKey,description:string,window:ReturnType<typeof dayWindow>,signal:AbortSignal)=>Promise<string>;
};
export async function runVanDay(date:string,dryRun:boolean,deps:VanDeps) {
 if(!dayWindow(date).weekday)return {status:'skipped_weekend'};
 if(!dryRun&&!deps.writesEnabled)throw new Error('EVENT_WRITES_DISABLED');
 if(dryRun) {
  const groups=await deps.collect(date,AbortSignal.timeout(240000)),partition=groupByVan(groups);
  const sections=[...VANS.map(v=>({key:v.key,title:v.title,description:render(date,partition[v.key],'',v.title)})),
   ...(['curren','unassigned'] as const).filter(k=>partition[k].length).map(k=>({key:k,title:k==='curren'?'Curren':'Needs van assignment',description:render(date,partition[k],'',k==='curren'?'Curren':'Needs van assignment')}))];
  return {status:'preview',date,sections,description:sections.map(s=>s.description).join('\n\n'),sources:renderDetails(date,groups,''),jobCount:groups.length};
 }
 const legacy=await deps.legacy.get(date);
 if(legacy&&['processing','creating','uncertain','created'].includes(legacy.state))throw new Error('LEGACY_DAILY_EVENT_REVIEW_REQUIRED');
 let collection:ReturnType<VanDeps['collect']>|undefined;
 const results=[];
 for(const van of VANS) {
  try {
   const result=await runDay(date,false,{...deps,store:deps.store(van.key),title:van.title,
    collect:async(d,signal)=>groupByVan(await (collection??=deps.collect(d,signal)))[van.key],
    create:(description,window,signal)=>deps.create(van.key,description,window,signal)});
   results.push({van:van.name,...result});
  }catch(error){results.push({van:van.name,status:'failed',error:errorCode(error)});}
 }
 return {status:results.some(r=>r.status==='failed')?'needs_attention':'complete',date,events:results};
}
