import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import type { Query } from '../src/db';
export function testEnv() {
 Object.assign(process.env,{APP_URL:'http://localhost:3000',DATABASE_URL:'postgres://test:test@localhost/test',JOBBER_CLIENT_ID:'test-client',JOBBER_CLIENT_SECRET:'test-only',
 JOBBER_CALLBACK_URL:'http://localhost:3000/api/oauth/callback',JOBBER_ACCOUNT_ID:'test-account',OPENAI_API_KEY:'test-only',
 ADMIN_SECRET:'a'.repeat(40),CRON_SECRET:'b'.repeat(40),TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64')});
}
export async function database() {
 const db=new PGlite();await db.exec(await readFile(new URL('../migrations/001_initial.sql',import.meta.url),'utf8'));
 const query:Query=async(sql,values)=>{const result=await db.query(sql,values);return {rows:result.rows as never[],rowCount:result.affectedRows??0};};
 return {db,query};
}
