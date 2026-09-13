import { NextResponse } from 'next/server';
import { handler,jsonBody,requireAdmin } from '../../../src/http';
import { today } from '../../../src/time';
import { run } from '../../../src/runs/service';
export const runtime='nodejs';
export const maxDuration=300;
export const POST=handler(async req=>{
 requireAdmin(req);const body=await jsonBody(req);
 if(body.dryRun!==undefined&&typeof body.dryRun!=='boolean') throw new Error('INVALID_REQUEST');
 if(body.date!==undefined&&typeof body.date!=='string') throw new Error('INVALID_DATE');
 return NextResponse.json(await run(body.date??today(),body.dryRun!==false));
});
