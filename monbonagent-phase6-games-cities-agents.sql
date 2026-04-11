-- ============================================================================
-- MonBonAgent — Phase 6 : Jeux concours + Villes France + Multi-agents immo
-- ============================================================================
-- À exécuter dans Supabase SQL Editor. 100% idempotent — safe à relancer.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) CITIES : toutes les villes de France
-- ---------------------------------------------------------------------------
create table if not exists public.cities (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  name          text not null,
  department    text,                    -- ex: '66'
  postal_code   text,                    -- code postal principal
  region        text,                    -- ex: 'Occitanie'
  lat           double precision,
  lng           double precision,
  population    integer,
  is_active     boolean default true,
  is_manual     boolean default false,   -- true si ajouté manuellement via admin
  cover_image   text,
  tagline       text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists cities_slug_idx on public.cities(slug);
create index if not exists cities_department_idx on public.cities(department);
create index if not exists cities_active_idx on public.cities(is_active) where is_active = true;

alter table public.cities enable row level security;

drop policy if exists "cities_public_read" on public.cities;
create policy "cities_public_read" on public.cities
  for select using (is_active = true);

drop policy if exists "cities_admin_all" on public.cities;
create policy "cities_admin_all" on public.cities
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');


-- ---------------------------------------------------------------------------
-- 2) AGENTS : plusieurs agents immobiliers, un ou plusieurs par ville
-- ---------------------------------------------------------------------------
create table if not exists public.agents (
  id               uuid primary key default gen_random_uuid(),
  slug             text unique not null,
  name             text not null,
  title            text default 'Agent immobilier',
  agency           text,
  email            text,
  phone            text,
  whatsapp         text,
  photo_url        text,
  cover_url        text,
  bio              text,
  signature        text,
  siret            text,
  carte_pro        text,
  specialties      text[],              -- ex: {'Ancien','Neuf','Investissement'}
  linkedin_url     text,
  instagram_url    text,
  website_url      text,
  years_experience integer,
  is_primary       boolean default false, -- agent "par défaut" si aucune ville sélectionnée
  is_active        boolean default true,
  sort_order       integer default 0,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create index if not exists agents_slug_idx on public.agents(slug);
create index if not exists agents_primary_idx on public.agents(is_primary) where is_primary = true;
create index if not exists agents_active_idx on public.agents(is_active) where is_active = true;

alter table public.agents enable row level security;

drop policy if exists "agents_public_read" on public.agents;
create policy "agents_public_read" on public.agents
  for select using (is_active = true);

drop policy if exists "agents_admin_all" on public.agents;
create policy "agents_admin_all" on public.agents
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');


-- ---------------------------------------------------------------------------
-- 3) AGENT_CITIES : relation many-to-many (un agent couvre N villes)
-- ---------------------------------------------------------------------------
create table if not exists public.agent_cities (
  id         uuid primary key default gen_random_uuid(),
  agent_id   uuid not null references public.agents(id) on delete cascade,
  city_id    uuid not null references public.cities(id) on delete cascade,
  is_lead    boolean default false,      -- "agent principal" pour cette ville
  banner_headline text,                  -- texte personnalisable de la bannière
  banner_cta      text,                  -- CTA personnalisable
  banner_image    text,                  -- image personnalisée pour cette ville
  created_at timestamptz default now(),
  unique(agent_id, city_id)
);

create index if not exists agent_cities_agent_idx on public.agent_cities(agent_id);
create index if not exists agent_cities_city_idx on public.agent_cities(city_id);
create index if not exists agent_cities_lead_idx on public.agent_cities(city_id, is_lead) where is_lead = true;

alter table public.agent_cities enable row level security;

drop policy if exists "agent_cities_public_read" on public.agent_cities;
create policy "agent_cities_public_read" on public.agent_cities
  for select using (true);

drop policy if exists "agent_cities_admin_all" on public.agent_cities;
create policy "agent_cities_admin_all" on public.agent_cities
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');


-- ---------------------------------------------------------------------------
-- 4) MERCHANTS : rattachement à une ville (city_id optionnel, city texte conservé)
-- ---------------------------------------------------------------------------
alter table public.merchants add column if not exists city_id uuid references public.cities(id) on delete set null;
create index if not exists merchants_city_id_idx on public.merchants(city_id);


-- ---------------------------------------------------------------------------
-- 5) CONTESTS : jeux concours mensuels par commerçant
-- ---------------------------------------------------------------------------
create table if not exists public.contests (
  id                  uuid primary key default gen_random_uuid(),
  merchant_id         uuid not null references public.merchants(id) on delete cascade,
  city_id             uuid references public.cities(id) on delete set null,
  title               text not null,
  description         text,
  prize_description   text not null,      -- ex: "Un bon d'achat de 100€ utilisable sur tout le magasin"
  prize_value         numeric,
  prize_image         text,
  starts_at           timestamptz not null default now(),
  ends_at             timestamptz not null,
  status              text not null default 'draft' check (status in ('draft','active','paused','ended','drawn','won')),

  -- Mécanique de sélection : 1 tour tous les N sélectionne automatiquement
  selection_interval  integer not null default 50 check (selection_interval > 0),
  total_spins         integer not null default 0,
  total_participants  integer not null default 0,
  total_shares        integer not null default 0,

  -- Résultat
  winner_participation_id uuid,
  winner_drawn_at     timestamptz,
  winner_notified     boolean default false,

  -- Paramètres additionnels
  spins_per_signup    integer default 1,   -- tours offerts à l'inscription
  spins_per_share     integer default 1,   -- tours offerts par partage
  max_spins_per_user  integer default 10,  -- plafond par participant

  require_consent_newsletter boolean default true,
  require_consent_agent      boolean default false,

  cover_image         text,
  cta_text            text default 'Tenter ma chance',

  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create index if not exists contests_merchant_idx on public.contests(merchant_id);
create index if not exists contests_city_idx on public.contests(city_id);
create index if not exists contests_status_idx on public.contests(status);
create index if not exists contests_active_idx on public.contests(status, ends_at) where status in ('active','paused');

alter table public.contests enable row level security;

drop policy if exists "contests_public_read" on public.contests;
create policy "contests_public_read" on public.contests
  for select using (status in ('active','paused','ended','drawn','won'));

drop policy if exists "contests_admin_all" on public.contests;
create policy "contests_admin_all" on public.contests
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');


-- ---------------------------------------------------------------------------
-- 6) CONTEST_PARTICIPATIONS : 1 par email x contest
-- ---------------------------------------------------------------------------
create table if not exists public.contest_participations (
  id                  uuid primary key default gen_random_uuid(),
  contest_id          uuid not null references public.contests(id) on delete cascade,
  email               text not null,
  first_name          text,
  last_name           text,
  phone               text,
  city_id             uuid references public.cities(id) on delete set null,

  -- Rattachement agent immobilier (pour alimenter sa mailing list)
  agent_id            uuid references public.agents(id) on delete set null,

  -- Compteurs
  spins_earned        integer not null default 0,
  spins_used          integer not null default 0,
  shares_count        integer not null default 0,

  -- Share tracking
  share_code          text unique,         -- code unique pour tracker qui partage quoi
  referred_by         uuid references public.contest_participations(id) on delete set null,

  -- Sélection & tirage
  is_selected         boolean default false,
  selected_at         timestamptz,
  is_winner           boolean default false,

  -- Consentements (RGPD)
  consent_newsletter  boolean default false,
  consent_agent       boolean default false,
  consent_rules       boolean default true,

  -- Meta
  ip_hash             text,
  user_agent          text,
  utm_source          text,
  utm_medium          text,
  utm_campaign        text,

  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  unique(contest_id, email)
);

create index if not exists contest_parts_contest_idx on public.contest_participations(contest_id);
create index if not exists contest_parts_email_idx on public.contest_participations(email);
create index if not exists contest_parts_agent_idx on public.contest_participations(agent_id);
create index if not exists contest_parts_share_code_idx on public.contest_participations(share_code);
create index if not exists contest_parts_selected_idx on public.contest_participations(contest_id, is_selected) where is_selected = true;

alter table public.contest_participations enable row level security;

-- Public peut créer (insert) via RPC server-side uniquement, pas de select public
drop policy if exists "contest_parts_admin_all" on public.contest_participations;
create policy "contest_parts_admin_all" on public.contest_participations
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');


-- ---------------------------------------------------------------------------
-- 7) CONTEST_SPINS : journal de chaque tour de roue (audit + preuve)
-- ---------------------------------------------------------------------------
create table if not exists public.contest_spins (
  id                uuid primary key default gen_random_uuid(),
  contest_id        uuid not null references public.contests(id) on delete cascade,
  participation_id  uuid not null references public.contest_participations(id) on delete cascade,
  spin_index        integer not null,    -- rang global dans le contest (1, 2, 3, ...)
  is_winning_spin   boolean default false, -- true si ce tour a déclenché la sélection
  source            text default 'wheel',  -- 'wheel', 'bonus_share', 'bonus_signup'
  created_at        timestamptz default now()
);

create index if not exists contest_spins_contest_idx on public.contest_spins(contest_id);
create index if not exists contest_spins_part_idx on public.contest_spins(participation_id);
create index if not exists contest_spins_winning_idx on public.contest_spins(contest_id, is_winning_spin) where is_winning_spin = true;
create unique index if not exists contest_spins_contest_index_unique on public.contest_spins(contest_id, spin_index);

alter table public.contest_spins enable row level security;
drop policy if exists "contest_spins_admin_all" on public.contest_spins;
create policy "contest_spins_admin_all" on public.contest_spins
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');


-- ---------------------------------------------------------------------------
-- 8) FONCTION RPC : register_spin (atomique, à appeler depuis api/contest.js)
-- ---------------------------------------------------------------------------
-- Incrémente total_spins du contest, insère un log dans contest_spins, et si
-- le rang atteint selection_interval (et multiples) sans qu'un gagnant soit
-- déjà désigné, marque la participation comme is_selected + is_winner.
-- Retourne le résultat du tour.

create or replace function public.register_contest_spin(
  p_contest_id uuid,
  p_participation_id uuid,
  p_source text default 'wheel'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contest   contests%rowtype;
  v_part      contest_participations%rowtype;
  v_new_index integer;
  v_is_win    boolean := false;
  v_modulo    integer;
begin
  -- Lock contest row pour éviter race
  select * into v_contest from contests where id = p_contest_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'contest_not_found');
  end if;
  if v_contest.status not in ('active') then
    return jsonb_build_object('ok', false, 'error', 'contest_not_active', 'status', v_contest.status);
  end if;
  if v_contest.winner_participation_id is not null then
    return jsonb_build_object('ok', false, 'error', 'already_won');
  end if;
  if now() > v_contest.ends_at then
    update contests set status = 'ended' where id = p_contest_id;
    return jsonb_build_object('ok', false, 'error', 'contest_ended');
  end if;

  -- Lock participation row
  select * into v_part from contest_participations
    where id = p_participation_id and contest_id = p_contest_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'participation_not_found');
  end if;
  if v_part.spins_used >= v_part.spins_earned then
    return jsonb_build_object('ok', false, 'error', 'no_spins_left',
      'spins_earned', v_part.spins_earned, 'spins_used', v_part.spins_used);
  end if;

  -- Incrémente le compteur global et calcule le rang du tour
  v_new_index := v_contest.total_spins + 1;
  v_modulo := v_new_index % v_contest.selection_interval;
  if v_modulo = 0 then
    v_is_win := true;
  end if;

  -- Update contest
  update contests
     set total_spins = v_new_index,
         updated_at = now(),
         winner_participation_id = case when v_is_win then p_participation_id else winner_participation_id end,
         winner_drawn_at         = case when v_is_win then now() else winner_drawn_at end,
         status                  = case when v_is_win then 'won' else status end
   where id = p_contest_id;

  -- Update participation
  update contest_participations
     set spins_used   = spins_used + 1,
         is_selected  = case when v_is_win then true else is_selected end,
         selected_at  = case when v_is_win then now() else selected_at end,
         is_winner    = case when v_is_win then true else is_winner end,
         updated_at   = now()
   where id = p_participation_id;

  -- Log du spin
  insert into contest_spins(contest_id, participation_id, spin_index, is_winning_spin, source)
  values (p_contest_id, p_participation_id, v_new_index, v_is_win, p_source);

  return jsonb_build_object(
    'ok', true,
    'spin_index', v_new_index,
    'is_winner', v_is_win,
    'next_winner_in', case when v_is_win then v_contest.selection_interval else v_contest.selection_interval - v_modulo end,
    'total_spins', v_new_index
  );
end;
$$;

grant execute on function public.register_contest_spin(uuid, uuid, text) to authenticated, anon, service_role;


-- ---------------------------------------------------------------------------
-- 9) FONCTION RPC : contest_grant_bonus_spins (partage, parrainage…)
-- ---------------------------------------------------------------------------
create or replace function public.contest_grant_bonus(
  p_participation_id uuid,
  p_spins integer default 1,
  p_reason text default 'share'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_part    contest_participations%rowtype;
  v_contest contests%rowtype;
  v_max     integer;
begin
  select * into v_part from contest_participations where id = p_participation_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;

  select * into v_contest from contests where id = v_part.contest_id;
  v_max := coalesce(v_contest.max_spins_per_user, 10);

  if (v_part.spins_earned + p_spins) > v_max then
    p_spins := greatest(0, v_max - v_part.spins_earned);
  end if;

  update contest_participations
     set spins_earned = spins_earned + p_spins,
         shares_count = case when p_reason = 'share' then shares_count + 1 else shares_count end,
         updated_at = now()
   where id = p_participation_id;

  if p_reason = 'share' then
    update contests set total_shares = total_shares + 1 where id = v_part.contest_id;
  end if;

  return jsonb_build_object('ok', true, 'granted', p_spins, 'spins_earned', v_part.spins_earned + p_spins);
end;
$$;

grant execute on function public.contest_grant_bonus(uuid, integer, text) to authenticated, anon, service_role;


-- ---------------------------------------------------------------------------
-- 10) VIEW : agent pour une ville (avec fallback sur agent primary)
-- ---------------------------------------------------------------------------
create or replace view public.city_lead_agent as
select
  c.id as city_id,
  c.slug as city_slug,
  c.name as city_name,
  coalesce(a.id, ap.id) as agent_id,
  coalesce(a.slug, ap.slug) as agent_slug,
  coalesce(a.name, ap.name) as agent_name,
  coalesce(a.title, ap.title) as agent_title,
  coalesce(a.photo_url, ap.photo_url) as agent_photo,
  coalesce(a.bio, ap.bio) as agent_bio,
  coalesce(a.email, ap.email) as agent_email,
  coalesce(a.phone, ap.phone) as agent_phone,
  ac.banner_headline,
  ac.banner_cta,
  ac.banner_image
from cities c
left join agent_cities ac on ac.city_id = c.id and ac.is_lead = true
left join agents a on a.id = ac.agent_id and a.is_active = true
left join agents ap on ap.is_primary = true and ap.is_active = true and a.id is null
where c.is_active = true;

grant select on public.city_lead_agent to authenticated, anon;


-- ---------------------------------------------------------------------------
-- Fin Phase 6
-- ---------------------------------------------------------------------------
