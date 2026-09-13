import { NextResponse } from 'next/server';
import { cookieOptions,handler,requireAdmin } from '../../../../src/http';
import { startOAuth } from '../../../../src/oauth';
export const POST=handler(async req=>{
 requireAdmin(req);const {state,url}=await startOAuth();const response=NextResponse.json({url});
 response.cookies.set('jobber_oauth_state',state,{...cookieOptions(),maxAge:600});return response;
});
