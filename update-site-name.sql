-- MonBonAgent — Mise à jour du nom du site
-- À exécuter dans Supabase SQL Editor
-- Met à jour la ligne unique de site_settings pour afficher "MonBonAgent"

update site_settings
set
  site_title = 'MonBonAgent',
  site_tagline = coalesce(site_tagline, 'Bons d''achat & commerce local à Perpignan'),
  updated_at = now()
where id = (select id from site_settings limit 1);

select id, site_title, site_tagline, updated_at from site_settings;
