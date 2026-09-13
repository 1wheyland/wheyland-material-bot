import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { config } from './config';
import { query } from './db';
import { decrypt, encrypt, hash, randomSecret } from './security';
import { log } from './log';
const tokenSchema = z.object({ access_token: z.string().min(1), refresh_token: z.string().min(1), expires_in: z.number().positive(), warning: z.string().optional() });
export async function exchange(fields: Record<string, string>) {
  const c = config();
  // Never retry token redemption: a timeout may already have consumed the refresh token.
  const response = await fetch('https://api.getjobber.com/api/oauth/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: c.JOBBER_CLIENT_ID, client_secret: c.JOBBER_CLIENT_SECRET, ...fields }),
    signal: AbortSignal.timeout(20000), cache: 'no-store'
  });
  if (!response.ok) throw new Error('OAUTH_RECONNECT_REQUIRED');
  const parsed = tokenSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error('OAUTH_INVALID_RESPONSE');
  if (parsed.data.warning) log('oauth_warning', { code: 'ROTATION_CONFIGURATION_WARNING' });
  return parsed.data;
}
export async function startOAuth() {
  const c = config(), state = randomSecret(), verifier = randomSecret();
  await query('DELETE FROM oauth_states WHERE expires_at < now()');
  await query("INSERT INTO oauth_states VALUES ($1,$2,now()+interval '10 minutes')", [hash(state), encrypt(verifier, c.TOKEN_ENCRYPTION_KEY)]);
  const url = new URL('https://api.getjobber.com/api/oauth/authorize');
  url.search = new URLSearchParams({ response_type: 'code', client_id: c.JOBBER_CLIENT_ID,
    redirect_uri: c.JOBBER_CALLBACK_URL, state, code_challenge: hash(verifier), code_challenge_method: 'S256' }).toString();
  return { state, url: url.toString() };
}
export async function finishOAuth(code: string, state: string) {
  const c = config();
  const result = await query('DELETE FROM oauth_states WHERE state_hash=$1 AND expires_at>now() RETURNING verifier', [hash(state)]);
  if (!result.rows[0]) throw new Error('OAUTH_STATE_INVALID');
  const tokens = await exchange({ grant_type: 'authorization_code', code, redirect_uri: c.JOBBER_CALLBACK_URL,
    code_verifier: decrypt(result.rows[0].verifier, c.TOKEN_ENCRYPTION_KEY) });
  const response = await fetch('https://api.getjobber.com/api/graphql', { method: 'POST',
    headers: { Authorization: `Bearer ${tokens.access_token}`, 'Content-Type': 'application/json', 'X-JOBBER-GRAPHQL-VERSION': c.JOBBER_GRAPHQL_VERSION },
    body: JSON.stringify({ query: 'query MaterialBotAccount { account { id } }' }), signal: AbortSignal.timeout(20000), cache: 'no-store' });
  const account = await response.json();
  if (!response.ok || account.errors?.length || account.data?.account?.id !== c.JOBBER_ACCOUNT_ID) throw new Error('OAUTH_ACCOUNT_MISMATCH');
  await query(`INSERT INTO connections(account_id,access_token,refresh_token,expires_at) VALUES ($1,$2,$3,$4)
    ON CONFLICT(account_id) DO UPDATE SET access_token=$2,refresh_token=$3,expires_at=$4,refresh_state='ready',refresh_owner=NULL,updated_at=now()`,
  [c.JOBBER_ACCOUNT_ID, encrypt(tokens.access_token,c.TOKEN_ENCRYPTION_KEY), encrypt(tokens.refresh_token,c.TOKEN_ENCRYPTION_KEY), new Date(Date.now()+tokens.expires_in*1000)]);
  log('oauth_connected');
}
export async function accessToken(rejectedToken?: string, deps = {query,exchange}): Promise<string> {
  const c = config();
  for (let attempt=0; attempt<25; attempt++) {
    const row = (await deps.query('SELECT * FROM connections WHERE account_id=$1', [c.JOBBER_ACCOUNT_ID])).rows[0];
    if (!row || row.refresh_state === 'reconnect') throw new Error('OAUTH_RECONNECT_REQUIRED');
    if (row.refresh_state === 'refreshing') {
      if (Date.now()-new Date(row.updated_at).getTime()>30000) throw new Error('OAUTH_RECONNECT_REQUIRED');
      await new Promise(r=>setTimeout(r,1000)); continue;
    }
    const current = decrypt(row.access_token,c.TOKEN_ENCRYPTION_KEY);
    if (new Date(row.expires_at).getTime()>Date.now()+120000 && current!==rejectedToken) return current;
    const owner = randomUUID();
    const claim = await deps.query(`UPDATE connections SET refresh_state='refreshing',refresh_owner=$3,updated_at=now()
      WHERE account_id=$1 AND access_token=$2 AND refresh_state='ready' RETURNING refresh_token`, [c.JOBBER_ACCOUNT_ID,row.access_token,owner]);
    if (!claim.rows[0]) continue;
    try {
      const tokens = await deps.exchange({ grant_type: 'refresh_token', refresh_token: decrypt(claim.rows[0].refresh_token,c.TOKEN_ENCRYPTION_KEY) });
      const saved = await deps.query(`UPDATE connections SET access_token=$3,refresh_token=$4,expires_at=$5,refresh_state='ready',refresh_owner=NULL,updated_at=now()
        WHERE account_id=$1 AND refresh_owner=$2 RETURNING account_id`,
      [c.JOBBER_ACCOUNT_ID,owner,encrypt(tokens.access_token,c.TOKEN_ENCRYPTION_KEY),encrypt(tokens.refresh_token,c.TOKEN_ENCRYPTION_KEY),new Date(Date.now()+tokens.expires_in*1000)]);
      if (!saved.rowCount) throw new Error('OAUTH_CONNECTION_CHANGED');
      return tokens.access_token;
    } catch {
      await deps.query("UPDATE connections SET refresh_state='reconnect',updated_at=now() WHERE account_id=$1 AND refresh_owner=$2",[c.JOBBER_ACCOUNT_ID,owner]);
      throw new Error('OAUTH_RECONNECT_REQUIRED');
    }
  }
  throw new Error('OAUTH_REFRESH_BUSY');
}
