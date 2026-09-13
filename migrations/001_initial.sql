CREATE TABLE IF NOT EXISTS connections (
 account_id text PRIMARY KEY,
 access_token text NOT NULL,
 refresh_token text NOT NULL,
 expires_at timestamptz NOT NULL,
 refresh_state text NOT NULL DEFAULT 'ready' CHECK (refresh_state IN ('ready','refreshing','reconnect')),
 refresh_owner uuid,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS oauth_states (
 state_hash text PRIMARY KEY,
 verifier text NOT NULL,
 expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS daily_runs (
 account_id text NOT NULL,
 local_date text NOT NULL,
 run_id uuid NOT NULL,
 state text NOT NULL CHECK (state IN ('processing','failed','creating','uncertain','created')),
 lease_until timestamptz NOT NULL,
 event_id text,
 description text,
 error_code text,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (account_id,local_date),
 CHECK (state <> 'created' OR event_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS daily_event_unique ON daily_runs(account_id,event_id) WHERE event_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS login_limits (bucket text PRIMARY KEY,attempts integer NOT NULL,expires_at timestamptz NOT NULL);
