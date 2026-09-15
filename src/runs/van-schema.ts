// Additive migration: the original daily run history is preserved.
export const VAN_SCHEMA = `CREATE TABLE IF NOT EXISTS van_daily_runs (
 account_id text NOT NULL, local_date text NOT NULL, van_key text NOT NULL CHECK (van_key IN ('tim','niall')),
 run_id uuid NOT NULL, state text NOT NULL CHECK (state IN ('processing','failed','creating','uncertain','created')),
 lease_until timestamptz NOT NULL, event_id text, description text, error_code text, updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(account_id,local_date,van_key), CHECK (state <> 'created' OR event_id IS NOT NULL));
 CREATE UNIQUE INDEX IF NOT EXISTS van_event_unique ON van_daily_runs(account_id,event_id) WHERE event_id IS NOT NULL;`;
