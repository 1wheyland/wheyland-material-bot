import { NextResponse } from 'next/server';
import { config } from '../../../src/config';
import { equal } from '../../../src/security';
import { handler } from '../../../src/http';
import { shouldSchedule,today } from '../../../src/time';
import { run } from '../../../src/runs/service';
export const runtime='nodejs';
export const maxDuration=300;
export const GET=handler(async req=>{
 if(!equal(req.headers.get('authorization')??'',`Bearer ${config().CRON_SECRET}`)) throw new Error('UNAUTHORIZED');
 if(!shouldSchedule()) return NextResponse.json({status:'outside_local_schedule'});
 return NextResponse.json(await run(today(),false));
});
