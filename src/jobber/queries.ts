export const PAGE = 'pageInfo { hasNextPage endCursor }';
export const LINE = 'id name description quantity';
export const REQUEST = `id title companyName contactName requestStatus lineItems(first:25) { nodes { ${LINE} } ${PAGE} }`;
export const QUERY_A = `query DailyVisits($after:ISO8601DateTime,$before:ISO8601DateTime,$cursor:String) {
 visits(first:25,after:$cursor,filter:{startAt:{after:$after,before:$before}}) {
  nodes { id title startAt endAt visitStatus instructions
   assignedUsers(first:10) { nodes { id name { full } } ${PAGE} }
   client { id companyName }
   property { id address { street city province postalCode } }
   job { id jobNumber title instructions jobStatus }
  } ${PAGE}
 }
}`;
export const QUERY_B = `query JobMaterialDetails($id:EncodedId!) {
 job(id:$id) { id jobNumber title instructions jobStatus
  lineItems(first:25) { nodes { ${LINE} } ${PAGE} }
  notes(first:25) { nodes { ... on JobNote { id message } } ${PAGE} }
  quote { id quoteNumber title message quoteStatus
   lineItems(first:25) { nodes { ${LINE} optional recommended } ${PAGE} }
   request { ${REQUEST} }
  }
  request { ${REQUEST} }
 }
}`;
export const EVENT_CREATE = `mutation CreateMaterialsEvent($input:EventCreateInput!) {
 eventCreate(input:$input) { event { id } userErrors { message } }
}`;
export const EVENT_READ = `query ReadMaterialsEvent($id:EncodedId!) { event(id:$id) { id title description startAt endAt } }`;
