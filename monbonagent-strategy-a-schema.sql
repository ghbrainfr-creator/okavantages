-- =====================================================================
-- MonBonAgent · Strategy A · Full reconnect back-office <-> front
-- Date : 2026-05-23
-- Auteur : Nordine Mouaouia
-- Objectif : permettre à l'admin de piloter 100 % des sections de la home
--           (hero, hiw, catégories, about, passeur, faq, trust strip,
--            immo bar, modal signup, sticky cta) depuis Supabase.
-- =====================================================================

BEGIN;

-- ------------------------------------------------------------
-- 1) Extension de site_settings (champs simples)
-- ------------------------------------------------------------
ALTER TABLE site_settings
  -- Hero étendu
  ADD COLUMN IF NOT EXISTS hero_pill_text TEXT,
  ADD COLUMN IF NOT EXISTS hero_pill_icon TEXT,
  ADD COLUMN IF NOT EXISTS hero_lead TEXT,
  ADD COLUMN IF NOT EXISTS hero_cta_primary_label TEXT,
  ADD COLUMN IF NOT EXISTS hero_cta_primary_sub TEXT,
  ADD COLUMN IF NOT EXISTS hero_cta_primary_icon TEXT,
  ADD COLUMN IF NOT EXISTS hero_cta_primary_href TEXT,
  ADD COLUMN IF NOT EXISTS hero_cta_primary_action TEXT,  -- 'open_signup' | 'navigate'
  ADD COLUMN IF NOT EXISTS hero_cta_secondary_label TEXT,
  ADD COLUMN IF NOT EXISTS hero_cta_secondary_icon TEXT,
  ADD COLUMN IF NOT EXISTS hero_cta_secondary_href TEXT,
  ADD COLUMN IF NOT EXISTS hero_stat_1_value TEXT,
  ADD COLUMN IF NOT EXISTS hero_stat_1_label TEXT,
  ADD COLUMN IF NOT EXISTS hero_stat_2_value TEXT,
  ADD COLUMN IF NOT EXISTS hero_stat_2_label TEXT,
  ADD COLUMN IF NOT EXISTS hero_stat_3_value TEXT,
  ADD COLUMN IF NOT EXISTS hero_stat_3_label TEXT,

  -- Titres de section (sous-titres compris)
  ADD COLUMN IF NOT EXISTS hiw_section_title TEXT,
  ADD COLUMN IF NOT EXISTS hiw_section_subtitle TEXT,
  ADD COLUMN IF NOT EXISTS categories_section_title TEXT,
  ADD COLUMN IF NOT EXISTS categories_section_subtitle TEXT,
  ADD COLUMN IF NOT EXISTS about_section_title TEXT,
  ADD COLUMN IF NOT EXISTS about_section_subtitle TEXT,
  ADD COLUMN IF NOT EXISTS faq_section_title TEXT,
  ADD COLUMN IF NOT EXISTS faq_section_subtitle TEXT,

  -- Section "Le passeur"
  ADD COLUMN IF NOT EXISTS passeur_pill TEXT,
  ADD COLUMN IF NOT EXISTS passeur_title_html TEXT,
  ADD COLUMN IF NOT EXISTS passeur_lead_html TEXT,
  ADD COLUMN IF NOT EXISTS passeur_body_html TEXT,
  ADD COLUMN IF NOT EXISTS passeur_bullets JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS passeur_confession TEXT,
  ADD COLUMN IF NOT EXISTS passeur_cta_label TEXT,
  ADD COLUMN IF NOT EXISTS passeur_cta_href TEXT,
  ADD COLUMN IF NOT EXISTS passeur_foot_html TEXT,
  ADD COLUMN IF NOT EXISTS passeur_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS passeur_caption TEXT,

  -- Trust strip (4 piliers)
  ADD COLUMN IF NOT EXISTS trust_pillars JSONB DEFAULT '[]'::jsonb,

  -- Bandeau immo soft
  ADD COLUMN IF NOT EXISTS immo_bar_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS immo_bar_text TEXT,
  ADD COLUMN IF NOT EXISTS immo_bar_cta_label TEXT,
  ADD COLUMN IF NOT EXISTS immo_bar_cta_href TEXT,
  ADD COLUMN IF NOT EXISTS immo_bar_icon TEXT,

  -- Modal signup (lead magnet 1er bon)
  ADD COLUMN IF NOT EXISTS signup_modal_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS signup_modal_pill TEXT,
  ADD COLUMN IF NOT EXISTS signup_modal_title_html TEXT,
  ADD COLUMN IF NOT EXISTS signup_modal_body TEXT,
  ADD COLUMN IF NOT EXISTS signup_modal_button_label TEXT,
  ADD COLUMN IF NOT EXISTS signup_modal_bullets JSONB DEFAULT '[]'::jsonb,

  -- Sticky CTA bar
  ADD COLUMN IF NOT EXISTS sticky_cta_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS sticky_cta_text_html TEXT,
  ADD COLUMN IF NOT EXISTS sticky_cta_button_label TEXT,
  ADD COLUMN IF NOT EXISTS sticky_cta_scroll_pct INT DEFAULT 25;

-- ------------------------------------------------------------
-- 2) Tables enfants (CRUD natif depuis l'admin)
-- ------------------------------------------------------------

-- 2.1 Étapes "Comment ça marche"
CREATE TABLE IF NOT EXISTS how_it_works_steps (
  id BIGSERIAL PRIMARY KEY,
  position INT NOT NULL DEFAULT 1,
  num_label TEXT NOT NULL,         -- '1', '2', '3'
  icon TEXT,                       -- 'fas fa-user-plus'
  visual_icon TEXT,                -- 'fas fa-envelope-open-text'
  deco_a_icon TEXT,                -- 'fas fa-circle-check'
  deco_b_icon TEXT,                -- 'fas fa-gift'
  title TEXT NOT NULL,
  body_html TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hiw_position ON how_it_works_steps(position);

-- 2.2 Catégories de la grille home
CREATE TABLE IF NOT EXISTS categories_grid (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  icon TEXT,                       -- 'fas fa-basket-shopping'
  image_url TEXT,
  position INT NOT NULL DEFAULT 1,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_catgrid_position ON categories_grid(position);

-- 2.3 FAQ
CREATE TABLE IF NOT EXISTS faq_items (
  id BIGSERIAL PRIMARY KEY,
  position INT NOT NULL DEFAULT 1,
  question TEXT NOT NULL,
  answer_html TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_faq_position ON faq_items(position);

-- ------------------------------------------------------------
-- 3) RLS : lecture publique, écriture admin
-- ------------------------------------------------------------
ALTER TABLE how_it_works_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories_grid    ENABLE ROW LEVEL SECURITY;
ALTER TABLE faq_items          ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hiw_public_read"  ON how_it_works_steps;
DROP POLICY IF EXISTS "hiw_admin_write"  ON how_it_works_steps;
DROP POLICY IF EXISTS "cat_public_read"  ON categories_grid;
DROP POLICY IF EXISTS "cat_admin_write"  ON categories_grid;
DROP POLICY IF EXISTS "faq_public_read"  ON faq_items;
DROP POLICY IF EXISTS "faq_admin_write"  ON faq_items;

CREATE POLICY "hiw_public_read"  ON how_it_works_steps FOR SELECT USING (active = TRUE);
CREATE POLICY "hiw_admin_write"  ON how_it_works_steps FOR ALL    USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "cat_public_read"  ON categories_grid    FOR SELECT USING (active = TRUE);
CREATE POLICY "cat_admin_write"  ON categories_grid    FOR ALL    USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "faq_public_read"  ON faq_items          FOR SELECT USING (active = TRUE);
CREATE POLICY "faq_admin_write"  ON faq_items          FOR ALL    USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

COMMIT;
