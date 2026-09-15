import type { VanKey } from '../materials/vans';
import type { Query } from '../db';
export class RunStore {
  constructor(private query:Query,private account:string,private van?:VanKey) {}
 private get table() {return this.van?'van_daily_runs':'daily_runs';}
 private get scope() {return this.van?` AND van_key='${this.van}'`:'';}
 async claim(date:string,runId:string) {
  const result=await this.query(`INSERT INTO ${this.table}(account_id,local_date,run_id,state,lease_until${this.van?",van_key":""})
   VALUES ($1,$2,$3,'processing',now()+interval '5 minutes'${this.van?`, '${this.van}'`:''})
   ON CONFLICT(account_id,local_date${this.van?",van_key":""}) DO UPDATE SET run_id=$3,state='processing',lease_until=now()+interval '5 minutes',error_code=NULL,updated_at=now()
   WHERE ${this.table}.state='failed' OR (${this.table}.state='processing' AND ${this.table}.lease_until<now()) RETURNING run_id`,[this.account,date,runId]);
  return result.rows.length===1;
 }
 async get(date:string) {
  return (await this.query(`SELECT local_date,state,event_id,error_code,updated_at,run_id FROM ${this.table} WHERE account_id=$1 AND local_date=$2${this.scope}`,[this.account,date])).rows[0]??null;
 }
 async preparingWrite(date:string,runId:string,description:string) {
  const result=await this.query(`UPDATE ${this.table} SET state='creating',description=$4,updated_at=now()
   WHERE account_id=$1 AND local_date=$2${this.scope} AND run_id=$3 AND state='processing' AND lease_until>now() RETURNING run_id`,[this.account,date,runId,description]);
  if(!result.rows.length) throw new Error('RUN_OWNERSHIP_LOST');
 }
 async created(date:string,runId:string,eventId:string) {
  const result=await this.query(`UPDATE ${this.table} SET state='created',event_id=$4,error_code=NULL,updated_at=now()
   WHERE account_id=$1 AND local_date=$2${this.scope} AND run_id=$3 AND state IN ('creating','uncertain') RETURNING run_id`,[this.account,date,runId,eventId]);
  if(!result.rows.length) throw new Error('EVENT_PERSIST_FAILED');
 }
 async failed(date:string,runId:string,code:string) {
  await this.query(`UPDATE ${this.table} SET state=CASE WHEN state='creating' THEN 'uncertain' ELSE 'failed' END,error_code=$4,updated_at=now()
   WHERE account_id=$1 AND local_date=$2${this.scope} AND run_id=$3 AND state IN ('processing','creating')`,[this.account,date,runId,code]);
 }
 async reconcile(date:string,eventId:string) {
  const result=await this.query(`UPDATE ${this.table} SET state='created',event_id=$3,error_code=NULL,updated_at=now()
   WHERE account_id=$1 AND local_date=$2${this.scope} AND state IN ('creating','uncertain') RETURNING run_id`,[this.account,date,eventId]);
  if(!result.rows.length) throw new Error('RECONCILE_STATE_INVALID');
 }
}

