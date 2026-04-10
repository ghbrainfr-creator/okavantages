// ============================================================
// Edge Function: enrich-merchant
// Scrape OpenGraph / meta tags from any public URL (website,
// Instagram, Facebook page, Google Business profile…) to
// auto-populate a merchant record in MonBonAgent.
// ============================================================
//
// POST /functions/v1/enrich-merchant
// Body: { "url": "https://instagram.com/somebakery" }
//
// Response:
// {
//   name, description, image_url, site_url,
//   social_links: { facebook, instagram, ... },
//   source_url, enriched_at
// }
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface EnrichmentResult {
  name: string | null;
  description: string | null;
  image_url: string | null;
  site_url: string | null;
  category: string | null;
  address: string | null;
  social_links: Record<string, string>;
  source_url: string;
  enriched_at: string;
  raw: Record<string, string>;
}

function pickMeta(html: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) return decodeEntities(m[1].trim());
  }
  return null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function extractAllMeta(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re =
    /<meta[^>]+(?:property|name)=["']([^"']+)["'][^>]+content=["']([^"']*)["'][^>]*>/gi;
  const reAlt =
    /<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    out[m[1].toLowerCase()] = decodeEntities(m[2]);
  }
  while ((m = reAlt.exec(html)) !== null) {
    if (!out[m[2].toLowerCase()]) out[m[2].toLowerCase()] = decodeEntities(m[1]);
  }
  return out;
}

function absolutize(url: string | null, base: string): string | null {
  if (!url) return null;
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}

function detectSocial(html: string, baseUrl: string): Record<string, string> {
  const social: Record<string, string> = {};
  const patterns: Array<[string, RegExp]> = [
    ['facebook', /https?:\/\/(?:www\.)?facebook\.com\/[^\s"'<>]+/i],
    ['instagram', /https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>/]+/i],
    ['linkedin', /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[^\s"'<>]+/i],
    ['twitter', /https?:\/\/(?:www\.)?(?:x|twitter)\.com\/[^\s"'<>/]+/i],
    ['tiktok', /https?:\/\/(?:www\.)?tiktok\.com\/@[^\s"'<>/]+/i],
    ['youtube', /https?:\/\/(?:www\.)?youtube\.com\/(?:channel|c|user|@)[^\s"'<>]+/i],
  ];
  for (const [key, re] of patterns) {
    const m = html.match(re);
    if (m) social[key] = m[0].replace(/["'<>].*$/, '');
  }

  // If the base URL itself is a social profile, register it
  try {
    const host = new URL(baseUrl).hostname.replace('www.', '');
    if (host.includes('instagram.com') && !social.instagram) social.instagram = baseUrl;
    if (host.includes('facebook.com') && !social.facebook) social.facebook = baseUrl;
    if (host.includes('linkedin.com') && !social.linkedin) social.linkedin = baseUrl;
    if (host.includes('tiktok.com') && !social.tiktok) social.tiktok = baseUrl;
    if (host.includes('twitter.com') || host.includes('x.com')) social.twitter = social.twitter || baseUrl;
  } catch {}

  return social;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; MonBonAgentBot/1.0; +https://monbonagent.vercel.app)',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'fr,en;q=0.8',
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

async function enrich(url: string): Promise<EnrichmentResult> {
  const html = await fetchHtml(url);
  const meta = extractAllMeta(html);

  const title =
    meta['og:title'] ||
    meta['twitter:title'] ||
    pickMeta(html, [/<title[^>]*>([^<]+)<\/title>/i]) ||
    null;

  const description =
    meta['og:description'] ||
    meta['twitter:description'] ||
    meta['description'] ||
    null;

  const image = absolutize(
    meta['og:image'] ||
      meta['og:image:url'] ||
      meta['twitter:image'] ||
      meta['twitter:image:src'] ||
      null,
    url,
  );

  const siteUrl = meta['og:url'] || url;
  const social = detectSocial(html, url);

  // Try to infer the merchant name from OG site_name or URL path
  let name = meta['og:site_name'] || title;
  if (!name) {
    try {
      const u = new URL(url);
      name = u.pathname.replace(/^\/|\/$/g, '').split('/').pop() || u.hostname;
    } catch {}
  }

  return {
    name: name ? name.slice(0, 120) : null,
    description: description ? description.slice(0, 500) : null,
    image_url: image,
    site_url: siteUrl,
    category: null,
    address: meta['business:contact_data:street_address'] || null,
    social_links: social,
    source_url: url,
    enriched_at: new Date().toISOString(),
    raw: meta,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      return new Response(
        JSON.stringify({ error: 'Invalid URL. Expected http(s)://…' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const result = await enrich(url);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String((e as Error).message || e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
