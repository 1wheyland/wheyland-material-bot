import { NextResponse } from 'next/server';
import { COOKIE,cookieOptions,handler,requireAdmin } from '../../../../src/http';
export const POST=handler(async req=>{requireAdmin(req);const response=NextResponse.json({status:'signed_out'});response.cookies.set(COOKIE,'',{...cookieOptions(),maxAge:0});return response;});
