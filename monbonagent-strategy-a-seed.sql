-- =====================================================================
-- MonBonAgent · Strategy A · Seed initial
-- Pousse dans Supabase exactement le contenu actuel de la home
-- pour que ouvrir l'admin = voir le site tel qu'il est aujourd'hui.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1) site_settings : on suppose qu'une ligne existe déjà (1 seule).
--    On UPDATE les nouveaux champs.
-- ---------------------------------------------------------------------
UPDATE site_settings SET
  -- Hero
  hero_pill_text         = 'Mon BonAgent Elne',
  hero_pill_icon         = 'fas fa-heart',
  hero_title             = COALESCE(NULLIF(hero_title,''), 'Consommez <em>local</em>. C''est soutenir vos commerçants, artisans et producteurs.'),
  hero_lead              = 'Ce midi, votre déjeuner à 8 € au lieu de 12 €. Demain, votre coupe à 25 € au lieu de 35 €. Chez vos commerçants d''Elne et des environs, chaque bon réservé soutient un voisin commerçant.',
  hero_cta_primary_label = 'Recevoir mon 1ᵉʳ bon offert',
  hero_cta_primary_sub   = '30 sec · sans carte bancaire',
  hero_cta_primary_icon  = 'fas fa-gift',
  hero_cta_primary_href  = '/commerces.html',
  hero_cta_primary_action= 'open_signup',
  hero_cta_secondary_label = 'Comment ça marche',
  hero_cta_secondary_icon  = 'fas fa-circle-question',
  hero_cta_secondary_href  = '#how-it-works',
  hero_stat_1_value      = '84',
  hero_stat_1_label      = 'commerces locaux référencés',
  hero_stat_2_value      = '+50 %',
  hero_stat_2_label      = 'd''avantage offert sur vos achats',
  hero_stat_3_value      = '0 €',
  hero_stat_3_label      = 'd''inscription, sans engagement',

  -- Titres section
  hiw_section_title        = 'Comment ça marche',
  hiw_section_subtitle     = '3 étapes simples. Aucune carte bancaire à l''inscription.',
  categories_section_title = 'Parcourez par catégorie',
  categories_section_subtitle = '12 univers de bons plans, sélectionnés chez vos commerçants d''Elne',
  about_section_title      = 'Pourquoi MonBonAgent',
  about_section_subtitle   = 'Des commerçants locaux, une seule communauté à Elne',
  faq_section_title        = 'Vos questions, nos réponses',
  faq_section_subtitle     = 'Tout ce qu''il faut savoir avant de réserver votre 1ᵉʳ bon.',

  -- Passeur
  passeur_pill        = 'Qui anime votre quartier',
  passeur_title_html  = 'Mon BonAgent, c''est <em>le relais qui manquait</em>.<br>Entre vos commerçants et vous.',
  passeur_lead_html   = 'À l''origine de MonBonAgent, il y a une idée simple. Les commerçants d''Elne veulent <strong>offrir de vrais bons plans</strong> aux habitants du coin. Les habitants veulent <strong>connaître ces bons plans</strong> et soutenir leur commerce local. Il manquait quelqu''un pour faire le lien.',
  passeur_body_html   = '<p>Ce quelqu''un, c''est moi. <strong>Nordine.</strong><br>Je suis agent immobilier à Elne depuis 2019, notre agence existe depuis 2008.<br>Mais MonBonAgent, ce n''est pas de l''immobilier.<br>C''est un truc que j''ai monté parce que je vis ici, tout simplement.</p><p>Je vois les commerçants ouvrir tôt, fermer tard, tenir bon. Je vois des habitants passer devant sans savoir ce qui se cache derrière la vitrine. Alors j''ai voulu créer le lien qui manquait.</p><p>Mon rôle ? Aucun titre compliqué. <strong>Je pousse la porte des commerces, je discute, je repars avec un avantage pour vous.</strong> Je vérifie que l''offre est vraie, utile, honnête. Et je vous la partage. C''est tout.</p>',
  passeur_bullets     = '[
    {"icon":"fas fa-circle-check","text":"Chaque bon est <strong>validé en direct</strong> avec un commerçant d''Elne"},
    {"icon":"fas fa-circle-check","text":"Chaque commerce partenaire est <strong>visité</strong> avant publication"},
    {"icon":"fas fa-circle-check","text":"Chaque interaction <strong>soutient un artisan ou commerçant</strong> du quartier"}
  ]'::jsonb,
  passeur_confession  = 'Personne ne me demande de faire ça. Personne ne me paie pour ça. Je le fais parce qu''Elne m''a tout donné, et que <strong>rendre ce qu''on a reçu, ça ne se calcule pas</strong>.',
  passeur_cta_label   = 'Découvrir les commerces partenaires',
  passeur_cta_href    = '/commerces.html',
  passeur_foot_html   = 'Et si un jour vous avez un projet immobilier, ou si quelqu''un autour de vous en parle… <a href="https://estime66.vercel.app?utm_source=monbonagent&utm_medium=relay_section&utm_campaign=cross_sell" target="_blank" rel="noopener">vous saurez où me trouver</a>. Ou pas. Et c''est très bien aussi.',
  passeur_photo_url   = '/assets/img/nordine.jpg',
  passeur_caption     = 'Nordine · Elne',

  -- Trust strip
  trust_pillars = '[
    {"type":"icon","icon":"fas fa-shield-halved","text_html":"Paiement <strong>100 % sécurisé</strong>"},
    {"type":"icon","icon":"fas fa-rotate-left","text_html":"<strong>Bon remboursé</strong> si non utilisé"},
    {"type":"icon","icon":"fas fa-handshake","text_html":"Soutien <strong>direct</strong> au commerce local d''Elne"},
    {"type":"badge","badge":"MBA","text_html":"<strong>Certifié</strong> Mon BonAgent"}
  ]'::jsonb,

  -- Bandeau immo
  immo_bar_active    = TRUE,
  immo_bar_text      = 'Propriétaire à Elne ? <strong>Estimez votre bien gratuitement</strong> avec votre agent local Guy Hoquet.',
  immo_bar_cta_label = 'Estimer mon bien',
  immo_bar_cta_href  = 'https://estime66.vercel.app?utm_source=monbonagent&utm_medium=immo_bar&utm_campaign=cross_sell',
  immo_bar_icon      = 'fas fa-house',

  -- Modal signup
  signup_modal_active       = TRUE,
  signup_modal_pill         = 'Lead magnet · Réciprocité',
  signup_modal_title_html   = 'Votre 1<sup>er</sup> bon est offert.',
  signup_modal_body         = 'Inscrivez-vous en 30 secondes. Vous recevez immédiatement un bon de bienvenue à utiliser chez le commerçant de votre choix à Elne. Aucune carte bancaire, aucun engagement.',
  signup_modal_button_label = 'Recevoir mon 1ᵉʳ bon',
  signup_modal_bullets      = '[
    {"icon":"fas fa-check-circle","text":"Bon envoyé par email immédiatement"},
    {"icon":"fas fa-check-circle","text":"Données strictement confidentielles, jamais revendues"},
    {"icon":"fas fa-check-circle","text":"Désinscription en 1 clic à tout moment"}
  ]'::jsonb,

  -- Sticky CTA
  sticky_cta_active        = TRUE,
  sticky_cta_text_html     = '<strong>1<sup>er</sup> bon offert</strong> à l''inscription · 30 sec · sans CB',
  sticky_cta_button_label  = 'Je reçois mon bon',
  sticky_cta_scroll_pct    = 25

WHERE TRUE;  -- une seule ligne dans site_settings

-- ---------------------------------------------------------------------
-- 2) how_it_works_steps : 3 étapes
-- ---------------------------------------------------------------------
DELETE FROM how_it_works_steps;
INSERT INTO how_it_works_steps (position, num_label, icon, visual_icon, deco_a_icon, deco_b_icon, title, body_html, active) VALUES
(1, '1', 'fas fa-user-plus',  'fas fa-envelope-open-text', 'fas fa-circle-check',     'fas fa-gift',    'Je m''inscris',           'Votre email suffit. 30 secondes. Vous recevez votre <strong>1ᵉʳ bon offert</strong> immédiatement.', TRUE),
(2, '2', 'fas fa-bolt',       'fas fa-qrcode',            'fas fa-tag',              'fas fa-mobile-screen-button', 'Je réserve mon bon', 'Je choisis le commerçant et le bon qui m''intéresse. Je paie en ligne. Mon QR code est instantané.', TRUE),
(3, '3', 'fas fa-store',      'fas fa-store',             'fas fa-shopping-bag',     'fas fa-handshake', 'Je l''utilise en magasin', 'Je présente le QR code chez le commerçant. Il scanne, c''est validé. <strong>Sinon, je suis remboursé.</strong>', TRUE);

-- ---------------------------------------------------------------------
-- 3) categories_grid : 12 tuiles
-- ---------------------------------------------------------------------
DELETE FROM categories_grid;
INSERT INTO categories_grid (position, slug, label, icon, image_url, active) VALUES
(1,  'alimentation',     'Alimentation',         'fas fa-basket-shopping',      'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=70', TRUE),
(2,  'escapades',        'Escapades',            'fas fa-suitcase-rolling',     'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=600&q=70', TRUE),
(3,  'maison',           'Maison',               'fas fa-couch',                'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=600&q=70', TRUE),
(4,  'restaurants',      'Restaurants',          'fas fa-utensils',             'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=70', TRUE),
(5,  'sante-bien-etre',  'Santé & bien-être',    'fas fa-spa',                  'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=600&q=70', TRUE),
(6,  'services',         'Services',             'fas fa-screwdriver-wrench',   'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=600&q=70', TRUE),
(7,  'divertissement',   'Divertissement',       'fas fa-masks-theater',        'https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&w=600&q=70', TRUE),
(8,  'animaux',          'Animaux',              'fas fa-paw',                  'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=600&q=70', TRUE),
(9,  'vetements-mode',   'Vêtements & mode',     'fas fa-shirt',                'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=600&q=70', TRUE),
(10, 'sports-activites', 'Sports & activités',   'fas fa-person-running',       'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=600&q=70', TRUE),
(11, 'bebes-enfants',    'Bébés & enfants',      'fas fa-baby',                 'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=600&q=70', TRUE),
(12, 'vins-spiritueux',  'Vins & spiritueux',    'fas fa-wine-glass',           'https://images.unsplash.com/photo-1510626176961-4b57d4fbad03?auto=format&fit=crop&w=600&q=70', TRUE);

-- ---------------------------------------------------------------------
-- 4) faq_items : 7 questions
-- ---------------------------------------------------------------------
DELETE FROM faq_items;
INSERT INTO faq_items (position, question, answer_html, active) VALUES
(1, 'Comment ça marche concrètement ?',
  'Vous vous inscrivez (30 sec, email seul). Vous parcourez les bons d''achat de vos commerçants d''Elne et vous réservez celui qui vous intéresse. Vous payez en ligne le prix du bon, vous recevez immédiatement votre <strong>QR code</strong> par email. Quand vous allez en magasin, le commerçant scanne votre QR code et applique l''avantage sur votre achat.', TRUE),
(2, 'Que se passe-t-il si je n''utilise pas mon bon ?',
  'Vous êtes <strong>automatiquement remboursé</strong> sur votre moyen de paiement initial sous 7 jours ouvrés après la date d''expiration du bon. Aucune démarche, aucun justificatif. Le commerçant est aussi indemnisé pour ne pas être pénalisé.', TRUE),
(3, 'Et si le commerçant refuse d''honorer mon bon ?',
  'Tous les commerçants partenaires ont signé une convention. Si l''un d''eux refuse de scanner votre QR code, vous nous contactez immédiatement à <a href="mailto:contact@monbonagent.fr">contact@monbonagent.fr</a> et nous vous remboursons l''intégralité sous 48 h. Aucune discussion.', TRUE),
(4, 'Combien de temps mon bon est-il valable ?',
  'La durée de validité est précisée sur chaque bon avant achat (généralement 30 à 90 jours). Vous recevez aussi un rappel par email <strong>7 jours avant expiration</strong> pour ne rien rater. Date de validité = date affichée, sans renouvellement automatique.', TRUE),
(5, 'Pourquoi passer par MonBonAgent et pas aller directement chez le commerçant ?',
  'Parce que les avantages ne sont disponibles que via les bons MonBonAgent. Le commerçant nous a confié des offres exclusives qui ne sont pas affichées en boutique. C''est la <strong>contrepartie de notre travail de visibilité locale</strong> et de paiement sécurisé.', TRUE),
(6, 'Mes données personnelles sont-elles vendues à des tiers ?',
  '<strong>Non, jamais.</strong> Vos données restent strictement entre vous et le commerçant chez qui vous réservez. Aucune revente, aucun partage à des partenaires publicitaires. Vous pouvez supprimer votre compte et toutes vos données à tout moment depuis votre espace personnel.', TRUE),
(7, 'Qui est derrière MonBonAgent ?',
  'MonBonAgent est animé par <strong>Nordine</strong>, le passeur d''information entre les commerçants d''Elne et les habitants du quartier. Il négocie chaque bon en direct avec les commerçants et vérifie chaque offre avant publication. Plus de détails dans la section <a href="#le-bon-agent">"Qui anime votre quartier"</a>. Contact : <a href="mailto:contact@monbonagent.fr">contact@monbonagent.fr</a>.', TRUE);

-- ---------------------------------------------------------------------
-- 5) about_sections (existant) : on garde, mais on s'assure du contenu
-- ---------------------------------------------------------------------
UPDATE site_settings SET about_sections = '[
  {
    "title": "Le portail des bons plans de votre quartier",
    "body_html": "Mon BonAgent rassemble en un seul endroit toutes les offres que vos commerçants d''Elne et des environs préparent rien que pour vous. Plus besoin de courir d''une vitrine à l''autre. Vous ouvrez le site, vous parcourez, vous réservez. Vos économies arrivent en même temps que votre QR code.",
    "image_url": "https://images.pexels.com/photos/8422740/pexels-photo-8422740.jpeg?auto=compress&cs=tinysrgb&w=1000",
    "cta_label": "Voir les commerçants",
    "cta_href": "/commerces.html",
    "reverse": false
  },
  {
    "title": "Tout ce dont vous avez besoin, à deux pas",
    "body_html": "12 univers à explorer : alimentation, restaurants, santé, mode, escapades, maison, animaux, sport, jeux d''enfants, vins, services, divertissement. Une bonne table ce soir ? Un cadeau d''anniversaire ? Une remise sur vos courses du week-end ? Un abonnement au club de sport ? Vous trouverez ce qui vous fait plaisir, à un prix qui vous arrange.",
    "image_url": "https://images.pexels.com/photos/34674788/pexels-photo-34674788.jpeg?auto=compress&cs=tinysrgb&w=1000",
    "cta_label": "Parcourir les catégories",
    "cta_href": "#categories-grid",
    "reverse": true
  },
  {
    "title": "À chaque achat, un voisin commerçant gagne aussi",
    "body_html": "Quand vous réservez un bon ici, vous ne payez pas seulement moins. Vous donnez aussi un coup de pouce à un artisan qui fait vivre votre quartier. Le boulanger, le coiffeur, le restaurateur du coin gagnent en visibilité, en clients, en fidélité. C''est ça, l''esprit Mon BonAgent : un site qui fait du bien à tout le monde.",
    "image_url": "https://images.pexels.com/photos/6605239/pexels-photo-6605239.jpeg?auto=compress&cs=tinysrgb&w=1000",
    "cta_label": "Voir les commerces partenaires",
    "cta_href": "/commerces.html",
    "reverse": false
  }
]'::jsonb
WHERE TRUE;

COMMIT;
