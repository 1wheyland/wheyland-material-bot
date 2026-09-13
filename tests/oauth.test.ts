import { test } from 'node:test';
import assert from 'node:assert/strict';
import { database,testEnv } from './helpers';
import { accessToken } from '../src/oauth';
import { decrypt,encrypt,equal } from '../src/security';
testEnv();
test('encrypted tokens authenticate ciphertext and compare secrets',()=>{
 const key=process.env.TOKEN_ENCRYPTION_KEY!,encoded=encrypt('private-value',key);
 assert.equal(decrypt(encoded,key),'private-value');assert.ok(!encoded.includes('private-value'));
 assert.throws(()=>decrypt(encoded,Buffer.alloc(32,8).toString('base64')));
 assert.equal(equal('abc','abc'),true);assert.equal(equal('abc','abcd'),false);
});
test('concurrent refresh rotates once and stores both new tokens before returning',async()=>{
 const {db,query}=await database();try {
  const key=process.env.TOKEN_ENCRYPTION_KEY!;let calls=0;
  await query("INSERT INTO connections(account_id,access_token,refresh_token,expires_at) VALUES ('test-account',$1,$2,now()-interval '1 minute')",[encrypt('old-access',key),encrypt('old-refresh',key)]);
  const exchange=async(fields:Record<string,string>)=>{calls++;assert.equal(fields.refresh_token,'old-refresh');return {access_token:'new-access',refresh_token:'new-refresh',expires_in:3600};};
  const tokens=await Promise.all([accessToken(undefined,{query,exchange}),accessToken(undefined,{query,exchange})]);
  assert.deepEqual(tokens,['new-access','new-access']);assert.equal(calls,1);
  const row=(await query('SELECT * FROM connections')).rows[0];assert.equal(decrypt(row.refresh_token,key),'new-refresh');assert.equal(row.refresh_state,'ready');
  assert.equal(await accessToken('old-access',{query,exchange}),'new-access');assert.equal(calls,1);
 }finally{await db.close();}
});
test('lost refresh response requires reconnection and never reuses old token',async()=>{
 const {db,query}=await database();try {
  const key=process.env.TOKEN_ENCRYPTION_KEY!;let calls=0;
  await query("INSERT INTO connections(account_id,access_token,refresh_token,expires_at) VALUES ('test-account',$1,$2,now()-interval '1 minute')",[encrypt('old-access',key),encrypt('old-refresh',key)]);
  const exchange=async()=>{calls++;throw new Error('timeout');};
  await assert.rejects(accessToken(undefined,{query,exchange}),/OAUTH_RECONNECT_REQUIRED/);
  await assert.rejects(accessToken(undefined,{query,exchange}),/OAUTH_RECONNECT_REQUIRED/);assert.equal(calls,1);
 }finally{await db.close();}
});
