import type { Visit } from '../jobber/data';
import { DateTime } from 'luxon';
import { ZONE } from '../time';
import type { Analysis, Material } from './classify';
export type WorkGroup={key:string;visits:Visit[];analysis:Analysis;description?:string};
const clean=(s:string)=>s.replace(/[\u0000-\u001f\u007f]/g,' ').trim();
const localTime=(value:string|null)=>{
 const time=value?DateTime.fromISO(value,{zone:ZONE}):null;
 return time?.isValid?time.toFormat('h:mm a'):'Time unavailable';
};
const item=(m:Material)=>`${m.quantity??'?'} ${m.unit??'qty unconfirmed'} × ${clean(m.name)}${m.specification?' — '+clean(m.specification):''}`;
export function aggregate(groups:WorkGroup[]) {
 const totals=new Map<string,{material:Material;quantity:number|null;groups:Set<string>}>();
 for(const g of groups) for(const m of g.analysis.materials) {
  // VERIFY stays separate by job: unknown/incompatible specifications cannot safely be summed.
  const key=JSON.stringify([m.name.trim().toLowerCase(),m.specification?.trim().toLowerCase(),m.unit?.trim().toLowerCase(),m.classification,m.procurement,
   m.classification==='VERIFY'||!m.specification?g.key:null]);
  const row=totals.get(key);
  if(row) {row.quantity=row.quantity===null||m.quantity===null?null:row.quantity+m.quantity;row.groups.add(g.key);}
  else totals.set(key,{material:m,quantity:m.quantity,groups:new Set([g.key])});
 }
 return [...totals.values()];
}
export function renderDetails(date:string,groups:WorkGroup[],marker:string) {
 const lines=[`WHEYLAND ELECTRIC | ${date}`, '6:00 AM • America/Los_Angeles',
  'Jobber is the source of truth. ? means verify. Shared crew materials are counted once in totals.', ''];
 const employees=new Map<string,{name:string;groups:WorkGroup[]}>();
 for(const g of groups) {
  const assigned=new Map(g.visits.flatMap(v=>v.assignedUsers.nodes).map(u=>[u.id,u.name.full]));
  if(!assigned.size) assigned.set('unassigned','UNASSIGNED — assign an employee');
  for(const [id,name] of assigned) {const e=employees.get(id)??{name,groups:[]};e.groups.push(g);employees.set(id,e);}
 }
 if(!groups.length) lines.push('No scheduled visits found for this day.');
 for(const e of [...employees.values()].sort((a,b)=>a.name.localeCompare(b.name))) {
  lines.push(`EMPLOYEE: ${clean(e.name)}`);
  for(const g of e.groups) {
   lines.push(`  ${g.visits[0].job?'JOB #'+g.visits[0].job.jobNumber:'NO LINKED JOB'} — shared job materials`);
   for(const v of g.visits) {
    const address=v.property?.address;
    lines.push(`  ${clean(v.title??'Untitled visit')} | ${localTime(v.startAt)}–${localTime(v.endAt)} Pacific | ${v.visitStatus}`,
     `  ${clean(v.client?.companyName??'Client name unavailable')} | ${address?Object.values(address).filter(Boolean).map(x=>clean(x!)).join(', '):'Address unavailable'}`);
   }
   for(const category of ['REQUIRED','LIKELY-STANDARD','VERIFY'] as const) {
    lines.push(`  ${category}`);
    const materials=g.analysis.materials.filter(m=>m.classification===category);
    if(!materials.length) lines.push('    —');
    for(const m of materials) {
     lines.push(`    ${item(m)} [${m.procurement}]`, `      ${clean(m.reason)}`);
     for(const u of m.uncertainties) lines.push(`      VERIFY: ${clean(u)}`);
     for(const e of m.evidence) lines.push(`      Source ${clean(e.sourceId)}: “${clean(e.excerpt)}”`);
    }
   }
   for(const w of g.analysis.warnings) lines.push(`  VERIFY: ${clean(w)}`);
  }
  lines.push('');
 }
 const totals=aggregate(groups);
 for(const bucket of ['NEED TO BUY','CED','VERIFY','ON HAND'] as const) {
  lines.push(bucket==='VERIFY'?'VERIFY STOCK / SUPPLIER / SPECIFICATIONS':bucket);
  const rows=totals.filter(r=>r.material.procurement===bucket);
  if(!rows.length) lines.push('  None confirmed.');
  for(const r of rows) lines.push(`  ${item({...r.material,quantity:r.quantity})} [${r.material.classification}] — ${[...r.groups].map(clean).join(', ')}`);
 }
 lines.push('',`Material Bot reference: ${marker}`);
 return lines.join('\n');
}

export function jobDescription(group:WorkGroup[]) {
 const descriptions=group.flatMap(g=>g.description?.trim()?[clean(g.description)]:g.visits.map(v=>clean(v.instructions?.trim()||v.title?.trim()||v.job?.instructions?.trim()||v.job?.title?.trim()||'')));
 const text=[...new Set(descriptions.filter(Boolean))].join(' · ');
 if(!text)return 'See Jobber for work details.';
 if(text.length<=200)return text;
 const shortened=text.slice(0,197).replace(/\s+\S*$/,'');
 return shortened+'…';
}
export function render(date:string,groups:WorkGroup[],marker:string,title='Materials') {
 const lines=[`${title} | ${date}`, '6:00 AM · Pacific', ''];
 if(!groups.length) lines.push('No jobs assigned.');
 for(const g of groups) {
  lines.push(g.key);
  for(const v of g.visits) {
   const address=v.property?.address;
   lines.push(`${localTime(v.startAt)} · ${clean(v.client?.companyName||address?.street||'Jobber visit')}`);
  }
  lines.push(`Work: ${jobDescription([g])}`);
  if(!g.analysis.materials.length) lines.push('  No materials confirmed.');
  for(const m of g.analysis.materials) lines.push(`  • ${item(m)}${m.classification==='VERIFY'?' — check':''}`);
  const checks=[...new Set([...g.analysis.warnings,...g.analysis.materials.flatMap(m=>m.uncertainties)])];
  if(checks.length) lines.push('  Needs checking:',...checks.slice(0,3).map(x=>`    • ${clean(x)}`),...(checks.length>3?['    • More checks in Show sources.']:[]));
  lines.push('');
 }
 const buying=aggregate(groups).filter(r=>['NEED TO BUY','CED'].includes(r.material.procurement));
 lines.push('BUYING LIST');
 lines.push(...(buying.length?buying.map(r=>`• ${item({...r.material,quantity:r.quantity})}${r.material.procurement==='CED'?' · CED':''}`):['No purchases confirmed.']));
 if(groups.some(g=>g.analysis.materials.some(m=>m.procurement==='VERIFY')))lines.push('Check stock and supplier before buying.');
 if(marker)lines.push('',`Material Bot reference: ${marker}`);
 return lines.join('\n');
}

