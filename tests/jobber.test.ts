import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paginate,jobDetails } from '../src/jobber/data';
import { jobberClient,type GraphQL } from '../src/jobber/client';
import { testEnv } from './helpers';
testEnv();
const page=<T>(nodes:T[],next:string|null=null)=>({nodes,pageInfo:{hasNextPage:next!==null,endCursor:next}});
test('pagination collects every page and rejects repeated cursors',async()=>{
 const cursors:(string|null)[]=[];
 assert.deepEqual(await paginate(async c=>{cursors.push(c);return c===null?page([1],'a'):page([2]);}),[1,2]);
 assert.deepEqual(cursors,[null,'a']);
 await assert.rejects(paginate(async()=>page([1],'same')),/PAGINATION_CURSOR_INVALID/);
});
test('Query B follows every nested connection independently',async()=>{
 const item={id:'l1',name:'GFCI',description:'20A GFCI',quantity:1};
 const request={id:'r',title:null,companyName:null,contactName:null,requestStatus:'NEW',lineItems:page([item],'more')};
 const job={id:'j',jobNumber:1,title:null,instructions:null,jobStatus:'active',lineItems:page([item],'more'),notes:page([{id:'n1',message:'buy GFCI'}],'more'),
  quote:{id:'q',quoteNumber:'1',title:null,message:null,quoteStatus:'APPROVED',lineItems:page([{...item,optional:false,recommended:false}],'more'),request},request};
 let calls=0;
 const gql:GraphQL=async<T>(q:string)=>{
  calls++;if(q.includes('JobMaterialDetails'))return {job:structuredClone(job)} as T;
  const nodes=q.includes('JobNote')?[{id:'n2',message:'note2'}]:[{...item,id:'l2'}];
  let value:unknown=q.includes('JobNote')?{notes:page<unknown>(nodes)}:{lineItems:page<unknown>(nodes)};
  if(q.includes('request {'))value={request:value};
  if(q.includes('quote {'))value={quote:value};
  return {job:value} as T;
 };
 const result=await jobDetails(gql,'j');assert.equal(calls,6);
 for(const c of [result.lineItems,result.notes,result.quote!.lineItems,result.quote!.request!.lineItems,result.request!.lineItems])assert.equal(c.nodes.length,2);
});
test('read retries a rejected access token; mutation is never retried',async()=>{
 const seen:(string|undefined)[]=[];let calls=0;
 const fake=async()=>{calls++;return calls===1?new Response('',{status:401}):Response.json({data:{ok:true}});};
 const gql=jobberClient(AbortSignal.timeout(5000),async rejected=>{seen.push(rejected);return rejected?'fresh':'old';},fake as typeof fetch);
 assert.deepEqual(await gql('query { ok }'),{ok:true});assert.deepEqual(seen,[undefined,'old']);
 calls=0;
 const mutation=jobberClient(AbortSignal.timeout(5000),async()=> 'token',(async()=>{calls++;throw new Error('lost response');}) as typeof fetch);
 await assert.rejects(mutation('mutation { eventCreate }',{},true),/EVENT_OUTCOME_UNCERTAIN/);assert.equal(calls,1);
});
test('GraphQL partial errors are rejected and over-limit cost fails promptly',async()=>{
 const gql=jobberClient(AbortSignal.timeout(5000),async()=> 'token',(async()=>Response.json({data:{ok:true},errors:[{message:'sensitive error'}]})) as typeof fetch);
 await assert.rejects(gql('query { ok }'),/JOBBER_GRAPHQL_ERROR/);
 const expensive=jobberClient(AbortSignal.timeout(5000),async()=> 'token',(async()=>Response.json({errors:[{extensions:{code:'THROTTLED'}}],extensions:{cost:{requestedQueryCost:10001,throttleStatus:{maximumAvailable:10000,currentlyAvailable:9000,restoreRate:500}}}})) as typeof fetch);
 await assert.rejects(expensive('query { ok }'),/JOBBER_QUERY_TOO_EXPENSIVE/);
});
