import { z } from 'zod';
import type { GraphQL } from './client';
import { LINE, PAGE, QUERY_A, QUERY_B } from './queries';
const nullableText = z.string().nullable();
const pageInfo = z.object({ hasNextPage:z.boolean(), endCursor:nullableText });
const connection = <T extends z.ZodType>(node:T) => z.object({nodes:z.array(node),pageInfo});
const line = z.object({id:z.string(),name:nullableText,description:nullableText,quantity:z.number().nullable(),optional:z.boolean().optional(),recommended:z.boolean().nullable().optional()});
const request = z.object({id:z.string(),title:nullableText,companyName:nullableText,contactName:nullableText,requestStatus:z.string(),lineItems:connection(line)});
const jobBase = z.object({id:z.string(),jobNumber:z.number(),title:nullableText,instructions:nullableText,jobStatus:z.string()});
const jobSchema = jobBase.extend({lineItems:connection(line),notes:connection(z.object({id:z.string().optional(),message:nullableText.optional()})),
 quote:z.object({id:z.string(),quoteNumber:z.string(),title:nullableText,message:nullableText,quoteStatus:z.string(),lineItems:connection(line),request:request.nullable()}).nullable(),request:request.nullable()});
const user = z.object({id:z.string(),name:z.object({full:z.string()})});
const visitSchema = z.object({id:z.string(),title:nullableText,startAt:nullableText,endAt:nullableText,visitStatus:z.string(),instructions:nullableText,
 assignedUsers:connection(user),client:z.object({id:z.string(),companyName:nullableText}).nullable(),
 property:z.object({id:z.string(),address:z.object({street:nullableText,city:nullableText,province:nullableText,postalCode:nullableText})}).nullable(),job:jobBase.nullable()});
export type Visit = z.infer<typeof visitSchema>;
export type Job = z.infer<typeof jobSchema>;
export type Connection<T> = {nodes:T[];pageInfo:{hasNextPage:boolean;endCursor:string|null}};
export async function paginate<T>(fetchPage:(cursor:string|null)=>Promise<Connection<T>>, initial?:Connection<T>):Promise<T[]> {
  const nodes:T[]=[], seen=new Set<string>(); let cursor:string|null=null;
  for(let i=0;i<1000;i++) {
    const page:Connection<T> = i===0 && initial ? initial : await fetchPage(cursor);
    nodes.push(...page.nodes);
    if(!page.pageInfo.hasNextPage) return nodes;
    const next:string|null=page.pageInfo.endCursor;
    if(!next || seen.has(next)) throw new Error('PAGINATION_CURSOR_INVALID');
    seen.add(next);cursor=next;
  }
  throw new Error('PAGINATION_LIMIT');
}
const fieldLabels: Record<string,string> = {
 visits:'VISITS',job:'JOB',quote:'QUOTE',request:'REQUEST',assignedUsers:'ASSIGNEES',
 lineItems:'ITEMS',notes:'NOTES',client:'CLIENT',property:'PROPERTY',address:'ADDRESS',
 id:'ID',name:'NAME',full:'FULL',description:'DESCRIPTION',quantity:'QUANTITY',
 optional:'OPTIONAL',recommended:'RECOMMENDED',title:'TITLE',instructions:'INSTRUCTIONS',
 jobNumber:'JOBNUMBER',quoteNumber:'QUOTENUMBER',jobStatus:'JOBSTATUS',quoteStatus:'QUOTESTATUS',
 requestStatus:'REQUESTSTATUS',visitStatus:'VISITSTATUS',companyName:'COMPANY',contactName:'CONTACT',
 startAt:'START',endAt:'END',street:'STREET',city:'CITY',province:'PROVINCE',postalCode:'POSTAL',
 message:'MESSAGE',hasNextPage:'HASNEXT',endCursor:'CURSOR',
};
function checked<T>(schema:z.ZodType<T>,value:unknown,context:string[]=[]):T {
  const result=schema.safeParse(value);
  if(!result.success) {
    const issue=result.error.issues[0];
    // Only known schema labels and a type label leave this boundary; never data or Zod messages.
    const labels=[...context,...issue.path].flatMap(key=>typeof key==='string'&&fieldLabels[key]?[fieldLabels[key]]:[]);
    let invalid:unknown=value;
    for(const key of issue.path) invalid=invalid!==null&&typeof invalid==='object'?(invalid as Record<PropertyKey,unknown>)[key]:undefined;
    const kind=invalid===null?'NULL':Array.isArray(invalid)?'ARRAY':typeof invalid==='string'?'TEXT':typeof invalid==='number'?'NUMBER':typeof invalid==='boolean'?'BOOL':invalid===undefined?'MISSING':'OBJECT';
    const location=labels.join('_').slice(-34)||'ROOT';
    throw new Error(`JOBBER_SCHEMA_${location}_${kind}`);
  }
  return result.data;
}
export async function dailyVisits(gql:GraphQL,after:string,before:string) {
  const visits=await paginate(async cursor=> {
    const data=await gql<{visits:unknown}>(QUERY_A,{after,before,cursor});
    return checked(connection(visitSchema),data.visits,["visits"]);
  });
  for(const visit of visits) {
    visit.assignedUsers.nodes=await paginate(async cursor=>{
      const result=await gql<{visit:{assignedUsers:unknown}}>(`query VisitAssignees($id:EncodedId!,$cursor:String) {
       visit(id:$id) { assignedUsers(first:25,after:$cursor) { nodes { id name { full } } ${PAGE} } } }`,{id:visit.id,cursor});
      return checked(connection(user),result.visit.assignedUsers,["assignedUsers"]);
    },visit.assignedUsers);
  }
  // Use an overlapping lower bound at the caller, then enforce the exact local half-open window.
  return [...new Map(visits.map(v=>[v.id,v])).values()];
}
export async function jobDetails(gql:GraphQL,id:string):Promise<Job> {
  const result=await gql<{job:unknown}>(QUERY_B,{id});
  const job=checked(jobSchema,result.job,["job"]);
  async function complete<T>(path:string[],initial:Connection<T>,fields:string,schema:z.ZodType<T>) {
    initial.nodes=await paginate(async cursor=>{
      let selection=`${path.at(-1)}(first:25,after:$cursor) { nodes { ${fields} } ${PAGE} }`;
      for(const parent of path.slice(0,-1).reverse()) selection=`${parent} { ${selection} }`;
      const data=await gql<{job:Record<string,unknown>}>(`query MoreJobSources($id:EncodedId!,$cursor:String) { job(id:$id) { ${selection} } }`,{id,cursor});
      let value:unknown=data.job;
      for(const key of path) value=(value as Record<string,unknown>|null)?.[key];
      return checked(connection(schema),value,["job",...path]);
    },initial);
  }
  await complete(['lineItems'],job.lineItems,LINE,line);
  await complete(['notes'],job.notes,'... on JobNote { id message }',z.object({id:z.string().optional(),message:nullableText.optional()}));
  if(job.quote) {
    await complete(['quote','lineItems'],job.quote.lineItems,`${LINE} optional recommended`,line);
    if(job.quote.request) await complete(['quote','request','lineItems'],job.quote.request.lineItems,LINE,line);
  }
  if(job.request) await complete(['request','lineItems'],job.request.lineItems,LINE,line);
  return job;
}


