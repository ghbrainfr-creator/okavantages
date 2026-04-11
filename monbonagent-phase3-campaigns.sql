-- ================================================================
-- MonBonAgent — Phase 3 : Prospects + Contacts + Campagnes + Signatures
-- À exécuter dans Supabase → SQL Editor, projet rvknysmuuusygowwauar
-- Idempotent : peut être relancé sans casser l'existant.
-- ================================================================

-- ------------------------------------------------------------
-- 1. PROSPECTS (admin — commerçants non-inscrits à contacter)
-- ------------------------------------------------------------
create table if not exists public.prospects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  city text default 'Perpignan',
  address text,
  phone text,
  email text,
  website text,
  source_url text,
  notes text,
  status text default 'new' check (status in ('new','contacted','interested','converted','rejected','unreachable')),
  plan_suggested text default 'free' check (plan_suggested in ('free','pro','premium')),
  source text default 'manual',  -- manual | csv | scrape
  contacted_count int default 0,
  last_contacted_at timestamptz,
  imported_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_prospects_status on public.prospects(status);
create index if not exists idx_prospects_email on public.prospects(email);
create index if not exists idx_prospects_city on public.prospects(city);

-- ------------------------------------------------------------
-- 2. MERCHANT_CUSTOMERS (clients du commerçant)
-- ------------------------------------------------------------
create table if not exists public.merchant_customers (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references public.merchants(id) on delete cascade,
  name text,
  email text,
  phone text,
  tags text[] default '{}',
  birthday date,
  notes text,
  source text default 'manual',  -- manual | csv | lead
  created_at timestamptz default now(),
  last_emailed_at timestamptz
);
create index if not exists idx_mc_merchant on public.merchant_customers(merchant_id);
create index if not exists idx_mc_email on public.merchant_customers(email);
create index if not exists idx_mc_tags on public.merchant_customers using gin(tags);

-- ------------------------------------------------------------
-- 3. CAMPAIGNS (unifiées admin + commerçant)
-- ------------------------------------------------------------
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('admin','merchant')),
  merchant_id uuid references public.merchants(id) on delete cascade,
  name text not null,
  template_id uuid,         -- FK logique sur email_templates ou admin_email_templates
  subject text,
  body_html text,
  target_type text not null check (target_type in ('all_customers','selected_customers','segment','all_prospects','selected_prospects','all_merchants','selected_merchants','custom')),
  target_ids uuid[] default '{}',
  target_filter jsonb default '{}'::jsonb,
  status text default 'draft' check (status in ('draft','scheduled','sending','sent','failed')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  recipient_count int default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_campaigns_owner on public.campaigns(owner_type, merchant_id);
create index if not exists idx_campaigns_status on public.campaigns(status);

-- ------------------------------------------------------------
-- 4. ADMIN_EMAIL_TEMPLATES (outreach admin)
-- ------------------------------------------------------------
create table if not exists public.admin_email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text check (category in ('outreach','upsell','welcome','followup','newsletter','announcement','other')),
  subject text not null,
  body_html text not null,
  is_system boolean default false,  -- templates fournis par défaut
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_admin_templates_category on public.admin_email_templates(category);

-- ------------------------------------------------------------
-- 5. EMAIL_TEMPLATES (merchant) — ajouts de colonnes
-- ------------------------------------------------------------
alter table public.email_templates add column if not exists category text;
alter table public.email_templates add column if not exists is_system boolean default false;
alter table public.email_templates alter column merchant_id drop not null;
-- Renommage souple : autoriser body (legacy) OU body_html
alter table public.email_templates add column if not exists body text;

-- ------------------------------------------------------------
-- 6. EMAIL_SIGNATURES (sur merchants + site_settings)
-- ------------------------------------------------------------
alter table public.merchants add column if not exists email_signature_html text;
alter table public.merchants add column if not exists email_signature_image_url text;
alter table public.site_settings add column if not exists admin_signature_html text;
alter table public.site_settings add column if not exists admin_signature_image_url text;

-- ------------------------------------------------------------
-- 7. Champ hours sur merchants (V2D déjà évoqué, sécurité)
-- ------------------------------------------------------------
alter table public.merchants add column if not exists hours text;

-- ------------------------------------------------------------
-- 8. RLS
-- ------------------------------------------------------------
alter table public.prospects enable row level security;
drop policy if exists "prospects_admin_all" on public.prospects;
create policy "prospects_admin_all" on public.prospects
  for all using (is_admin()) with check (is_admin());

alter table public.merchant_customers enable row level security;
drop policy if exists "mc_all" on public.merchant_customers;
create policy "mc_all" on public.merchant_customers
  for all using (is_admin() or owns_merchant(merchant_id))
  with check (is_admin() or owns_merchant(merchant_id));

alter table public.campaigns enable row level security;
drop policy if exists "campaigns_all" on public.campaigns;
create policy "campaigns_all" on public.campaigns
  for all using (
    (owner_type='admin' and is_admin())
    or (owner_type='merchant' and (is_admin() or owns_merchant(merchant_id)))
  )
  with check (
    (owner_type='admin' and is_admin())
    or (owner_type='merchant' and (is_admin() or owns_merchant(merchant_id)))
  );

alter table public.admin_email_templates enable row level security;
drop policy if exists "aet_admin" on public.admin_email_templates;
create policy "aet_admin" on public.admin_email_templates
  for all using (is_admin()) with check (is_admin());
drop policy if exists "aet_read_system" on public.admin_email_templates;
create policy "aet_read_system" on public.admin_email_templates
  for select using (is_system = true or is_admin());

-- Mise à jour policy email_templates pour autoriser lecture des system templates
drop policy if exists "email_templates_all" on public.email_templates;
create policy "email_templates_all" on public.email_templates
  for all using (
    is_admin()
    or (merchant_id is not null and owns_merchant(merchant_id))
    or (is_system = true)
  )
  with check (
    is_admin()
    or (merchant_id is not null and owns_merchant(merchant_id))
  );

-- ------------------------------------------------------------
-- 9. SEED — Templates système commerçant (clonables)
-- ------------------------------------------------------------
insert into public.email_templates (merchant_id, name, category, subject, body_html, body, is_system)
values
  (null, '🎁 Bienvenue nouveau client', 'welcome',
   'Bienvenue chez {{commerce}}, {{nom}} !',
   '<p>Bonjour {{nom}},</p><p>Merci d''avoir choisi <strong>{{commerce}}</strong> ! Nous sommes ravis de vous compter parmi nos clients.</p><p>Pour vous remercier, voici votre avantage : <strong>{{offre}}</strong>.</p><p>À très bientôt,<br>L''équipe {{commerce}}</p>',
   'Bonjour {{nom}}, merci d''avoir choisi {{commerce}} !',
   true),

  (null, '🎂 Joyeux anniversaire', 'birthday',
   '🎉 Joyeux anniversaire {{nom}} — cadeau offert',
   '<p>Bonjour {{nom}},</p><p>Toute l''équipe de <strong>{{commerce}}</strong> vous souhaite un très joyeux anniversaire ! 🎂</p><p>Pour l''occasion, nous vous offrons : <strong>{{gift}}</strong>. Valable toute la semaine sur simple présentation de cet email.</p><p>Belle journée à vous,<br>{{commerce}}</p>',
   'Joyeux anniversaire {{nom}}, cadeau offert',
   true),

  (null, '📣 Nouvelle offre exclusive', 'promo',
   '{{commerce}} : nouvelle offre exclusive pour vous',
   '<p>Bonjour {{nom}},</p><p>Nouvelle offre disponible chez <strong>{{commerce}}</strong> :</p><p style="background:#fff3cd;padding:14px;border-radius:8px"><strong>{{offre}}</strong> — {{prix}}€</p><p>Venez vite en profiter !</p><p>{{commerce}}</p>',
   'Nouvelle offre {{offre}} à {{prix}}€',
   true),

  (null, '💌 Newsletter mensuelle', 'newsletter',
   'Les nouveautés de {{commerce}} — ce mois-ci',
   '<p>Bonjour {{nom}},</p><p>Voici ce qui vous attend ce mois-ci chez <strong>{{commerce}}</strong> :</p><ul><li>Nouvelle carte / collection</li><li>Horaires élargis</li><li>Promotions du moment</li></ul><p>Venez nous rendre visite au {{adresse}} !</p><p>À très bientôt,<br>{{commerce}}</p>',
   'Newsletter {{commerce}}',
   true),

  (null, '👋 Relance client inactif', 'followup',
   '{{nom}}, on aimerait vous revoir chez {{commerce}}',
   '<p>Bonjour {{nom}},</p><p>Cela fait un moment que nous ne vous avons pas vu chez <strong>{{commerce}}</strong>. Pour vous revoir, nous vous offrons : <strong>{{gift}}</strong> !</p><p>On vous attend avec plaisir,<br>{{commerce}}</p>',
   'On aimerait vous revoir',
   true),

  (null, '🙏 Merci pour votre achat', 'thankyou',
   'Merci {{nom}} pour votre visite chez {{commerce}}',
   '<p>Bonjour {{nom}},</p><p>Merci pour votre achat chez <strong>{{commerce}}</strong> ! Votre avis compte pour nous.</p><p>Si vous avez un moment, laissez-nous un mot sur Google — c''est notre plus grand coup de pouce.</p><p>À très bientôt,<br>{{commerce}}</p>',
   'Merci pour votre achat',
   true)
on conflict do nothing;

-- ------------------------------------------------------------
-- 10. SEED — Templates admin (outreach)
-- ------------------------------------------------------------
insert into public.admin_email_templates (name, category, subject, body_html, is_system)
values
  ('🆕 Invitation — Forfait gratuit', 'outreach',
   '{{commerce}} : votre fiche offerte sur MonBonAgent.fr',
   '<p>Bonjour,</p><p>Je suis <strong>Nordine Mouaouia</strong>, conseiller chez Guy Hoquet Perpignan. Nous venons de lancer <a href="https://monbonagent.vercel.app">MonBonAgent</a>, un annuaire des commerces perpignanais qui met en avant les bonnes adresses comme <strong>{{commerce}}</strong>.</p><p>Votre fiche est <strong>déjà créée et 100% gratuite</strong> — il ne vous reste qu''à la revendiquer pour :</p><ul><li>Apparaître sur notre carte interactive</li><li>Publier vos offres et bons d''achat</li><li>Recevoir des leads qualifiés</li></ul><p>Cela ne coûte rien et prend 2 minutes. Je reste à votre disposition.</p><p>Cordialement,<br><strong>Nordine Mouaouia</strong><br>04 68 00 00 00<br>n.mouaouia@guyhoquet.com</p>',
   true),

  ('⬆️ Upgrade — Gratuit → Pro', 'upsell',
   '{{commerce}} : débloquez la version Pro de MonBonAgent',
   '<p>Bonjour {{nom}},</p><p>Merci d''utiliser MonBonAgent ! Votre fiche a déjà reçu <strong>{{stats_views}} vues</strong> ce mois-ci.</p><p>Avec le forfait <strong>Pro (19€/mois)</strong>, vous débloquez :</p><ul><li>Offres illimitées (au lieu de 2)</li><li>Séquences email automatiques</li><li>QR codes de vos offres</li><li>Statistiques détaillées</li><li>Mise en avant sur la page d''accueil</li></ul><p>Essai gratuit 14 jours — annulation en 1 clic.</p><p>👉 <a href="https://monbonagent.vercel.app/pricing">Activer Pro</a></p><p>Cordialement,<br>Nordine Mouaouia</p>',
   true),

  ('📞 Relance prospect', 'followup',
   'Petit rappel — MonBonAgent pour {{commerce}}',
   '<p>Bonjour,</p><p>Je vous avais envoyé un message il y a quelques jours concernant la mise en ligne gratuite de <strong>{{commerce}}</strong> sur MonBonAgent.fr.</p><p>Pas de pression — je voulais simplement m''assurer que mon premier email n''avait pas atterri dans les spams. Si vous avez 2 minutes pour en parler, répondez simplement à ce mail ou appelez-moi au 04 68 00 00 00.</p><p>Excellente journée,<br>Nordine</p>',
   true),

  ('📰 Newsletter mensuelle commerçants', 'newsletter',
   'MonBonAgent — Les nouveautés du mois',
   '<p>Bonjour {{nom}},</p><p>Voici les nouveautés du mois sur MonBonAgent :</p><ul><li>🆕 Nouvelles fonctionnalités (import contacts, campagnes, signatures…)</li><li>📈 Statistiques : nombre de visiteurs, top commerces</li><li>🎯 Conseils pour booster vos leads</li></ul><p>Une question ? Répondez directement à ce mail.</p><p>Nordine<br>MonBonAgent</p>',
   true),

  ('🎉 Bienvenue nouveau commerçant', 'welcome',
   'Bienvenue sur MonBonAgent, {{commerce}} !',
   '<p>Bonjour {{nom}},</p><p>Félicitations, votre fiche <strong>{{commerce}}</strong> est maintenant active sur MonBonAgent !</p><p>Pour bien démarrer :</p><ol><li>✅ Complétez votre profil (photos, horaires, description)</li><li>✅ Créez votre première offre</li><li>✅ Ajoutez vos premiers clients à votre carnet de contacts</li></ol><p>Je reste disponible pour toute question.</p><p>Cordialement,<br>Nordine Mouaouia</p>',
   true)
on conflict do nothing;

-- ------------------------------------------------------------
-- 11. MISE À JOUR bucket Storage — autoriser dossier signatures
-- (les policies RLS sur storage.objects sont déjà en place côté V2C)
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 12. SMOKE TEST
-- ------------------------------------------------------------
do $$
begin
  raise notice '=== Phase 3 Smoke Test ===';
  raise notice 'prospects: % rows', (select count(*) from public.prospects);
  raise notice 'merchant_customers: % rows', (select count(*) from public.merchant_customers);
  raise notice 'campaigns: % rows', (select count(*) from public.campaigns);
  raise notice 'admin_email_templates: % rows', (select count(*) from public.admin_email_templates);
  raise notice 'email_templates (system): % rows', (select count(*) from public.email_templates where is_system = true);
end $$;
