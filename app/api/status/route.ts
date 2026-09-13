import { NextResponse } from 'next/server';
import { config } from '../../../src/config';
import { query } from '../../../src/db';
import { handler,requireAdmin } from '../../../src/http';
import { today } from '../../../src/time';
export const GET=handler(async req=>{
 requireAdmin(req);const c=config();
 const connection=(await query('SELECT refresh_state,expires_at,updated_at FROM connections WHERE account_id=$1',[c.JOBBER_ACCOUNT_ID])).rows[0];
 const runs=(await query('SELECT local_date,state,event_id,error_code,updated_at FROM daily_runs WHERE account_id=$1 ORDER BY local_date DESC LIMIT 20',[c.JOBBER_ACCOUNT_ID])).rows;
 const stale=connection?.refresh_state==='refreshing'&&Date.now()-new Date(connection.updated_at).getTime()>30000;
 return NextResponse.json({today:today(),connection:stale?'reconnect':connection?.refresh_state??'not_connected',writesEnabled:c.ENABLE_EVENT_WRITES==='true',runs});
});
