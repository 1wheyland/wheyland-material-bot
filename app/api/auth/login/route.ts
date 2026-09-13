import { NextResponse } from 'next/server';
import { config } from '../../../../src/config';
import { COOKIE,cookieOptions,handler,jsonBody,requireOrigin } from '../../../../src/http';
import { encrypt,equal,hash } from '../../../../src/security';
import { query } from '../../../../src/db';
export const POST=handler(async req=>{
 requireOrigin(req);
 const body=await jsonBody(req),c=config();
 const rate=await query(`INSERT INTO login_limits(bucket,attempts,expires_at) VALUES ('admin',1,now()+interval '1 minute')
  ON CONFLICT(bucket) DO UPDATE SET attempts=CASE WHEN login_limits.expires_at<now() THEN 1 ELSE login_limits.attempts+1 END,
  expires_at=CASE WHEN login_limits.expires_at<now() THEN now()+interval '1 minute' ELSE login_limits.expires_at END RETURNING attempts`);
 if(rate.rows[0].attempts>10) return NextResponse.json({error:'LOGIN_RATE_LIMIT'},{status:429});
 if(typeof body.secret!=='string'||!equal(body.secret,c.ADMIN_SECRET)) throw new Error('UNAUTHORIZED');
 const response=NextResponse.json({status:'signed_in'});
 response.cookies.set(COOKIE,encrypt(JSON.stringify({expires:Date.now()+8*3600000,admin:hash(c.ADMIN_SECRET)}),c.TOKEN_ENCRYPTION_KEY),{...cookieOptions(),maxAge:8*3600});
 return response;
});
