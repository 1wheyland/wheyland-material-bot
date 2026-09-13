import { z } from 'zod';
const schema = z.object({
  APP_URL: z.url(), DATABASE_URL: z.string().min(1),
  JOBBER_CLIENT_ID: z.string().min(1), JOBBER_CLIENT_SECRET: z.string().min(1),
  JOBBER_CALLBACK_URL: z.url(), JOBBER_ACCOUNT_ID: z.string().min(1),
  JOBBER_GRAPHQL_VERSION: z.string().default('2026-05-12'),
  OPENAI_API_KEY: z.string().min(1), OPENAI_MODEL: z.string().default('gpt-6-astra'),
  ADMIN_SECRET: z.string().min(32), CRON_SECRET: z.string().min(32),
  TOKEN_ENCRYPTION_KEY: z.string().refine(v => Buffer.from(v, 'base64').length === 32),
  ENABLE_EVENT_WRITES: z.enum(['true', 'false']).default('false'),
  MAX_EVENT_DESCRIPTION_CHARS: z.coerce.number().int().positive().default(20000),
  MAX_SOURCE_CHARS: z.coerce.number().int().positive().default(120000)
});
export function config() {
  const result = schema.safeParse(process.env);
  if (!result.success) throw new Error('CONFIG_INVALID');
  const c = result.data;
  if (new URL(c.JOBBER_CALLBACK_URL).origin !== new URL(c.APP_URL).origin) throw new Error('CONFIG_CALLBACK_ORIGIN');
  if (process.env.NODE_ENV === 'production' && !c.APP_URL.startsWith('https://')) throw new Error('CONFIG_HTTPS_REQUIRED');
  return c;
}
