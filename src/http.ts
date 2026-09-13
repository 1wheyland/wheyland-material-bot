import { NextRequest, NextResponse } from 'next/server';
import { config } from './config';
import { decrypt, equal, hash } from './security';
import { errorCode, log } from './log';
export const COOKIE='materialbot_session';
export const cookieOptions=()=>({httpOnly:true,secure:new URL(config().APP_URL).protocol==='https:',sameSite:'lax' as const,path:'/'});
export function requireAdmin(req:NextRequest) {
 const c=config(),bearer=req.headers.get('authorization');
 if(bearer && equal(bearer,`Bearer ${c.ADMIN_SECRET}`)) return;
 try {
  const session=JSON.parse(decrypt(req.cookies.get(COOKIE)?.value??'',c.TOKEN_ENCRYPTION_KEY));
  if(session.expires>Date.now()&&equal(session.admin,hash(c.ADMIN_SECRET))) {
   if(!['GET','HEAD'].includes(req.method)) requireOrigin(req);
   return;
  }
 } catch {}
 throw new Error('UNAUTHORIZED');
}
export function requireOrigin(req:NextRequest) {
 if(req.headers.get('origin')!==new URL(config().APP_URL).origin) throw new Error('ORIGIN_REJECTED');
}
export async function jsonBody(req:NextRequest) {
 if(!req.headers.get('content-type')?.includes('application/json')) throw new Error('INVALID_REQUEST');
 // Bound streamed input as well as Content-Length.
 const reader=req.body?.getReader(); if(!reader) throw new Error('INVALID_REQUEST');
 const chunks:Uint8Array[]=[];let size=0;
 while(true) {const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();throw new Error('INVALID_REQUEST');}chunks.push(value);}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new Error('INVALID_REQUEST');}
}
export function handler(fn:(req:NextRequest)=>Promise<NextResponse|Response>) {
 return async(req:NextRequest)=>{
  try{return await fn(req);}catch(e){const code=errorCode(e);log('request_failed',{code});
   const status=code==='UNAUTHORIZED'?401:code==='ORIGIN_REJECTED'?403:code.startsWith('INVALID_')?400:code.includes('DISABLED')?409:500;
   return NextResponse.json({error:code},{status,headers:{'Cache-Control':'no-store'}});
  }
 };
}
