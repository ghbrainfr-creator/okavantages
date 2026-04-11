/**
 * MonBonAgent — AI generation proxy
 *
 * Vercel Serverless Function that proxies content generation requests
 * to the Anthropic API using the ANTHROPIC_API_KEY environment variable.
 *
 * Never expose ANTHROPIC_API_KEY to the browser.
 * Configure it in: Vercel Project → Settings → Environment Variables
 *
 * Endpoint: POST /api/ai
 * Body: { type: 'merchant'|'blog'|'offers_bulk'|'portrait'|'template', inputs: {...} }
 * Response: { ok: true, type, result: {...}, usage: {...} }
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-5-20250929';
const MAX_TOKENS = 2800;

const SYSTEM_BASE = `Tu es un rédacteur éditorial expert du commerce local et de la vie de quartier à Perpignan et dans les Pyrénées-Orientales (Catalogne nord).

TON STYLE :
- Chaleureux, humain, ancré dans le terroir catalan du Roussillon
- Tu parles des gens avant les produits : savoir-faire, quotidien, convivialité
- Tu évites le jargon marketing et les superlatifs creux ("exceptionnel", "incontournable", "unique en son genre")
- Pas d'emojis sauf demande explicite
- Tu écris toujours en français naturel, comme un journaliste local qui connaît la ville

RÉFÉRENCES CULTURELLES À EXPLOITER :
- Marchés (place Cassanyes, Les Halles), quartiers (Saint-Jacques, Saint-Mathieu, la Réal, centre historique)
- Gastronomie catalane : boles de picolat, escalivada, rousquilles, crème catalane, cargolade, anchois de Collioure
- Fêtes et patrimoine : Sant Jordi, Sant Joan, les Géants, le Castillet, Campo Santo
- Environnement : Canigou, Côtes du Roussillon, Méditerranée à 15 min, tramontane
- Identité : ville frontalière, catalan parlé, lien avec l'Espagne

IMPORTANT — FORMAT DE RÉPONSE :
Tu dois TOUJOURS répondre par un objet JSON valide strictement conforme au schéma demandé.
Aucun commentaire, aucun markdown, aucune ligne avant ou après le JSON.
Ta réponse doit être directement parsable par JSON.parse().`;

const PROMPTS = {
  merchant: (i) => `Génère une fiche commerçant complète à partir de ces informations :

NOM : ${i.name || '(non fourni)'}
ACTIVITÉ : ${i.activity || '(non précisée)'}
QUARTIER / ADRESSE : ${i.location || 'Perpignan'}
CE QUI LE REND UNIQUE : ${i.specialty || '(à imaginer de façon plausible)'}
TON SOUHAITÉ : ${i.tone || 'chaleureux et local'}
${i.extra ? 'NOTES COMPLÉMENTAIRES : ' + i.extra : ''}

RÉPONDS PAR CE JSON STRICT :
{
  "category": "string — catégorie courte standardisée (ex: Boulangerie, Restaurant, Coiffeur, Cave à vin, Fleuriste, Épicerie fine)",
  "tagline": "string — accroche courte de 6 à 10 mots qui donne envie de venir",
  "description": "string — 2 à 3 phrases, présentation du commerce façon journaliste local, l'humain avant le produit",
  "portrait": "string — mini-portrait narratif de 4 à 6 phrases qui raconte le lieu, l'ambiance, ce qu'on y ressent en poussant la porte. Pas d'emojis.",
  "quote": "string — une citation courte plausible du patron ou de la patronne (10 à 20 mots)",
  "hours": "string — horaires plausibles pour cette activité (ex: 'Lun-Sam 8h-19h30')",
  "offers": [
    {"title": "string — nom court", "price": number, "original_price": number, "description": "string — une phrase avec conditions claires"}
  ],
  "hashtags": ["string", "string", "string", "string", "string"]
}

CONTRAINTES :
- 3 offres réalistes et pertinentes pour ce type d'activité, prix en euros cohérents
- Les hashtags doivent contenir au moins #Perpignan et #CommerceLocal
- Le portrait doit mentionner un détail sensoriel (odeur, son, lumière, geste du patron)`,

  blog: (i) => `Rédige un article complet pour "Le Mag" de MonBonAgent, magazine local de Perpignan.

BRIEF :
- Sujet / thème : ${i.topic || '(libre)'}
- Catégorie : ${i.category || 'Vie locale'}
- Angle ou info clé : ${i.angle || '(libre)'}
- Public visé : ${i.audience || 'habitants de Perpignan'}
- Commerçant à mettre en avant : ${i.merchantName || '(aucun)'}
${i.merchantCategory ? '- Type de commerce du commerçant : ' + i.merchantCategory : ''}

RÉPONDS PAR CE JSON STRICT :
{
  "title": "string — titre accrocheur de 6 à 12 mots, pas de clickbait",
  "excerpt": "string — chapô de 2 phrases (moins de 280 caractères)",
  "content_html": "string — article complet en HTML avec <p>, <strong>, <h3>. 500 à 700 mots. 4 à 6 paragraphes.",
  "category": "string — reprise exacte de la catégorie",
  "author": "string — 'Rédaction MonBonAgent' ou un prénom + initiale plausible",
  "tags": ["string", "string", "string", "string"],
  "image_keyword": "string — 2 à 3 mots anglais pour chercher une image Unsplash (ex: 'catalan market bread')"
}

CONTRAINTES :
- Si un commerçant est mentionné, termine l'article par un paragraphe qui pointe vers sa fiche
- Au moins une référence locale concrète (lieu, rue, quartier, produit catalan, saison)
- Évite "n'hésitez pas", "en définitive", "force est de constater"`,

  offers_bulk: (i) => `Génère 10 idées d'offres promotionnelles variées pour ce commerçant.

COMMERÇANT : ${i.merchantName || '(non précisé)'}
CATÉGORIE : ${i.category || 'Commerce'}
VILLE : ${i.city || 'Perpignan'}
${i.context ? 'CONTEXTE / SPÉCIALITÉ : ' + i.context : ''}

RÉPONDS PAR CE JSON STRICT :
{
  "offers": [
    {
      "title": "string — nom court et évocateur (ex: 'Menu Sant Jordi')",
      "price": number,
      "original_price": number,
      "description": "string — une phrase, conditions claires",
      "season": "string — printemps|ete|automne|hiver|permanent",
      "occasion": "string — ex: 'Saint-Valentin', 'Rentrée', 'Fête des mères', 'Permanent'"
    }
  ]
}

CONTRAINTES :
- EXACTEMENT 10 offres, variées, réalistes pour cette activité
- Mix : 3 offres saisonnières spring/été, 3 automne/hiver, 4 permanentes
- Exploite le calendrier français ET catalan (Sant Jordi = 23 avril, vendanges, Toussaint, Noël, rentrée)
- Prix réalistes pour cette activité à Perpignan
- Jamais de réduction supérieure à 50%`,

  portrait: (i) => `Écris un mini-portrait narratif pour un commerçant, format reportage local.

NOM : ${i.name || '(non fourni)'}
ACTIVITÉ : ${i.activity || '(non précisée)'}
FAITS CONNUS : ${i.facts || '(à inventer de façon plausible)'}

RÉPONDS PAR CE JSON STRICT :
{
  "portrait": "string — 4 à 6 phrases façon journaliste qui a poussé la porte. Un détail sensoriel, une manière de faire, une vision. Pas de superlatifs creux.",
  "quote": "string — citation courte plausible du patron ou de la patronne (10 à 20 mots)",
  "anecdote": "string — anecdote courte qui humanise (20 à 40 mots)"
}`,

  template: (i) => `Génère un template d'email d'outreach pour MonBonAgent.

OBJECTIF : ${i.goal || 'inviter un commerçant à rejoindre gratuitement la plateforme'}
AUDIENCE : ${i.audience || 'commerçants locaux de Perpignan pas encore inscrits'}
TON : ${i.tone || 'chaleureux, direct, sans pression'}
APPEL À L'ACTION : ${i.cta || 'répondre ou se connecter à MonBonAgent'}

Variables dynamiques disponibles (à utiliser dans le corps) : {{nom}} {{commerce}} {{ville}} {{categorie}}

RÉPONDS PAR CE JSON STRICT :
{
  "name": "string — nom interne du template (2 à 4 mots)",
  "subject": "string — objet de l'email, utilise {{commerce}}",
  "body_html": "string — corps HTML avec balises <p>, 150 à 250 mots, utilise les variables {{...}}, finit par une signature 'Nordine — MonBonAgent'",
  "category": "string — outreach|upsell|welcome|followup"
}

CONTRAINTES :
- Ton humain, jamais 'cher commerçant'
- Pas de superlatifs creux ('exceptionnel', 'révolutionnaire')
- Le sujet doit tenir en moins de 60 caractères
- Le corps doit ouvrir sur un fait concret, pas une plate généralité`
};

function parseJSONLoose(text) {
  let s = (text || '').trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  }
  // Find first { and last }
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first > 0 || last < s.length - 1) {
    if (first !== -1 && last !== -1) s = s.substring(first, last + 1);
  }
  return JSON.parse(s);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed — POST only' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: 'ANTHROPIC_API_KEY manquante. Ajoute la clé dans Vercel → Project Settings → Environment Variables, puis redéploie.'
    });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { res.status(400).json({ error: 'Invalid JSON body' }); return; }
  }
  body = body || {};

  const type = body.type;
  const inputs = body.inputs || {};

  if (!type || !PROMPTS[type]) {
    res.status(400).json({ error: 'type invalide. Valeurs autorisées : ' + Object.keys(PROMPTS).join(', ') });
    return;
  }

  const userPrompt = PROMPTS[type](inputs);

  try {
    const response = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_BASE,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    if (!response.ok) {
      const txt = await response.text();
      res.status(502).json({ error: 'Anthropic API error ' + response.status + ': ' + txt.slice(0, 500) });
      return;
    }

    const data = await response.json();
    const text = (data.content && data.content[0] && data.content[0].text) || '';

    let parsed;
    try {
      parsed = parseJSONLoose(text);
    } catch (e) {
      res.status(500).json({ error: 'Réponse IA non parsable en JSON', raw: text.slice(0, 2000) });
      return;
    }

    res.status(200).json({
      ok: true,
      type,
      result: parsed,
      usage: data.usage || null
    });
  } catch (e) {
    res.status(500).json({ error: 'Proxy error : ' + (e.message || String(e)) });
  }
};
