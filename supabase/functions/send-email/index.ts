// deno-lint-ignore-file no-explicit-any
// Supabase Edge Function — send-email
// -----------------------------------------------------------------------------
// Sends a single transactional email using Resend on behalf of a merchant.
// The sender is always okavantages@resend.dev (with "{merchant.name}" as the
// display name, so the lead sees the merchant, not MonBonAgent).
//
// POST body:
//   { template_id: uuid, lead_id: uuid, merchant_id?: uuid, sequence_id?: uuid }
//
// Secrets required (set via `supabase secrets set`):
//   RESEND_API_KEY        — your Resend API key
//   SUPABASE_URL          — auto-set by Supabase
//   SUPABASE_SERVICE_ROLE_KEY — auto-set by Supabase
// -----------------------------------------------------------------------------

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const FROM_EMAIL = "okavantages@resend.dev";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function render(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, k) => vars[k] ?? "");
}

async function sendOne(payload: any, db: any) {
  const { template_id, lead_id, merchant_id, sequence_id } = payload;
  if (!template_id || !lead_id) {
    return { status: 400, body: { error: "template_id and lead_id are required" } };
  }

  // Load template
  const { data: tpl, error: tplErr } = await db
    .from("email_templates").select("*").eq("id", template_id).maybeSingle();
  if (tplErr || !tpl) return { status: 404, body: { error: "Template not found" } };

  // Load lead
  const { data: lead, error: leadErr } = await db
    .from("leads").select("*").eq("id", lead_id).maybeSingle();
  if (leadErr || !lead) return { status: 404, body: { error: "Lead not found" } };

  const mid = merchant_id || tpl.merchant_id || lead.merchant_id;
  // Load merchant
  const { data: merchant } = await db
    .from("merchants").select("*").eq("id", mid).maybeSingle();

  // Load site_settings for agent info
  const { data: settings } = await db.from("site_settings").select("*").limit(1).maybeSingle();

  // Optional: load offer
  let offer: any = null;
  if (lead.offer_id) {
    const { data } = await db.from("offers").select("*").eq("id", lead.offer_id).maybeSingle();
    offer = data;
  }

  const vars: Record<string, string> = {
    nom: lead.name || "",
    email: lead.email || "",
    commerce: merchant?.name || "",
    adresse: merchant?.address || "",
    offre: offer?.name || offer?.description || "",
    prix: String(offer?.price ?? ""),
    gift: String(offer?.gift ?? ""),
    agent_nom: settings?.agent_name || "",
    agent_tel: settings?.agent_tel || "",
  };

  const subject = render(tpl.subject || "", vars);
  const html = render(tpl.body || "", vars);
  const fromName = (merchant?.name || settings?.site_title || "MonBonAgent")
    .replace(/[<>]/g, "")
    .slice(0, 60);
  const from = `${fromName} <${FROM_EMAIL}>`;

  // Send via Resend
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [lead.email],
      subject,
      html,
      reply_to: merchant?.email || settings?.contact_email || undefined,
    }),
  });

  const body = await resp.json().catch(() => ({}));

  // Log
  await db.from("email_logs").insert({
    lead_id,
    merchant_id: mid,
    template_id: tpl.id,
    sequence_id: sequence_id || null,
    subject,
    recipient: lead.email,
    status: resp.ok ? "sent" : "error",
    resend_id: body?.id || null,
    error: resp.ok ? null : (body?.message || `HTTP ${resp.status}`),
  });

  return {
    status: resp.ok ? 200 : 502,
    body: resp.ok ? { ok: true, resend_id: body?.id } : { error: body?.message || "Send failed" },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const db = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });
    const payload = await req.json();
    const result = await sendOne(payload, db);
    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
