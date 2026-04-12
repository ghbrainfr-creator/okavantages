/**
 * MonBonAgent — Agent Site API (Phase 7 multi-tenant)
 *
 * Returns everything a public agent microsite needs, scoped by agent slug:
 *   - agent (profile + brand)
 *   - merchants (published for the agent)
 *   - blog_posts (published for the agent)
 *   - active contest (if any)
 *   - footer (sections + links + list of footer pages)
 *   - footer_page (on-demand when ?page=slug is passed)
 *
 * Endpoint: GET /api/agent-site?slug=nordine-mouaouia
 *           GET /api/agent-site?slug=nordine-mouaouia&page=mentions-legales
 *
 * Env vars required:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(res, status, payload) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300');
  res.status(status).json(payload);
}

async function sb(path, params = '') {
  const url = SUPABASE_URL.replace(/\/$/, '') + path + (params ? '?' + params : '');
  const r = await fetch(url, {
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': 'Bearer ' + SERVICE_KEY,
      'Content-Type': 'application/json'
    }
  });
  const t = await r.text();
  let data = null;
  try { data = t ? JSON.parse(t) : null; } catch (e) { data = t; }
  if (!r.ok) throw new Error('Supabase ' + r.status + ' : ' + (typeof data === 'string' ? data : JSON.stringify(data)));
  return data;
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') { json(res, 200, { ok: true }); return; }
  if (req.method !== 'GET') { json(res, 405, { ok: false, error: 'method_not_allowed' }); return; }

  try {
    const slug = String(req.query.slug || '').trim().toLowerCase();
    const pageSlug = String(req.query.page || '').trim().toLowerCase();
    if (!slug) { json(res, 400, { ok: false, error: 'slug_required' }); return; }

    // 1. Fetch agent
    const agents = await sb('/rest/v1/agents', 'slug=eq.' + encodeURIComponent(slug) + '&select=id,slug,name,title,agency,email,phone,whatsapp,photo_url,cover_url,bio,signature,specialties,linkedin_url,instagram_url,website_url,years_experience,brand,city_id&is_active=eq.true&limit=1');
    const agent = agents && agents[0];
    if (!agent) { json(res, 404, { ok: false, error: 'agent_not_found' }); return; }

    // ------------------------------------------------------------------
    // On-demand single footer page (used by /footer-page.html?slug=...)
    // ------------------------------------------------------------------
    if (pageSlug) {
      const pages = await sb('/rest/v1/footer_pages', 'agent_id=eq.' + agent.id + '&slug=eq.' + encodeURIComponent(pageSlug) + '&select=slug,title,body_html,meta_description,is_legal,updated_at&limit=1');
      if (!pages || !pages[0]) { json(res, 404, { ok: false, error: 'page_not_found' }); return; }
      json(res, 200, { ok: true, agent: { id: agent.id, slug: agent.slug, name: agent.name, brand: agent.brand || null }, page: pages[0] });
      return;
    }

    // 2. Parallel fetch of site data
    const agentId = agent.id;
    const [merchants, posts, contests, sections, links, pages, city] = await Promise.all([
      sb('/rest/v1/merchants', 'owner_agent_id=eq.' + agentId + '&status=eq.published&select=id,slug,name,city_id,created_at&order=name.asc'),
      sb('/rest/v1/blog_posts', 'owner_agent_id=eq.' + agentId + '&status=eq.published&select=id,title,published_at&order=published_at.desc.nullslast&limit=20'),
      sb('/rest/v1/contests',   'agent_id=eq.' + agentId + '&status=eq.active&select=id,slug,title,created_at&order=created_at.desc&limit=1'),
      sb('/rest/v1/footer_sections', 'agent_id=eq.' + agentId + '&is_active=eq.true&select=id,title,sort_order&order=sort_order.asc'),
      sb('/rest/v1/footer_links',    'select=id,section_id,label,url,sort_order&order=sort_order.asc'),
      sb('/rest/v1/footer_pages',    'agent_id=eq.' + agentId + '&select=slug,title,is_legal&order=title.asc'),
      agent.city_id ? sb('/rest/v1/cities', 'id=eq.' + agent.city_id + '&select=id,slug,name&limit=1') : Promise.resolve([])
    ]);

    // Attach links to their section, keeping only links of this agent's sections
    const sectionIds = new Set((sections || []).map(s => s.id));
    const scopedLinks = (links || []).filter(l => sectionIds.has(l.section_id));
    const footer = (sections || []).map(s => ({
      id: s.id,
      title: s.title,
      sort_order: s.sort_order,
      links: scopedLinks.filter(l => l.section_id === s.id)
    }));

    json(res, 200, {
      ok: true,
      agent: {
        id: agent.id,
        slug: agent.slug,
        name: agent.name,
        title: agent.title,
        agency: agent.agency,
        email: agent.email,
        phone: agent.phone,
        whatsapp: agent.whatsapp,
        photo_url: agent.photo_url,
        cover_url: agent.cover_url,
        bio: agent.bio,
        signature: agent.signature,
        specialties: agent.specialties || [],
        linkedin_url: agent.linkedin_url,
        instagram_url: agent.instagram_url,
        website_url: agent.website_url,
        years_experience: agent.years_experience,
        brand: agent.brand || null,
        city: (city && city[0]) || null
      },
      merchants: merchants || [],
      blog: posts || [],
      contest: (contests && contests[0]) || null,
      footer: {
        sections: footer,
        pages: pages || []
      }
    });
  } catch (e) {
    json(res, 500, { ok: false, error: String(e && e.message || e) });
  }
};
