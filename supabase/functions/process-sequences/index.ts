// deno-lint-ignore-file no-explicit-any
// Supabase Edge Function — process-sequences
// -----------------------------------------------------------------------------
// Runs on a cron schedule. Finds all active email_sequences and, for each,
// identifies leads that should receive the sequence's email but haven't yet.
// Calls the send-email function for every eligible (sequence, lead) pair.
//
// Trigger types supported:
//   - new_lead         → lead.created_at + delay_hours <= now
//   - lead_converted   → lead.status='converted' AND converted_at + delay_hours <= now
//   - birthday         → MM-DD of lead.birthday = today
//
// Idempotency: uses email_logs to dedupe (sequence_id + lead_id).
//
// Schedule with Supabase:
//   SELECT cron.schedule('process-sequences-hourly', '0 * * * *',
//     $$ SELECT net.http_post(
//          url := 'https://<project>.functions.supabase.co/process-sequences',
//          headers := jsonb_build_object('Authorization','Bearer <SERVICE_ROLE_KEY>')
//        ) $$);
// -----------------------------------------------------------------------------

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function callSendEmail(payload: any) {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return { ok: resp.ok, body: await resp.json().catch(() => ({})) };
}

serve(async (_req) => {
  const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const now = new Date();

  // Fetch active sequences
  const { data: sequences, error: sqErr } = await db
    .from("email_sequences").select("*").eq("active", true);
  if (sqErr) {
    return new Response(JSON.stringify({ error: sqErr.message }), { status: 500 });
  }

  let processed = 0;
  let sent = 0;
  const errors: string[] = [];

  for (const seq of sequences || []) {
    const delayMs = (seq.delay_hours || 0) * 3600_000;

    let leadsQuery = db.from("leads").select("*").eq("merchant_id", seq.merchant_id);
    if (seq.trigger === "new_lead") {
      leadsQuery = leadsQuery.lte("created_at", new Date(now.getTime() - delayMs).toISOString());
    } else if (seq.trigger === "lead_converted") {
      leadsQuery = leadsQuery.eq("status", "converted")
        .lte("converted_at", new Date(now.getTime() - delayMs).toISOString());
    } else if (seq.trigger === "birthday") {
      const mmdd = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      // naive filter — for real use add a stored computed column
      leadsQuery = leadsQuery.not("birthday", "is", null);
    }

    const { data: leads, error: leadErr } = await leadsQuery.limit(500);
    if (leadErr) { errors.push(`seq ${seq.id}: ${leadErr.message}`); continue; }

    for (const lead of leads || []) {
      processed++;

      // Birthday check (client-side since Postgres can't filter on MM-DD easily)
      if (seq.trigger === "birthday" && lead.birthday) {
        const d = new Date(lead.birthday);
        if (d.getMonth() !== now.getMonth() || d.getDate() !== now.getDate()) continue;
      }

      // Dedupe: has this sequence already sent to this lead?
      const { data: already } = await db.from("email_logs")
        .select("id").eq("sequence_id", seq.id).eq("lead_id", lead.id).maybeSingle();
      if (already) continue;

      const r = await callSendEmail({
        template_id: seq.template_id,
        lead_id: lead.id,
        merchant_id: seq.merchant_id,
        sequence_id: seq.id,
      });
      if (r.ok) sent++;
      else errors.push(`seq ${seq.id} / lead ${lead.id}: ${JSON.stringify(r.body)}`);
    }
  }

  return new Response(JSON.stringify({
    ok: true, processed, sent, errors, at: now.toISOString(),
  }), { headers: { "Content-Type": "application/json" } });
});
