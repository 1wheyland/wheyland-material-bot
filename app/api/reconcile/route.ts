import { NextResponse } from 'next/server';
import { handler,jsonBody,requireAdmin } from '../../../src/http';
import { dayWindow } from '../../../src/time';
import { reconcile } from '../../../src/runs/service';
export const POST=handler(async req=>{
 requireAdmin(req);const body=await jsonBody(req);
 if(typeof body.date!=='string'||typeof body.eventId!=='string'||!body.eventId) throw new Error('INVALID_REQUEST');
 if(body.van!==undefined && body.van!=="tim" && body.van!=="niall") throw new Error("INVALID_REQUEST");
 dayWindow(body.date);return NextResponse.json(await reconcile(body.date,body.eventId,body.van as "tim"|"niall"|undefined));
});

