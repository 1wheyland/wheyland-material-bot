import type { Job, Visit } from '../jobber/data';
export type Source = {id:string;priority:number;kind:string;text:string;quantity:number|null;optional:boolean};
export function sourcesFor(visits:Visit[],job:Job|null,rules:string[]):Source[] {
  const sources:Source[]=[];
  function add(id:string,priority:number,kind:string,text:string|null|undefined,quantity:number|null=null,optional=false) {
    if(text?.trim()) sources.push({id,priority,kind,text,quantity,optional});
  }
  for(const v of visits) { add(`visit:${v.id}:title`,1,'visit title',v.title); add(`visit:${v.id}:instructions`,1,'visit instructions',v.instructions); }
  if(job) {
    add(`job:${job.id}:title`,1,'job title',job.title); add(`job:${job.id}:instructions`,1,'job instructions',job.instructions);
    for(const l of job.lineItems.nodes) add(`job-line:${l.id}`,2,'job line item',[l.name,l.description].filter(Boolean).join('\n'),l.quantity);
    if(job.quote) {
      const q=job.quote;
      add(`quote:${q.id}:scope`,2,'quote scope',JSON.stringify({title:q.title,message:q.message,status:q.quoteStatus}));
      for(const l of q.lineItems.nodes) add(`quote-line:${l.id}`,2,`quote line item; quote status ${q.quoteStatus}; recommended ${l.recommended}`, [l.name,l.description].filter(Boolean).join('\n'),l.quantity,l.optional===true);
    }
    for(const n of job.notes.nodes) if(n.id) add(`note:${n.id}`,3,'job note',n.message);
    const requests=[job.request,job.quote?.request].filter((r):r is NonNullable<typeof r>=>!!r);
    for(const r of new Map(requests.map(r=>[r.id,r])).values()) {
      add(`request:${r.id}`,4,'request info',JSON.stringify({title:r.title,companyName:r.companyName,contactName:r.contactName,status:r.requestStatus}));
      for(const l of r.lineItems.nodes) add(`request-line:${l.id}`,4,'request line item',[l.name,l.description].filter(Boolean).join('\n'),l.quantity);
    }
  }
  rules.forEach((r,i)=>add(`rule:${i}`,6,'Wheyland standard rule',r));
  return sources;
}
