import {test} from 'node:test';
import assert from 'node:assert/strict';
import {workDescription} from '../src/materials/description';
const line=(name:string,description:string)=>({id:name,name,description,quantity:1});
const page=(nodes:ReturnType<typeof line>[])=>({nodes,pageInfo:{hasNextPage:false,endCursor:null}});
test('work description uses labor first, introduction second, never a material description',()=>{
 const details={lineItems:page([line('Introduction','Install new circuits.'),line('Labor','Run conduit and install outlets.'),line('Wire','300 feet')]),quote:null};
 assert.equal(workDescription(details),'Run conduit and install outlets.');
 details.lineItems.nodes=details.lineItems.nodes.filter(l=>l.name!=='Labor');
 assert.equal(workDescription(details),'Install new circuits.');
 details.lineItems.nodes=details.lineItems.nodes.filter(l=>l.name!=='Introduction');
 assert.equal(workDescription(details),undefined);
 assert.equal(workDescription(null),undefined);
});
test('quote introduction message is a fallback and optional labor is excluded',()=>{
 const quote={id:'q',quoteNumber:'1',title:null,message:'Replace the existing lighting.',quoteStatus:'APPROVED',request:null,lineItems:page([])};
 assert.equal(workDescription({lineItems:page([]),quote}),quote.message);
 const optional={...line('Labor','Optional extra work'),optional:true};
 assert.equal(workDescription({lineItems:page([]),quote:{...quote,lineItems:page([optional])}}),quote.message);
});
