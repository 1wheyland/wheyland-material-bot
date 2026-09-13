import { NextResponse } from 'next/server';
import { config } from '../../../../src/config';
import { cookieOptions,handler,requireAdmin } from '../../../../src/http';
import { equal } from '../../../../src/security';
import { finishOAuth } from '../../../../src/oauth';
export const GET=handler(async req=>{
 requireAdmin(req);
 const state=req.nextUrl.searchParams.get('state'),code=req.nextUrl.searchParams.get('code');
 if(!state||!code||!equal(state,req.cookies.get('jobber_oauth_state')?.value??'')) throw new Error('OAUTH_STATE_INVALID');
 await finishOAuth(code,state);
 const response=NextResponse.redirect(new URL('/',config().APP_URL));
 response.cookies.set('jobber_oauth_state','',{...cookieOptions(),maxAge:0});return response;
});
