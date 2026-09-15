import type { WorkGroup } from './render';
export const VANS = [{key:'tim',name:"Tim’s Van",title:"Tim’s Van — Materials"},{key:'niall',name:"Niall’s Van",title:"Niall’s Van — Materials"}] as const;
export type VanKey = typeof VANS[number]['key'];
export function groupByVan(groups:WorkGroup[]) {
 const result:Record<VanKey|'curren'|'unassigned',WorkGroup[]>={tim:[],niall:[],curren:[],unassigned:[]};
 for(const group of groups) {
  const names=group.visits.flatMap(v=>v.assignedUsers.nodes.map(u=>u.name.full.trim().split(/\s+/)[0].toLowerCase()));
  const vans=VANS.filter(v=>names.includes(v.key)||v.key==='tim'&&names.includes('timothy'));
  if(vans.length===1) result[vans[0].key].push(group);
  else if(vans.length===2) {
   // Both vans receive the same job quantities; the note identifies a shared set.
   for(const van of vans) result[van.key].push({...group,analysis:{...group.analysis,

    warnings:[...group.analysis.warnings,'Shared job — same material list on both vans. Quantities are for the job total.']}});
  } else result[names.includes('curren')?'curren':'unassigned'].push(group);
 }
 return result;
}


