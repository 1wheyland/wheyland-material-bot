import type { Query } from '../db';
export class RunStore {
 constructor(private query:Query,private account:string) {}
 async claim(date:string,runId:string) {
  const result=await this.query(`INSERT INTO daily_runs(account_id,local_date,run_id,state,lease_until)
   VALUES ($1,$2,$3,'processing',now()+interval '5 minutes')
   ON CONFLICT(account_id,local_date) DO UPDATE SET run_id=$3,state='processing',lease_until=now()+interval '5 minutes',error_code=NULL,updated_at=now()
   WHERE daily_runs.state='failed' OR (daily_runs.state='processing' AND daily_runs.lease_until<now()) RETURNING run_id`,[this.account,date,runId]);
  return result.rows.length===1;
 }
 async get(date:string) {
  return (await this.query('SELECT local_date,state,event_id,error_code,updated_at,run_id FROM daily_runs WHERE account_id=$1 AND local_date=$2',[this.account,date])).rows[0]??null;
 }
 async preparingWrite(date:string,runId:string,description:string) {
  const result=await this.query(`UPDATE daily_runs SET state='creating',description=$4,updated_at=now()
   WHERE account_id=$1 AND local_date=$2 AND run_id=$3 AND state='processing' AND lease_until>now() RETURNING run_id`,[this.account,date,runId,description]);
  if(!result.rows.length) throw new Error('RUN_OWNERSHIP_LOST');
 }
 async created(date:string,runId:string,eventId:string) {
  const result=await this.query(`UPDATE daily_runs SET state='created',event_id=$4,error_code=NULL,updated_at=now()
   WHERE account_id=$1 AND local_date=$2 AND run_id=$3 AND state IN ('creating','uncertain') RETURNING run_id`,[this.account,date,runId,eventId]);
  if(!result.rows.length) throw new Error('EVENT_PERSIST_FAILED');
 }
 async failed(date:string,runId:string,code:string) {
  await this.query(`UPDATE daily_runs SET state=CASE WHEN state='creating' THEN 'uncertain' ELSE 'failed' END,error_code=$4,updated_at=now()
   WHERE account_id=$1 AND local_date=$2 AND run_id=$3 AND state IN ('processing','creating')`,[this.account,date,runId,code]);
 }
 async reconcile(date:string,eventId:string) {
  const result=await this.query(`UPDATE daily_runs SET state='created',event_id=$3,error_code=NULL,updated_at=now()
   WHERE account_id=$1 AND local_date=$2 AND state IN ('creating','uncertain') RETURNING run_id`,[this.account,date,eventId]);
  if(!result.rows.length) throw new Error('RECONCILE_STATE_INVALID');
 }
}
