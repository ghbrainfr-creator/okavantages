-- ============================================================
-- MonBonAgent — Phase 2b V2 : Branding, Sections, Cookies,
-- Footer, Enrichissement auto, Offres terminées, QR codes
-- ============================================================

-- ------------------------------------------------------------
-- 1. SITE_SETTINGS : extensions V2
-- ------------------------------------------------------------

-- Branding étendu
alter table site_settings add column if not exists color_secondary text default '#0ea5e9';
alter table site_settings add column if not exists color_bg text default '#ffffff';
alter table site_settings add column if not exists color_text text default '#1a1a2e';
alter table site_settings add column if not exists font_heading text default 'Poppins';
alter table site_settings add column if not exists font_body text default 'Inter';

-- Sections "Pourquoi MonBonAgent"
alter table site_settings add column if not exists about_sections jsonb default '[
  {
    "title": "Un agent immobilier au cœur de Perpignan",
    "text": "MonBonAgent, c''est d''abord l''engagement de Nordine Mouaouia, conseiller Guy Hoquet à Perpignan, pour vous connecter aux meilleurs commerçants de la ville. Parce qu''acheter ou vendre un bien, c''est aussi choisir un quartier, des habitudes, une vie de tous les jours.",
    "image": "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1000&q=80",
    "cta_label": "Découvrir mon agence",
    "cta_url": "#agent"
  },
  {
    "title": "Des bons d''achat chez vos commerçants préférés",
    "text": "Chaque bon MonBonAgent est négocié en direct avec un commerçant perpignanais. Restaurateurs, bien-être, mode, loisirs : vous profitez de vraies remises, et eux d''une nouvelle clientèle locale, fidèle et engagée.",
    "image": "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?auto=format&fit=crop&w=1000&q=80",
    "cta_label": "Voir les bons",
    "cta_url": "#offers"
  },
  {
    "title": "Un réseau local qui fait vivre le quartier",
    "text": "En rejoignant MonBonAgent, vous soutenez une économie de proximité. 100% des commerçants présents sur la plateforme sont indépendants, installés à Perpignan et dans les communes voisines.",
    "image": "https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?auto=format&fit=crop&w=1000&q=80",
    "cta_label": "Nos commerçants",
    "cta_url": "#merchants"
  },
  {
    "title": "Un accompagnement immobilier dédié",
    "text": "Derrière MonBonAgent il y a un vrai métier : accompagner des familles, des investisseurs et des primo-accédants. Estimation, vente, achat, location — chaque projet est suivi personnellement par Nordine, sans intermédiaire.",
    "image": "https://images.unsplash.com/photo-1582407947304-fd86f028f716?auto=format&fit=crop&w=1000&q=80",
    "cta_label": "Estimer mon bien",
    "cta_url": "#agent"
  },
  {
    "title": "Des événements pour (re)créer du lien",
    "text": "MonBonAgent organise régulièrement des rendez-vous dans les commerces partenaires : dégustations, ateliers, journées portes ouvertes. L''occasion de rencontrer vos voisins et de profiter de la ville autrement.",
    "image": "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1000&q=80",
    "cta_label": "Agenda",
    "cta_url": "#blog"
  },
  {
    "title": "Le Mag : vivre Perpignan au quotidien",
    "text": "Conseils immo, recettes de saison, bonnes adresses, événements… Retrouvez chaque semaine les articles du Mag pour mieux connaître votre ville et faire les bons choix, côté vie quotidienne comme côté patrimoine.",
    "image": "https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1000&q=80",
    "cta_label": "Lire le Mag",
    "cta_url": "#blog"
  }
]'::jsonb;

-- Politique cookies
alter table site_settings add column if not exists cookies_policy jsonb default '{
  "banner_title": "Votre vie privée compte",
  "banner_text": "Nous utilisons des cookies pour faire fonctionner le site, mesurer l''audience et vous proposer des contenus pertinents. Vous pouvez accepter, refuser ou personnaliser vos choix à tout moment.",
  "accept_label": "Tout accepter",
  "refuse_label": "Tout refuser",
  "settings_label": "Personnaliser",
  "categories": [
    {"key":"essential","label":"Essentiels","required":true,"description":"Nécessaires au fonctionnement du site (authentification, panier, sécurité)."},
    {"key":"analytics","label":"Mesure d''audience","required":false,"description":"Statistiques anonymes pour améliorer le site."},
    {"key":"marketing","label":"Marketing","required":false,"description":"Personnalisation des contenus et suivi des campagnes."}
  ],
  "policy_url": "#mentions"
}'::jsonb;

-- Footer blocs
alter table site_settings add column if not exists footer_blocks jsonb default '{
  "about_title": "À propos",
  "about_text": "MonBonAgent est la plateforme locale qui connecte Nordine Mouaouia, agent Guy Hoquet Perpignan, aux meilleurs commerçants de la ville. Des bons d''achat, des conseils immo, un réseau de confiance.",
  "links_col1": {
    "title": "MonBonAgent",
    "items": [
      {"label":"À propos","url":"#about"},
      {"label":"Nos commerçants","url":"#merchants"},
      {"label":"Les bons moments","url":"#offers"},
      {"label":"Le Mag","url":"#blog"}
    ]
  },
  "links_col2": {
    "title": "Service client",
    "items": [
      {"label":"Contact","url":"#contact"},
      {"label":"FAQ","url":"#faq"},
      {"label":"Devenir partenaire","url":"merchant.html"},
      {"label":"Signaler un bug","url":"mailto:n.mouaouia@guyhoquet.com"}
    ]
  },
  "links_col3": {
    "title": "Informations",
    "items": [
      {"label":"Mentions légales","url":"#mentions"},
      {"label":"CGU","url":"#cgu"},
      {"label":"Politique de confidentialité","url":"#privacy"},
      {"label":"Gérer les cookies","url":"#cookies"}
    ]
  },
  "payments": ["visa","mastercard","cb","paypal","applepay"],
  "legal_line": "© 2026 MonBonAgent — Nordine Mouaouia, agent Guy Hoquet Perpignan. Tous droits réservés."
}'::jsonb;

-- Étendre social_links pour couvrir plus de réseaux
update site_settings
set social_links = coalesce(social_links,'{}'::jsonb) || jsonb_build_object(
  'tiktok', coalesce(social_links->>'tiktok',''),
  'youtube', coalesce(social_links->>'youtube',''),
  'twitter', coalesce(social_links->>'twitter',''),
  'whatsapp', coalesce(social_links->>'whatsapp','')
)
where true;

-- ------------------------------------------------------------
-- 2. OFFERS : statut 'ended' + champs QR
-- ------------------------------------------------------------

alter table offers add column if not exists status text default 'active'
  check (status in ('active','ended','draft'));

alter table offers add column if not exists ended_at timestamptz;
alter table offers add column if not exists redemption_code text;
alter table offers add column if not exists qr_config jsonb default '{
  "color_fg": "#1a1a2e",
  "color_bg": "#ffffff",
  "logo_in_center": true,
  "label": "Scanne ton bon MonBonAgent",
  "instructions": "Présente ce bon en caisse pour profiter de l''offre."
}'::jsonb;

create index if not exists idx_offers_status on offers(status);

-- Quand une offre expire, bascule automatique
create or replace function mark_expired_offers()
returns void
language sql
as $$
  update offers
  set status = 'ended', ended_at = now()
  where status = 'active'
    and expires_at is not null
    and expires_at < now();
$$;

-- ------------------------------------------------------------
-- 3. MERCHANTS : enrichissement auto
-- ------------------------------------------------------------

alter table merchants add column if not exists source_url text;
alter table merchants add column if not exists enriched_at timestamptz;
alter table merchants add column if not exists enrichment_payload jsonb;
alter table merchants add column if not exists social_links jsonb default '{}'::jsonb;

-- ------------------------------------------------------------
-- 4. QR SCANS (analytics optionnels)
-- ------------------------------------------------------------

create table if not exists qr_scans (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid references offers(id) on delete cascade,
  merchant_id uuid references merchants(id) on delete cascade,
  scanned_at timestamptz default now(),
  user_agent text,
  ip_hash text
);

create index if not exists idx_qr_scans_offer on qr_scans(offer_id);
create index if not exists idx_qr_scans_merchant on qr_scans(merchant_id);

alter table qr_scans enable row level security;

drop policy if exists "qr_scans_insert_public" on qr_scans;
create policy "qr_scans_insert_public" on qr_scans
  for insert with check (true);

drop policy if exists "qr_scans_read_owner_admin" on qr_scans;
create policy "qr_scans_read_owner_admin" on qr_scans
  for select using (is_admin() or owns_merchant(merchant_id));

-- ------------------------------------------------------------
-- 5. MIGRATION : OK Avantages → MonBonAgent par défaut
-- ------------------------------------------------------------

update site_settings
set site_title = 'MonBonAgent',
    site_tagline = 'L''immobilier et le commerce local, la main dans la main',
    hero_title = 'Perpignan vit mieux avec MonBonAgent',
    hero_subtitle = 'Des bons d''achat chez vos commerçants préférés + un agent immobilier qui connaît vraiment la ville',
    contact_email = 'n.mouaouia@guyhoquet.com'
where site_title in ('OK Avantages','MonBonLoc') or site_title is null;

-- Mise à jour des titres de section
update site_settings
set section_titles = coalesce(section_titles,'{}'::jsonb) || jsonb_build_object(
  'offers', 'Les bons moments',
  'offers_ended', 'Offres terminées',
  'about', 'Pourquoi MonBonAgent'
);

-- ------------------------------------------------------------
-- Done ✓
-- ------------------------------------------------------------
select 'Phase 2b V2 SQL executed successfully' as status;
