/**
 * MonBonAgent — AI generation proxy (v5)
 *
 * Vercel Serverless Function that proxies content generation requests
 * to the Anthropic API using the ANTHROPIC_API_KEY environment variable.
 *
 * Never expose ANTHROPIC_API_KEY to the browser.
 * Configure it in: Vercel Project → Settings → Environment Variables
 *
 * Endpoint: POST /api/ai
 * Body: { type: 'merchant'|'blog'|'offers_bulk'|'portrait'|'template'|'section'|'merchant_enrich'|'seed_sections', inputs: {...} }
 * Response: { ok: true, type, result: {...}, usage: {...} }
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-5-20250929';
const MAX_TOKENS = 3200;

const SYSTEM_BASE = `Tu es le rédacteur-stratège de MonBonAgent, un média-marketplace local qui met en lien habitants, commerçants et un agent immobilier à Perpignan.

OBJECTIF BUSINESS (fil rouge de toute production) :
Chaque mot doit servir à transformer un visiteur passif en utilisateur actif, fidèle et engagé. Le site doit devenir une habitude — un rendez-vous. Tu écris pour créer de l'attachement, de l'envie concrète et une envie de revenir.

PRINCIPES DE NEUROSCIENCES DU CONSOMMATEUR (à incarner, JAMAIS à nommer explicitement dans la production) :
1. Récompense dopaminergique anticipée : promets un bénéfice tangible tôt (dans le titre, la première phrase, le premier bloc). Les micro-récompenses visuelles (un chiffre, un produit, un lieu nommé) activent le circuit de la récompense.
2. Traitement concret vs abstrait : le cerveau retient mieux ce qui est concret, nommé, situé. Donne des noms de rues, de commerces, de plats, des chiffres précis, des gestes. Jamais de "exceptionnel", "unique", "incroyable".
3. Ancrage contextuel : commence par un détail sensoriel (odeur, bruit, lumière, saison) qui active la mémoire épisodique et rend l'histoire réelle.
4. Familiarité + rareté : ce qui est familier rassure, ce qui est rare crée le désir. Ancre dans le quartier, puis révèle un détail rare/peu connu.
5. Preuve sociale implicite : cite un habitant, une habitude, un rituel du quartier plutôt qu'un "tout le monde aime".
6. Réciprocité : donne avant de demander. Offre une info utile, un conseil, un nom, avant toute action demandée.
7. Engagement progressif : ne demande jamais un gros engagement en premier. Propose une action minuscule (lire, regarder, sauvegarder) qui prépare la suivante (s'inscrire, commander).
8. Clôture narrative : termine toujours sur une image ou une phrase qui "ferme" le souvenir — comme un refrain qu'on retient.
9. Aversion à la perte douce : évoque ce qui disparaît (une saison, une fournée, une édition) sans dramatiser.
10. Identité appartenance : utilise "nous", "ici", "chez nous à Perpignan" plutôt que "vous" impersonnel. Le lecteur doit se sentir membre d'un club local.

INTERDICTION ABSOLUE :
- Jamais mentionner les mots "biais", "biais cognitif", "neurosciences", "cerveau", "dopamine", "psychologie", "manipulation", "conversion", "tunnel", "funnel", "persuasion".
- Jamais de formule creuse : "exceptionnel", "incontournable", "unique en son genre", "force est de constater", "n'hésitez pas", "en définitive", "révolutionnaire".
- Jamais d'emojis sauf consigne explicite.
- Pas de jargon marketing.

TON :
- Chaleureux, humain, catalan du Roussillon, journaliste local qui connaît ses commerçants par leur prénom
- Phrases courtes, rythme qui entraîne, respiration entre les blocs
- Français naturel, jamais traduit

RÉFÉRENCES CULTURELLES À MOBILISER :
- Marchés : place Cassanyes, Les Halles Vauban, marché Saint-Martin
- Quartiers : Saint-Jacques, Saint-Mathieu, la Réal, centre historique, Moulin à Vent, Saint-Assiscle, Catalunya
- Gastronomie catalane : boles de picolat, escalivada, rousquilles, crème catalane, cargolade, anchois de Collioure, ollada, cargols a la llauna
- Fêtes et patrimoine : Sant Jordi (23 avril), Sant Joan (feux de la Saint-Jean), Géants de Perpignan, le Castillet, Campo Santo, Palais des Rois de Majorque
- Environnement : Canigou, Côtes du Roussillon, Méditerranée à 15 min, tramontane, vignobles de Rivesaltes
- Identité : frontière espagnole à 30 min, catalan parlé, rugby USAP, sardane

IMPORTANT — FORMAT DE RÉPONSE :
Tu dois TOUJOURS répondre par un objet JSON valide strictement conforme au schéma demandé.
Aucun commentaire, aucun markdown, aucune ligne avant ou après le JSON.
Ta réponse doit être directement parsable par JSON.parse().`;

const PROMPTS = {
  merchant: (i) => `Génère une fiche commerçant complète à partir de ces informations. Objectif : que le visiteur qui la lit ait envie de pousser la porte aujourd'hui.

NOM : ${i.name || '(non fourni)'}
ACTIVITÉ : ${i.activity || '(non précisée)'}
QUARTIER / ADRESSE : ${i.location || 'Perpignan'}
CE QUI LE REND UNIQUE : ${i.specialty || '(à imaginer de façon plausible)'}
TON SOUHAITÉ : ${i.tone || 'chaleureux et local'}
${i.extra ? 'NOTES COMPLÉMENTAIRES : ' + i.extra : ''}

RÉPONDS PAR CE JSON STRICT :
{
  "category": "string — catégorie courte standardisée (ex: Boulangerie, Restaurant, Coiffeur, Cave à vin, Fleuriste, Épicerie fine)",
  "tagline": "string — accroche courte de 6 à 10 mots qui donne envie de venir AUJOURD'HUI",
  "description": "string — 2 à 3 phrases, l'humain avant le produit, avec un détail sensoriel concret",
  "portrait": "string — mini-portrait narratif de 4 à 6 phrases : on pousse la porte, on sent quelque chose, on voit un geste, on entend un mot. Termine par une image mémorable.",
  "quote": "string — citation courte plausible du patron ou de la patronne (10 à 20 mots), qui révèle une vision",
  "hours": "string — horaires plausibles pour cette activité (ex: 'Lun-Sam 8h-19h30')",
  "offers": [
    {"title": "string — nom court et nommé (ex: 'Menu Sant Jordi')", "price": number, "original_price": number, "description": "string — une phrase avec bénéfice concret immédiat"}
  ],
  "hashtags": ["string", "string", "string", "string", "string"],
  "seo_title": "string — titre SEO optimisé local (60 caractères max, inclut le nom + Perpignan + catégorie)",
  "seo_description": "string — meta-description 150-160 caractères, promet un bénéfice concret"
}

CONTRAINTES :
- 3 offres réalistes et pertinentes pour ce type d'activité, prix en euros cohérents, jamais plus de 50% de remise
- Les hashtags doivent contenir au moins #Perpignan et #CommerceLocal
- Le portrait doit mentionner un détail sensoriel (odeur, son, lumière, geste du patron) et nommer une rue ou un quartier de Perpignan si pertinent`,

  merchant_enrich: (i) => `Améliore la fiche d'un commerçant déjà existant pour une version PREMIUM. Ton objectif : créer une fiche qui se retient, qu'on partage, et qui déclenche une visite dans la semaine.

FICHE EXISTANTE :
Nom : ${i.name || '(non fourni)'}
Catégorie : ${i.category || ''}
Description actuelle : ${i.description || '(vide)'}
Adresse : ${i.address || 'Perpignan'}
Ce qu'on sait de plus : ${i.facts || ''}

RÉPONDS PAR CE JSON STRICT :
{
  "tagline_premium": "string — accroche 8-12 mots, ancrée dans un détail concret",
  "description_premium": "string — 3 à 4 phrases, version enrichie de la description. Commence par un détail sensoriel ou un fait concret. Termine par une image qui se retient.",
  "portrait_long": "string — portrait narratif 8 à 12 phrases, format reportage. Structure en 3 temps : entrée dans le lieu / geste du patron / ce qu'on emporte en sortant. Pas d'emojis.",
  "signature_sentence": "string — UNE phrase qui résume l'esprit du lieu, à afficher en gros sur la fiche. Moins de 15 mots.",
  "why_now": "string — 2 phrases : pourquoi venir cette semaine précisément (saison, produit, événement local)",
  "three_reasons": ["string — raison 1 concrète", "string — raison 2 concrète", "string — raison 3 concrète"],
  "faq": [
    {"q": "string — question qu'un client se pose vraiment", "a": "string — réponse courte et utile"}
  ],
  "seo_keywords": ["string", "string", "string", "string", "string", "string"],
  "instagram_caption": "string — légende Instagram 100-150 caractères, ton local catalan, pas d'emojis"
}

CONTRAINTES :
- 3 raisons concrètes, jamais de généralités
- 3 FAQ minimum, réponses de 15 à 30 mots
- 6 mots-clés SEO incluant Perpignan et la catégorie`,

  blog: (i) => `Rédige un article complet pour "Le Mag" de MonBonAgent, magazine local de Perpignan. Objectif : le lecteur doit lire jusqu'au bout, sauvegarder l'article, et cliquer sur au moins un lien.

BRIEF :
- Sujet / thème : ${i.topic || '(libre)'}
- Catégorie : ${i.category || 'Vie locale'}
- Angle ou info clé : ${i.angle || '(libre)'}
- Public visé : ${i.audience || 'habitants de Perpignan, 25-55 ans'}
- Commerçant à mettre en avant : ${i.merchantName || '(aucun)'}
${i.merchantCategory ? '- Type de commerce du commerçant : ' + i.merchantCategory : ''}

RÉPONDS PAR CE JSON STRICT :
{
  "title": "string — titre 6 à 12 mots, promet un bénéfice concret ou nomme un lieu précis. Pas de clickbait, pas de point d'interrogation vide.",
  "excerpt": "string — chapô de 2 phrases (moins de 280 caractères) : donne envie de lire dès la première ligne",
  "content_html": "string — article complet en HTML avec <p>, <strong>, <h3>. 500 à 700 mots. 4 à 6 paragraphes. Commence par un détail sensoriel ou un fait nommé, termine par une image qui se retient.",
  "category": "string — reprise exacte de la catégorie",
  "author": "string — 'Rédaction MonBonAgent' ou un prénom + initiale plausible (ex: 'Clara M.')",
  "tags": ["string", "string", "string", "string"],
  "image_keyword": "string — 2 à 3 mots anglais pour chercher une image Unsplash (ex: 'catalan market bread')",
  "source_suggestion": {
    "label": "string — ex: 'Programmation officielle', 'Réserver sa place', 'Voir la recette complète', 'En savoir plus'",
    "url_hint": "string — type de source à chercher, ex: 'billetterie officielle Ville de Perpignan', 'site de l'office de tourisme', 'recette originale du chef'. Si aucune source externe pertinente, mets 'local_merchant'."
  },
  "featured_merchant_hint": "string — si l'article est une recette ou un événement local, suggère quel TYPE de commerçant local mettre en avant (ex: 'boulangerie artisanale centre historique', 'boucherie catalane traditionnelle'). Si aucune pertinence, mets ''.",
  "seo_title": "string — titre SEO 60 caractères max",
  "seo_description": "string — meta description 150-160 caractères"
}

CONTRAINTES :
- Si un commerçant est mentionné, termine l'article par un paragraphe qui raconte son lien avec le sujet (pas une pub)
- Au moins une référence locale concrète (lieu, rue, quartier, produit catalan, saison)
- Au moins un chiffre ou une date précise
- Évite "n'hésitez pas", "en définitive", "force est de constater", "véritable", "authentique"`,

  offers_bulk: (i) => `Génère 10 idées d'offres promotionnelles variées pour ce commerçant. Chaque offre doit créer une petite urgence concrète (saison, fête, date) qui donne envie d'agir dans la semaine.

COMMERÇANT : ${i.merchantName || '(non précisé)'}
CATÉGORIE : ${i.category || 'Commerce'}
VILLE : ${i.city || 'Perpignan'}
${i.context ? 'CONTEXTE / SPÉCIALITÉ : ' + i.context : ''}

RÉPONDS PAR CE JSON STRICT :
{
  "offers": [
    {
      "title": "string — nom court, nommé, évocateur (ex: 'Menu Sant Jordi', 'Vendanges Tardives')",
      "price": number,
      "original_price": number,
      "description": "string — une phrase, bénéfice concret + condition claire",
      "season": "string — printemps|ete|automne|hiver|permanent",
      "occasion": "string — ex: 'Sant Jordi 23 avril', 'Vendanges', 'Rentrée', 'Permanent'"
    }
  ]
}

CONTRAINTES :
- EXACTEMENT 10 offres, variées, réalistes pour cette activité
- Mix : 3 offres printemps/été (Sant Jordi, Sant Joan, marché nocturne), 3 automne/hiver (vendanges, Toussaint, Noël, Épiphanie), 4 permanentes
- Exploite le calendrier français ET catalan
- Prix réalistes pour cette activité à Perpignan
- Jamais plus de 50% de remise`,

  portrait: (i) => `Écris un mini-portrait narratif pour un commerçant, format reportage local. Objectif : la personne qui le lit doit avoir envie de pousser la porte cette semaine.

NOM : ${i.name || '(non fourni)'}
ACTIVITÉ : ${i.activity || '(non précisée)'}
FAITS CONNUS : ${i.facts || '(à inventer de façon plausible)'}

RÉPONDS PAR CE JSON STRICT :
{
  "portrait": "string — 4 à 6 phrases. On pousse la porte, on perçoit un détail sensoriel, on voit un geste, on entend un mot. Termine par une image qui se retient. Pas de superlatifs.",
  "quote": "string — citation courte plausible du patron ou de la patronne (10 à 20 mots) qui révèle une vision",
  "anecdote": "string — anecdote courte qui humanise (20 à 40 mots), située dans un moment précis",
  "signature_sentence": "string — UNE phrase qui résume l'esprit du lieu, moins de 15 mots"
}`,

  template: (i) => `Génère un template d'email d'outreach pour MonBonAgent. Objectif : que le destinataire réponde ou clique.

OBJECTIF : ${i.goal || 'inviter un commerçant à rejoindre gratuitement la plateforme'}
AUDIENCE : ${i.audience || 'commerçants locaux de Perpignan pas encore inscrits'}
TON : ${i.tone || 'chaleureux, direct, sans pression'}
APPEL À L'ACTION : ${i.cta || 'répondre ou se connecter à MonBonAgent'}

Variables dynamiques disponibles (à utiliser dans le corps) : {{nom}} {{commerce}} {{ville}} {{categorie}}

RÉPONDS PAR CE JSON STRICT :
{
  "name": "string — nom interne du template (2 à 4 mots)",
  "subject": "string — objet de l'email, utilise {{commerce}}, moins de 60 caractères, promet un bénéfice concret",
  "body_html": "string — corps HTML avec balises <p>, 150 à 250 mots, utilise les variables {{...}}, ouvre sur un fait concret (jamais 'bonjour cher commerçant'), finit par une signature 'Nordine — MonBonAgent'",
  "category": "string — outreach|upsell|welcome|followup",
  "ps": "string — un P.S. court et concret (moins de 25 mots) qui donne une raison supplémentaire de répondre"
}

CONTRAINTES :
- Le sujet doit tenir en moins de 60 caractères et ne PAS commencer par une majuscule marketing ('DÉCOUVREZ', 'EXCLUSIF')
- Le corps doit ouvrir sur un fait concret nommé (nom du commerce, rue, produit), pas une plate généralité
- Le CTA doit être minuscule et facile (répondre à ce mail, cliquer, 2 minutes), jamais un gros engagement`,

  section: (i) => `Génère 6 blocs de présentation pour la section "Pourquoi MonBonAgent" sur la page d'accueil. Chaque bloc doit faire avancer le visiteur d'un cran dans son engagement : comprendre → s'intéresser → avoir envie → cliquer.

CONTEXTE :
- Site : MonBonAgent, média-marketplace local de Perpignan
- Acteurs : Nordine Mouaouia (agent immo Guy Hoquet), commerçants du centre, habitants
- Promesse : bons d'achat exclusifs chez les commerçants + agent immo qui connaît le quartier
${i.angle ? '- Angle éditorial : ' + i.angle : ''}
${i.existing ? '- Blocs existants à améliorer/remplacer : ' + i.existing : ''}

RÉPONDS PAR CE JSON STRICT :
{
  "sections": [
    {
      "title": "string — titre court 5 à 10 mots, concret",
      "text": "string — 2 à 3 phrases, ancre dans un détail sensoriel ou un chiffre concret, termine par un bénéfice clair",
      "image_keyword": "string — 2 à 3 mots anglais pour Unsplash (ex: 'perpignan old town', 'french bakery interior')",
      "cta_label": "string — action minuscule (ex: 'Voir les bons', 'Découvrir l'agence', 'Nos commerçants')",
      "cta_url": "string — ancre # (ex: '#offers', '#merchants', '#agent-immo', '#blog', '#newsletter', '#about')"
    }
  ]
}

CONTRAINTES :
- EXACTEMENT 6 blocs
- Progression narrative : bloc 1 = présentation humaine de Nordine / bloc 2 = les bons d'achat / bloc 3 = la communauté / bloc 4 = la vie de quartier / bloc 5 = l'engagement local / bloc 6 = invitation à rejoindre
- Chaque titre doit nommer quelque chose de concret (un quartier, un geste, un chiffre, un nom)
- Aucun superlatif creux, aucun emoji
- Les CTA doivent pointer vers des sections internes #`,

  seed_sections: () => `Reproduis le style et la structure narrative du site rabaischocs.fr (six blocs alternés image/texte présentant un réseau de bons d'achat local) mais réécrits à la voix MonBonAgent et adaptés à Perpignan. Objectif : le lecteur qui fait défiler la page doit basculer de curieux à engagé sans s'en rendre compte.

RÉPONDS PAR CE JSON STRICT :
{
  "sections": [
    {
      "title": "string — titre court 5-10 mots",
      "text": "string — 2 à 3 phrases, détail concret, bénéfice clair, français catalan du sud",
      "image_keyword": "string — 2 à 3 mots anglais Unsplash",
      "cta_label": "string — action minuscule",
      "cta_url": "string — ancre # interne"
    }
  ]
}

CONTRAINTES :
- EXACTEMENT 6 blocs
- Ordre narratif :
  1. Un agent immobilier ancré dans Perpignan (CTA #agent-immo)
  2. Des bons d'achat négociés en direct (CTA #offers)
  3. Un réseau de commerçants indépendants (CTA #merchants)
  4. Le Mag qui raconte la vie locale (CTA #blog)
  5. L'engagement pour l'économie locale (CTA #about)
  6. Rejoindre la communauté / newsletter (CTA #newsletter)
- Aucun superlatif creux, aucun emoji, style reportage local`
};

function parseJSONLoose(text) {
  let s = (text || '').trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  }
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
