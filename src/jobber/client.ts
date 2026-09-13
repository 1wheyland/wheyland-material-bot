import { config } from '../config';
import { accessToken } from '../oauth';
export type GraphQL = <T>(query: string, variables?: Record<string, unknown>, mutation?: boolean) => Promise<T>;
export function jobberClient(signal: AbortSignal, tokenProvider = accessToken, fetcher: typeof fetch = fetch): GraphQL {
  let nextAllowed = 0;
  async function pause(ms: number) {
    signal.throwIfAborted();
    if (ms>30000) throw new Error('JOBBER_RATE_LIMIT_WAIT');
    await new Promise<void>((resolve,reject)=>{
      const abort=()=>{clearTimeout(timer); reject(new Error('RUN_TIMEOUT'));};
      const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},Math.max(0,ms));
      signal.addEventListener('abort',abort,{once:true});
    });
  }
  return async function request<T>(query: string, variables = {}, mutation = false): Promise<T> {
    let rejected: string | undefined;
    for(let attempt=0;attempt<(mutation?1:4);attempt++) {
      await pause(nextAllowed-Date.now());
      const token=await tokenProvider(rejected);
      let response: Response;
      try {
        response=await fetcher('https://api.getjobber.com/api/graphql', { method:'POST',
          headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json','X-JOBBER-GRAPHQL-VERSION':config().JOBBER_GRAPHQL_VERSION },
          body:JSON.stringify({query,variables}),signal:AbortSignal.any([signal,AbortSignal.timeout(25000)]),cache:'no-store' });
      } catch { if(mutation) throw new Error('EVENT_OUTCOME_UNCERTAIN'); await pause(1000*2**attempt); continue; }
      if (!mutation && response.status===401) { rejected=token; continue; }
      if(!mutation && (response.status===429 || response.status>=500)) {
        const retry=response.headers.get('retry-after');
        const delay=retry ? (/^\d+$/.test(retry)? Number(retry)*1000 : Date.parse(retry)-Date.now()) : 1000*2**attempt;
        await pause(Number.isFinite(delay)?delay:1000); continue;
      }
      if(!response.ok) throw new Error(mutation?'EVENT_OUTCOME_UNCERTAIN':'JOBBER_HTTP_ERROR');
      let body;
      try { body=await response.json(); } catch { throw new Error(mutation?'EVENT_OUTCOME_UNCERTAIN':'JOBBER_INVALID_RESPONSE'); }
      const cost=body.extensions?.cost, throttle=cost?.throttleStatus;
      if(throttle?.restoreRate>0) nextAllowed=Date.now()+Math.max(0,(3000-throttle.currentlyAvailable)/throttle.restoreRate*1000);
      if(body.errors?.length) {
        if(!mutation && body.errors.every((e:{extensions?:{code?:string}})=>e.extensions?.code==='THROTTLED')) {
          if(cost?.requestedQueryCost>throttle?.maximumAvailable) throw new Error('JOBBER_QUERY_TOO_EXPENSIVE');
          await pause(Math.max(1000,nextAllowed-Date.now())); continue;
        }
        throw new Error(mutation?'EVENT_OUTCOME_UNCERTAIN':'JOBBER_GRAPHQL_ERROR');
      }
      if(!body.data) throw new Error(mutation?'EVENT_OUTCOME_UNCERTAIN':'JOBBER_MISSING_DATA');
      return body.data as T;
    }
    throw new Error('JOBBER_RETRY_EXHAUSTED');
  };
}
