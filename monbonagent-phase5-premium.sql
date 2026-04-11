-- =====================================================================
-- MonBonAgent — Phase 5 : Premium tiering + Le Mag source links + PJ
-- =====================================================================
-- À exécuter dans Supabase SQL Editor. Idempotent — safe à relancer.
-- =====================================================================

-- 1) Le Mag (blog_posts) : lien source + commerçant vedette + PJ
alter table blog_posts add column if not exists source_url text;
alter table blog_posts add column if not exists source_label text;
alter table blog_posts add column if not exists featured_merchant_id uuid references merchants(id) on delete set null;
alter table blog_posts add column if not exists attachment_url text;
alter table blog_posts add column if not exists seo_title text;
alter table blog_posts add column if not exists seo_description text;

create index if not exists blog_posts_featured_merchant_idx on blog_posts(featured_merchant_id);

-- 2) Merchants : tiering Premium/Boost + contenu enrichi
alter table merchants add column if not exists plan text default 'free' check (plan in ('free','pro','premium','boost'));
alter table merchants add column if not exists featured boolean default false;
alter table merchants add column if not exists boost_until timestamptz;
alter table merchants add column if not exists premium_content jsonb;
alter table merchants add column if not exists seo_title text;
alter table merchants add column if not exists seo_description text;
alter table merchants add column if not exists slug text;

create index if not exists merchants_plan_idx on merchants(plan);
create index if not exists merchants_featured_idx on merchants(featured);
create unique index if not exists merchants_slug_idx on merchants(slug) where slug is not null;

-- Backfill slug basé sur le nom si manquant
update merchants
  set slug = lower(regexp_replace(regexp_replace(name, '[^a-zA-Z0-9\\s-]', '', 'g'), '\\s+', '-', 'g'))
  where slug is null and name is not null;

-- 3) Storage bucket site-assets : créé via API Storage (idempotent)
-- Policies déjà en place (public read, admin/merchant write).

-- Fin Phase 5 ✓
