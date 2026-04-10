-- ============================================================
-- OK Avantages — Phase 2a : Fondations (Auth + RLS + Tables)
-- ============================================================

-- ------------------------------------------------------------
-- 1. NOUVELLES TABLES
-- ------------------------------------------------------------

-- Settings globaux du site (une seule ligne)
create table if not exists site_settings (
  id uuid primary key default gen_random_uuid(),
  site_title text default 'OK Avantages',
  site_tagline text default 'Payez moins, recevez plus',
  hero_title text default 'Soutenez le commerce local de Perpignan',
  hero_subtitle text default 'Des bons d''achat avantageux chez vos commerçants préférés',
  logo_url text,
  favicon_url text,
  color_primary text default '#f82032',
  color_accent text default '#ff6b35',
  color_dark text default '#1a1a2e',
  section_titles jsonb default '{
    "merchants": "Nos commerçants partenaires",
    "offers": "Les bons du moment",
    "blog": "Le Mag",
    "agent": "Mon sacré voisin",
    "newsletter": "Restez connecté"
  }'::jsonb,
  agent_name text default 'Nordine Mouaouia',
  agent_role text default 'Conseiller immobilier — Guy Hoquet Perpignan',
  agent_bio text default 'Expert du marché immobilier perpignanais depuis plus de 15 ans, je vous accompagne dans vos projets d''achat, de vente et d''investissement locatif.',
  agent_photo_url text default 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&q=80',
  agent_tel text default '04 68 00 00 00',
  agent_email text default 'n.mouaouia@guyhoquet.com',
  agent_services jsonb default '["Estimation gratuite","Vente & Achat","Conseil patrimonial","Investissement locatif"]'::jsonb,
  contact_email text default 'contact@okavantages.fr',
  contact_address text default 'Perpignan, 66000',
  social_links jsonb default '{"linkedin":"","instagram":"","facebook":""}'::jsonb,
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id)
);

-- Insérer la ligne unique si elle n'existe pas
insert into site_settings (id)
select gen_random_uuid()
where not exists (select 1 from site_settings);

-- Admins
create table if not exists admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- Lien commerçant ↔ user
create table if not exists merchant_users (
  user_id uuid references auth.users(id) on delete cascade,
  merchant_id uuid references merchants(id) on delete cascade,
  role text default 'owner',
  created_at timestamptz default now(),
  primary key (user_id, merchant_id)
);

-- Templates email (par commerçant)
create table if not exists email_templates (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references merchants(id) on delete cascade,
  name text not null,
  subject text not null,
  body_html text not null,
  body_text text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Séquences email automatiques
create table if not exists email_sequences (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references merchants(id) on delete cascade,
  name text not null,
  trigger text not null check (trigger in ('new_lead','lead_converted','birthday')),
  delay_hours int not null default 0,
  template_id uuid references email_templates(id) on delete cascade,
  active boolean default true,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 2. email_logs : ALTER TABLE existante (colonnes manquantes)
-- ------------------------------------------------------------
-- La table email_logs existe déjà avec : id, lead_id, merchant_id,
-- template, subject, status, sent_at. On ajoute les colonnes Phase 2.

alter table email_logs add column if not exists sequence_id uuid references email_sequences(id) on delete set null;
alter table email_logs add column if not exists template_id uuid references email_templates(id) on delete set null;
alter table email_logs add column if not exists resend_id text;
alter table email_logs add column if not exists error text;
alter table email_logs add column if not exists recipient text;

-- ------------------------------------------------------------
-- 3. INDEX
-- ------------------------------------------------------------

create index if not exists idx_email_logs_lead on email_logs(lead_id);
create index if not exists idx_email_logs_sequence on email_logs(sequence_id);
create index if not exists idx_email_sequences_merchant on email_sequences(merchant_id);
create index if not exists idx_merchant_users_user on merchant_users(user_id);

-- ------------------------------------------------------------
-- 4. FONCTIONS HELPER
-- ------------------------------------------------------------

create or replace function is_admin()
returns boolean
language sql stable
security definer
as $$
  select exists(select 1 from admin_users where user_id = auth.uid());
$$;

create or replace function owns_merchant(mid uuid)
returns boolean
language sql stable
security definer
as $$
  select exists(select 1 from merchant_users where user_id = auth.uid() and merchant_id = mid);
$$;

create or replace function my_merchant_ids()
returns setof uuid
language sql stable
security definer
as $$
  select merchant_id from merchant_users where user_id = auth.uid();
$$;

-- ------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
-- ------------------------------------------------------------

alter table site_settings enable row level security;
alter table admin_users enable row level security;
alter table merchant_users enable row level security;
alter table email_templates enable row level security;
alter table email_sequences enable row level security;
alter table email_logs enable row level security;

-- SITE_SETTINGS : lecture publique, écriture admin seulement
drop policy if exists "site_settings_read_all" on site_settings;
create policy "site_settings_read_all" on site_settings
  for select using (true);

drop policy if exists "site_settings_write_admin" on site_settings;
create policy "site_settings_write_admin" on site_settings
  for update using (is_admin()) with check (is_admin());

-- ADMIN_USERS : uniquement admins peuvent voir
drop policy if exists "admin_users_read_admin" on admin_users;
create policy "admin_users_read_admin" on admin_users
  for select using (is_admin() or user_id = auth.uid());

-- MERCHANT_USERS : admin voit tout, user voit les siens
drop policy if exists "merchant_users_read" on merchant_users;
create policy "merchant_users_read" on merchant_users
  for select using (is_admin() or user_id = auth.uid());

drop policy if exists "merchant_users_write_admin" on merchant_users;
create policy "merchant_users_write_admin" on merchant_users
  for all using (is_admin()) with check (is_admin());

-- EMAIL_TEMPLATES : commerçant voit/gère les siens, admin voit tout
drop policy if exists "email_templates_all" on email_templates;
create policy "email_templates_all" on email_templates
  for all using (is_admin() or owns_merchant(merchant_id))
  with check (is_admin() or owns_merchant(merchant_id));

-- EMAIL_SEQUENCES : idem
drop policy if exists "email_sequences_all" on email_sequences;
create policy "email_sequences_all" on email_sequences
  for all using (is_admin() or owns_merchant(merchant_id))
  with check (is_admin() or owns_merchant(merchant_id));

-- EMAIL_LOGS : lecture seule pour commerçant/admin
drop policy if exists "email_logs_read" on email_logs;
create policy "email_logs_read" on email_logs
  for select using (is_admin() or owns_merchant(merchant_id));

drop policy if exists "email_logs_insert_service" on email_logs;
create policy "email_logs_insert_service" on email_logs
  for insert with check (true);

-- ------------------------------------------------------------
-- 6. RLS sur tables existantes (mise à jour)
-- ------------------------------------------------------------

-- MERCHANTS : lecture publique OK, écriture = admin OU owner
drop policy if exists "merchants_write_owner_admin" on merchants;
create policy "merchants_write_owner_admin" on merchants
  for update using (is_admin() or owns_merchant(id))
  with check (is_admin() or owns_merchant(id));

drop policy if exists "merchants_insert_admin" on merchants;
create policy "merchants_insert_admin" on merchants
  for insert with check (is_admin());

drop policy if exists "merchants_delete_admin" on merchants;
create policy "merchants_delete_admin" on merchants
  for delete using (is_admin());

-- OFFERS : lecture publique OK, écriture = admin OU owner du merchant
drop policy if exists "offers_write_owner_admin" on offers;
create policy "offers_write_owner_admin" on offers
  for all using (is_admin() or owns_merchant(merchant_id))
  with check (is_admin() or owns_merchant(merchant_id));

-- LEADS : lecture = admin OU owner, insertion = public (formulaire anonyme)
drop policy if exists "leads_read_owner_admin" on leads;
create policy "leads_read_owner_admin" on leads
  for select using (
    is_admin()
    or (merchant_id is not null and owns_merchant(merchant_id))
  );

drop policy if exists "leads_insert_public" on leads;
create policy "leads_insert_public" on leads
  for insert with check (true);

drop policy if exists "leads_update_owner_admin" on leads;
create policy "leads_update_owner_admin" on leads
  for update using (
    is_admin()
    or (merchant_id is not null and owns_merchant(merchant_id))
  );

-- ------------------------------------------------------------
-- 7. COLONNES SUPPLÉMENTAIRES
-- ------------------------------------------------------------

-- Ajouter colonnes utiles à leads
alter table leads add column if not exists notes text;
alter table leads add column if not exists status text default 'new';

-- Ajouter colonnes utiles à offers
alter table offers add column if not exists stock int;
alter table offers add column if not exists expires_at timestamptz;

-- ------------------------------------------------------------
-- Done ✓
-- ------------------------------------------------------------
select 'Phase 2a SQL executed successfully' as status;
