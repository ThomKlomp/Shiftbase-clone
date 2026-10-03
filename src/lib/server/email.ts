export interface OutboxRow { id: string; kind: string; payload: Record<string, unknown>; email: string; first_name: string; attempts: number }
export type SendFn = (to: string, subject: string, text: string) => Promise<void>;

/** Templates written for this product. Plain text on purpose: it always renders and never lands as promotional. */
export function renderEmail(row: Pick<OutboxRow, 'kind' | 'payload' | 'first_name'>, appUrl: string): { subject: string; text: string } {
  const hi = `Hoi ${row.first_name},`;
  const p = row.payload as Record<string, string>;
  const link = (path: string) => `${appUrl}${path}`;
  const t: Record<string, [string, string]> = {
    publish: ['Je rooster is gepubliceerd', `Er staat een nieuw rooster voor je klaar.\n${link('/mijn-rooster')}`],
    open_shift: ['Er is een open dienst', `Er is een open dienst waar je voor in aanmerking komt.\n${link('/open-diensten')}`],
    open_request: ['Iemand wil een open dienst', `Een medewerker heeft een open dienst aangevraagd.\n${link('/open-diensten')}`],
    absence_decision: [`Je verlof is ${p.status === 'approved' ? 'goedgekeurd' : 'afgewezen'}`, `Bekijk je verlofaanvraag.\n${link('/verlof')}`],
    absence_request: ['Nieuwe verlofaanvraag', `Er wacht een verlofaanvraag op je beoordeling.\n${link('/verlof')}`],
    exchange: ['Update over een ruil', `Er is iets veranderd aan een ruilverzoek.\n${link('/ruilen')}`],
    exchange_review: ['Een ruil wacht op jou', `Een ruil moet nog worden goedgekeurd.\n${link('/ruilen')}`],
    availability_reminder: ['Geef je beschikbaarheid door', `Je hebt je beschikbaarheid voor volgende week nog niet (volledig) ingevuld.\n${link('/beschikbaarheid')}`],
  };
  const [subject, body] = t[row.kind] ?? ['Nieuwe melding', `Je hebt een nieuwe melding.\n${link('/meldingen')}`];
  return { subject, text: `${hi}\n\n${body}\n\nJe kunt meldingen per e-mail uitzetten in je profiel.` };
}

export function resendSender(apiKey: string, from: string, fetchImpl: typeof fetch = fetch): SendFn {
  return async (to, subject, text) => {
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    if (!res.ok) throw new Error(`resend ${res.status}`);
  };
}

type Rpc = { rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> };

/** Claim, send, and put failures back. A crash between claim and send loses at most one batch of emails; the in-app notification still exists. */
export async function processOutbox(db: Rpc, send: SendFn, appUrl: string, limit = 50) {
  const { data, error } = await db.rpc('claim_notification_emails', { p_limit: limit });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as OutboxRow[];
  let sent = 0, failed = 0;
  for (const row of rows) {
    try {
      const { subject, text } = renderEmail(row, appUrl);
      await send(row.email, subject, text);
      sent++;
    } catch (e) {
      failed++;
      await db.rpc('release_notification', { p_id: row.id, p_error: e instanceof Error ? e.message : 'unknown' });
    }
  }
  return { claimed: rows.length, sent, failed };
}
