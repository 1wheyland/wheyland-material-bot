import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { requireAdmin,COOKIE } from '../src/http';
import { encrypt,hash } from '../src/security';
import { testEnv } from './helpers';
testEnv();
test('admin protection rejects missing auth and accepts only the admin bearer',()=>{
 assert.throws(()=>requireAdmin(new NextRequest('http://localhost:3000/api/status')),/UNAUTHORIZED/);
 assert.throws(()=>requireAdmin(new NextRequest('http://localhost:3000/api/status',{headers:{authorization:`Bearer ${process.env.CRON_SECRET}`}})),/UNAUTHORIZED/);
 requireAdmin(new NextRequest('http://localhost:3000/api/status',{headers:{authorization:`Bearer ${process.env.ADMIN_SECRET}`}}));
});
test('cookie writes require same-origin and expired sessions fail',()=>{
 const session=(expires:number)=>encrypt(JSON.stringify({expires,admin:hash(process.env.ADMIN_SECRET!)}),process.env.TOKEN_ENCRYPTION_KEY!);
 const req=(origin:string,expires:number)=>new NextRequest('http://localhost:3000/api/manual-test',{method:'POST',headers:{origin,cookie:`${COOKIE}=${session(expires)}`}});
 requireAdmin(req('http://localhost:3000',Date.now()+10000));
 assert.throws(()=>requireAdmin(req('https://attacker.example',Date.now()+10000)));
 assert.throws(()=>requireAdmin(req('http://localhost:3000',Date.now()-1)));
});
