-- =========================================================
-- MonBonAgent — Phase 4 : table blog_posts (Le Mag)
-- Idempotent — safe à rejouer
-- =========================================================

create extension if not exists pgcrypto;

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  excerpt text,
  content_html text,
  category text,
  author text,
  image_url text,
  image_keyword text,
  tags text[] default '{}',
  merchant_id uuid references public.merchants(id) on delete set null,
  status text default 'published',
  published_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_blog_posts_published_at on public.blog_posts (published_at desc);
create index if not exists idx_blog_posts_category on public.blog_posts (category);
create index if not exists idx_blog_posts_merchant_id on public.blog_posts (merchant_id);

alter table public.blog_posts enable row level security;

drop policy if exists "blog_posts public read" on public.blog_posts;
create policy "blog_posts public read" on public.blog_posts
  for select using (status = 'published');

drop policy if exists "blog_posts admin all" on public.blog_posts;
create policy "blog_posts admin all" on public.blog_posts
  for all
  using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

-- Updated_at trigger
create or replace function public.set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;

drop trigger if exists blog_posts_set_updated_at on public.blog_posts;
create trigger blog_posts_set_updated_at
  before update on public.blog_posts
  for each row execute procedure public.set_updated_at();
