import pg from 'pg';
import { config } from './config';
let pool: pg.Pool | undefined;
export function db() {
  return pool ??= new pg.Pool({ connectionString: config().DATABASE_URL, max: 3,
    connectionTimeoutMillis: 10000, idleTimeoutMillis: 20000, statement_timeout: 15000 });
}
export type Query = <T extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, values?: unknown[]) => Promise<{ rows: T[]; rowCount: number | null }>;
export const query: Query = (sql, values) => db().query(sql, values);
