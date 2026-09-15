'use client';
import { useEffect,useState } from 'react';
type Status={today:string;connection:string;writesEnabled:boolean;runs:{local_date:string;van_key:string;state:string;event_id:string|null;error_code:string|null}[]};
export default function Home() {
 const [sections,setSections]=useState<{key:string;title:string;description:string}[]>([]),[sources,setSources]=useState('');
 const [status,setStatus]=useState<Status|null>(null),[secret,setSecret]=useState(''),[date,setDate]=useState(''),[output,setOutput]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function request(path:string,body?:unknown) {
  const response=await fetch(path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await response.json();if(!response.ok)throw new Error(data.error??'REQUEST_FAILED');return data;
 }
 async function refresh() {const data=await request('/api/status');setStatus(data);setDate(d=>d||data.today);}
 useEffect(()=>{refresh().catch(()=>{});},[]);
 async function action(fn:()=>Promise<void>) {setBusy(true);setError('');try{await fn();}catch(e){setError(e instanceof Error?e.message:'Request failed');}finally{setBusy(false);}}
 return <main>
  <header><div className="brand">W<span>⚡</span>E</div><div><p className="eyebrow">WHEYLAND ELECTRIC</p><h1>Material Bot</h1></div><span className="internal">INTERNAL</span></header>
  <section className="intro"><p className="eyebrow">READY FOR THE WORKDAY</p><h2>The right materials.<br/>A clearer morning.</h2><p>Daily Jobber scope, organized by van, with a short buying list and only the checks you need.</p></section>
  {!status?<section className="card login"><h3>Team access</h3><p>Sign in with the internal access secret configured for this app.</p><form onSubmit={e=>{e.preventDefault();action(async()=>{await request('/api/auth/login',{secret});setSecret('');await refresh();});}}><label htmlFor="secret">Access secret</label><input id="secret" type="password" autoComplete="current-password" value={secret} onChange={e=>setSecret(e.target.value)} required/><button disabled={busy}>Sign in</button></form><p className="muted">First setup? Follow SETUP.md in the project to configure the database and environment.</p></section>:<>
   <section className="stats"><article><small>JOBBER CONNECTION</small><strong>{status.connection.replaceAll('_',' ')}</strong></article><article><small>MORNING PREPARATION</small><strong>5:45 AM · Mon–Fri</strong></article><article><small>VAN CALENDAR EVENTS</small><strong>6:00 AM · Pacific</strong></article></section>
   <section className="card"><div className="sectionhead"><div><h3>Prepare a material list</h3><p>Preview reads Jobber and generates a list. Create adds one calendar event for each van.</p></div><span className={status.writesEnabled?'badge live':'badge'}>{status.writesEnabled?'Writes enabled':'Preview mode'}</span></div>
    <label htmlFor="date">Work date · America/Los_Angeles</label><input id="date" type="date" value={date} onChange={e=>setDate(e.target.value)}/>
    <div className="actions"><button disabled={busy||!date} onClick={()=>action(async()=>{const data=await request('/api/manual-test',{date,dryRun:true});setSections(data.sections??[]);setSources(data.sources??'');setOutput(data.sections?'':data.description??data.status);})}>Preview materials</button><button className="secondary" disabled={busy||!date||!status.writesEnabled} onClick={()=>action(async()=>{const data=await request('/api/manual-test',{date,dryRun:false});setSections([]);setSources('');setOutput(data.events?.map((e:{van:string;status:string;error?:string})=>e.van+": "+e.status.replaceAll("_"," ")+(e.error?" — "+e.error:"")).join('\n')??data.status);await refresh();})}>Create van events</button><button className="link" disabled={busy} onClick={()=>action(async()=>{const data=await request('/api/oauth/start',{});window.location.assign(data.url);})}>Connect / reconnect Jobber</button></div>
    <p className="muted">Existing daily events are protected from duplicate creation. Rerunning never edits an existing event.</p>
   </section>
   {sections.map(section=><section className="card" key={section.key}><h3>{section.title}</h3><pre>{section.description}</pre></section>)}
   {sources&&<details className="card"><summary>Show sources and all checks</summary><pre>{sources}</pre></details>}
   {output&&<section className="card"><h3>Material list / result</h3><pre>{output}</pre></section>}
   <section className="card"><div className="sectionhead"><h3>Recent runs</h3><button className="link" disabled={busy} onClick={()=>action(refresh)}>Refresh</button></div><div className="tablewrap"><table><thead><tr><th>Date</th><th>Van</th><th>Status</th><th>Action needed</th></tr></thead><tbody>{status.runs.length?status.runs.map(r=><tr key={r.local_date+r.van_key}><td>{r.local_date}</td><td>{r.van_key==='tim'?'Tim':r.van_key==='niall'?'Niall':'Previous daily event'}</td><td>{r.state}</td><td>{['creating','uncertain'].includes(r.state)?'Check Jobber and follow the reconciliation guide.':r.error_code??'—'}</td></tr>):<tr><td colSpan={4}>No calendar runs yet. Start with a preview.</td></tr>}</tbody></table></div></section>
   <button className="link" disabled={busy} onClick={()=>action(async()=>{await request('/api/auth/logout',{});setStatus(null);setOutput('');setSections([]);setSources('');})}>Sign out</button>
  </>}
  {busy&&<p role="status">Working through the Jobber sources… this can take a few minutes.</p>}{error&&<p className="error" role="alert">{error}. See the setup and operations guide for the next step.</p>}
  <footer>REQUIRED · LIKELY-STANDARD · VERIFY <span>Jobber remains the source of truth.</span></footer>
 </main>;
}


