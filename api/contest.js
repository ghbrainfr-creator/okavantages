/**
 * MonBonAgent — Contest API (Phase 6)
 *
 * Vercel Serverless Function qui gère :
 *   - participate : inscription à un concours (email + partage + RGPD)
 *   - spin        : tour de roue de la chance (appelle register_contest_spin RPC)
 *   - share       : gain de tours bonus après partage (via contest_grant_bonus)
 *   - get         : état public d'un concours + participation existante
 *
 * Environment variables requises :
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (service_role — ne JAMAIS exposer au browser)
 *
 * Endpoint : POST /api/contest
 * Body     : { action, ...payload }
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(res, status, payload) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.status(status).json(payload);
}

async function sbFetch(path, { method = 'GET', body = null, params = '' } = {}) {
  const url = SUPABASE_URL.replace(/\/$/, '') + path + (params ? '?' + params : '');
  const headers = {
    'apikey': SERVICE_KEY,
    'Authorization': 'Bearer ' + SERVICE_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(url, opts);
  const text = await resp.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  if (!resp.ok) throw new Error('Supabase ' + resp.status + ' : ' + (typeof data === 'string' ? data : JSON.stringify(data)));
  return data;
}

function hashIp(ip) {
  if (!ip) return null;
  let h = 5381;
  for (let i = 0; i < ip.length; i++) h = ((h << 5) + h) + ip.charCodeAt(i);
  return 'ip_' + (h >>> 0).toString(36);
}

function randomShareCode() {
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
}

function cleanEmail(e) {
  return String(e || '').trim().toLowerCase();
}

function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

// ----------------------------------------------------------------------------
// Actions
// ----------------------------------------------------------------------------

async function getContest({ contestId, slug, email }) {
  let contest = null;
  if (contestId) {
    const rows = await sbFetch('/rest/v1/contests', { params: 'id=eq.' + encodeURIComponent(contestId) + '&select=*' });
    contest = rows && rows[0];
  }
  if (!contest && slug) {
    const rows = await sbFetch('/rest/v1/contests', { params: 'slug=eq.' + encodeURIComponent(slug) + '&select=*' });
    contest = rows && rows[0];
  }
  if (!contest) return { ok: false, error: 'contest_not_found' };

  // Participation de l'utilisateur si email fourni
  let participation = null;
  if (email && isValidEmail(email)) {
    const rows = await sbFetch('/rest/v1/contest_participations', {
      params: 'contest_id=eq.' + contest.id + '&email=eq.' + encodeURIComponent(cleanEmail(email)) + '&select=*'
    });
    participation = rows && rows[0];
  }

  // Ne renvoie pas les infos internes sensibles
  const publicContest = {
    id: contest.id,
    merchant_id: contest.merchant_id,
    city_id: contest.city_id,
    title: contest.title,
    description: contest.description,
    prize_description: contest.prize_description,
    prize_value: contest.prize_value,
    prize_image: contest.prize_image,
    cover_image: contest.cover_image,
    cta_text: contest.cta_text,
    starts_at: contest.starts_at,
    ends_at: contest.ends_at,
    status: contest.status,
    selection_interval: contest.selection_interval,
    total_spins: contest.total_spins,
    total_participants: contest.total_participants,
    total_shares: contest.total_shares,
    spins_per_signup: contest.spins_per_signup,
    spins_per_share: contest.spins_per_share,
    max_spins_per_user: contest.max_spins_per_user,
    next_winner_in: Math.max(1, contest.selection_interval - (contest.total_spins % contest.selection_interval)),
    has_winner: !!contest.winner_participation_id
  };

  return { ok: true, contest: publicContest, participation: participation ? {
    id: participation.id,
    email: participation.email,
    first_name: participation.first_name,
    spins_earned: participation.spins_earned,
    spins_used: participation.spins_used,
    shares_count: participation.shares_count,
    share_code: participation.share_code,
    is_selected: participation.is_selected,
    is_winner: participation.is_winner
  } : null };
}

async function participate({ contestId, email, first_name, last_name, phone, city_id, agent_id, consent_newsletter, consent_agent, consent_rules, ref_code, utm, ip, user_agent }) {
  if (!contestId) return { ok: false, error: 'contest_id_required' };
  email = cleanEmail(email);
  if (!isValidEmail(email)) return { ok: false, error: 'invalid_email' };
  if (!consent_rules) return { ok: false, error: 'consent_rules_required' };

  const contestRows = await sbFetch('/rest/v1/contests', { params: 'id=eq.' + encodeURIComponent(contestId) + '&select=*' });
  const contest = contestRows && contestRows[0];
  if (!contest) return { ok: false, error: 'contest_not_found' };
  if (contest.status !== 'active') return { ok: false, error: 'contest_not_active', status: contest.status };
  if (new Date(contest.ends_at) < new Date()) return { ok: false, error: 'contest_ended' };
  if (contest.winner_participation_id) return { ok: false, error: 'already_won' };
  if (contest.require_consent_newsletter && !consent_newsletter) return { ok: false, error: 'consent_newsletter_required' };
  if (contest.require_consent_agent && !consent_agent) return { ok: false, error: 'consent_agent_required' };

  // Lookup existant
  const existingRows = await sbFetch('/rest/v1/contest_participations', {
    params: 'contest_id=eq.' + contestId + '&email=eq.' + encodeURIComponent(email) + '&select=*'
  });
  if (existingRows && existingRows[0]) {
    // Déjà inscrit → on renvoie l'état courant, on n'ajoute pas de tours
    const p = existingRows[0];
    return { ok: true, already_registered: true, participation: {
      id: p.id, email: p.email, first_name: p.first_name,
      spins_earned: p.spins_earned, spins_used: p.spins_used,
      shares_count: p.shares_count, share_code: p.share_code,
      is_selected: p.is_selected, is_winner: p.is_winner
    }};
  }

  // Résolution agent : priorité au param, sinon city_lead_agent, sinon null
  let resolvedAgentId = agent_id || null;
  if (!resolvedAgentId && city_id) {
    try {
      const agentRows = await sbFetch('/rest/v1/city_lead_agent', {
        params: 'city_id=eq.' + city_id + '&select=agent_id'
      });
      if (agentRows && agentRows[0]) resolvedAgentId = agentRows[0].agent_id;
    } catch (e) { /* ignore */ }
  }

  // Lookup referred_by via share_code si fourni
  let referredBy = null;
  if (ref_code) {
    const refRows = await sbFetch('/rest/v1/contest_participations', {
      params: 'share_code=eq.' + encodeURIComponent(ref_code) + '&contest_id=eq.' + contestId + '&select=id'
    });
    if (refRows && refRows[0]) referredBy = refRows[0].id;
  }

  const payload = {
    contest_id: contestId,
    email,
    first_name: first_name || null,
    last_name: last_name || null,
    phone: phone || null,
    city_id: city_id || null,
    agent_id: resolvedAgentId,
    spins_earned: contest.spins_per_signup || 1,
    spins_used: 0,
    shares_count: 0,
    share_code: randomShareCode(),
    referred_by: referredBy,
    consent_newsletter: !!consent_newsletter,
    consent_agent: !!consent_agent,
    consent_rules: !!consent_rules,
    ip_hash: hashIp(ip),
    user_agent: user_agent || null,
    utm_source: (utm && utm.source) || null,
    utm_medium: (utm && utm.medium) || null,
    utm_campaign: (utm && utm.campaign) || null
  };

  const inserted = await sbFetch('/rest/v1/contest_participations', { method: 'POST', body: payload });
  const part = inserted && inserted[0];

  // Incrémente le compteur total_participants
  try {
    await sbFetch('/rest/v1/contests?id=eq.' + contestId, {
      method: 'PATCH',
      body: { total_participants: (contest.total_participants || 0) + 1 }
    });
  } catch (e) { /* non-fatal */ }

  // Si referred_by, grant bonus à celui qui a partagé
  if (referredBy) {
    try {
      await sbFetch('/rest/v1/rpc/contest_grant_bonus', { method: 'POST', body: {
        p_participation_id: referredBy,
        p_spins: contest.spins_per_share || 1,
        p_reason: 'share'
      }});
    } catch (e) { /* non-fatal */ }
  }

  return { ok: true, participation: {
    id: part.id, email: part.email, first_name: part.first_name,
    spins_earned: part.spins_earned, spins_used: part.spins_used,
    shares_count: part.shares_count, share_code: part.share_code,
    is_selected: part.is_selected, is_winner: part.is_winner
  }};
}

async function spin({ contestId, participationId, source }) {
  if (!contestId || !participationId) return { ok: false, error: 'missing_params' };
  const result = await sbFetch('/rest/v1/rpc/register_contest_spin', {
    method: 'POST',
    body: {
      p_contest_id: contestId,
      p_participation_id: participationId,
      p_source: source || 'wheel'
    }
  });
  return result;
}

async function share({ participationId }) {
  if (!participationId) return { ok: false, error: 'missing_participation_id' };
  // Récupère la participation pour connaître les règles du contest
  const rows = await sbFetch('/rest/v1/contest_participations', { params: 'id=eq.' + participationId + '&select=*,contest:contests(spins_per_share,max_spins_per_user)' });
  const p = rows && rows[0];
  if (!p) return { ok: false, error: 'not_found' };

  const result = await sbFetch('/rest/v1/rpc/contest_grant_bonus', {
    method: 'POST',
    body: {
      p_participation_id: participationId,
      p_spins: (p.contest && p.contest.spins_per_share) || 1,
      p_reason: 'share'
    }
  });
  return result;
}

// ----------------------------------------------------------------------------
// Handler
// ----------------------------------------------------------------------------

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json(res, 500, { ok: false, error: 'supabase_env_missing — configure SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans Vercel → Settings → Environment Variables.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { return json(res, 400, { ok: false, error: 'invalid_json' }); }
  }
  body = body || {};

  const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || '';
  const ua = req.headers['user-agent'] || '';

  try {
    let result;
    switch (body.action) {
      case 'get':
        result = await getContest(body);
        break;
      case 'participate':
        result = await participate(Object.assign({}, body, { ip, user_agent: ua }));
        break;
      case 'spin':
        result = await spin(body);
        break;
      case 'share':
        result = await share(body);
        break;
      default:
        return json(res, 400, { ok: false, error: 'unknown_action', allowed: ['get','participate','spin','share'] });
    }
    return json(res, 200, result);
  } catch (e) {
    return json(res, 500, { ok: false, error: 'server_error', detail: e.message || String(e) });
  }
};
