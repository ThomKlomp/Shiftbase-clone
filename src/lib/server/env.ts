import { z } from 'zod';

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
  STRIPE_PRICE_ID: z.string().startsWith('price_'),
  RESEND_API_KEY: z.string().startsWith('re_'),
  EMAIL_FROM: z.string().min(3),
  APP_URL: z.string().url(),
  CRON_SECRET: z.string().min(24),
});
export type ServerEnv = z.infer<typeof schema>;

/** Read lazily so `next build` works without secrets; a route fails loudly at request time instead. */
export function serverEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  const r = schema.safeParse(source);
  if (!r.success) throw new Error(`Ontbrekende of ongeldige omgevingsvariabelen: ${r.error.issues.map((i) => i.path.join('.')).join(', ')}`);
  return r.data;
}
