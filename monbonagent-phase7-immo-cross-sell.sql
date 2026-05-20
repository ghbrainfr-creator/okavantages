-- ============================================================================
-- MonBonAgent — Phase 7 : Email j+5 cross-sell agent immobilier
-- ----------------------------------------------------------------------------
-- À exécuter dans Supabase SQL Editor.
-- Crée le template email "cross_sell_immo_j5" + la séquence automatique
-- qui le déclenche 5 jours après l'inscription d'un lead (trigger new_lead).
-- ============================================================================

-- 1. Template email cross-sell immo
insert into public.admin_email_templates (id, slug, subject, body_html, body_text, kind, is_system)
values (
  gen_random_uuid(),
  'cross_sell_immo_j5',
  'Vous êtes propriétaire à Elne ? (estimation gratuite offerte)',
  $html$
<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Estimation gratuite — Guy Hoquet Elne</title></head>
<body style="margin:0;padding:0;background:#f8f9fc;font-family:Arial,Helvetica,sans-serif;color:#212529;line-height:1.55">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fc;padding:24px 0">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(15,10,48,.08)">
      <tr><td style="background:#0f0a30;padding:30px 28px;color:#fff;text-align:center">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#7fb8ff;margin-bottom:8px">Service partenaire · Guy Hoquet</div>
        <h1 style="margin:0;font-size:24px;font-weight:700;letter-spacing:.3px">Bonjour {{lead.name|default:""}},</h1>
      </td></tr>
      <tr><td style="padding:28px">
        <p style="margin:0 0 14px;font-size:15px">Vous avez réservé un bon d'achat chez l'un de nos commerçants partenaires d'Elne il y a quelques jours — j'espère qu'il vous a fait plaisir.</p>
        <p style="margin:0 0 14px;font-size:15px">Je suis <strong>Nordine Mouaouia</strong>, agent immobilier Guy Hoquet à Perpignan, et c'est mon agence qui rend ce service de bons d'achat possible pour soutenir les commerces de notre quartier.</p>
        <p style="margin:0 0 18px;font-size:15px">Si vous êtes <strong>propriétaire à Elne ou alentours</strong>, j'aimerais vous offrir quelque chose en retour :</p>
        <div style="background:#eef3fa;border-left:4px solid #006fff;padding:18px 20px;margin:18px 0;border-radius:0 10px 10px 0">
          <div style="font-size:18px;font-weight:700;color:#0f0a30;margin-bottom:8px">L'estimation gratuite et confidentielle de votre bien</div>
          <ul style="margin:8px 0 0 18px;padding:0;font-size:14px">
            <li>Réponse personnalisée en moins de 24&nbsp;heures</li>
            <li>Analyse basée sur les ventes réelles de votre quartier (DVF officiel)</li>
            <li>Aucun engagement, aucun démarchage</li>
          </ul>
        </div>
        <p style="margin:0 0 20px;font-size:15px">C'est utile même si vous ne vendez pas demain — connaître la valeur de son bien aide à mieux décider (assurance, donation, fiscalité, projet futur).</p>
        <div style="text-align:center;margin:24px 0">
          <a href="https://estime66.vercel.app?utm_source=monbonagent&utm_medium=email&utm_campaign=j5_immo_cross_sell" style="display:inline-block;background:#006fff;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">Estimer mon bien gratuitement →</a>
        </div>
        <p style="margin:18px 0 0;font-size:14px;color:#495057">À très vite,<br><strong>Nordine Mouaouia</strong><br>Agent Guy Hoquet Perpignan<br>contact@monbonagent.fr</p>
      </td></tr>
      <tr><td style="background:#f8f9fc;padding:18px 28px;text-align:center;font-size:11px;color:#6c757d">
        Vous recevez cet email parce que vous êtes inscrit·e sur MonBonAgent.
        <a href="{{unsubscribe_url}}" style="color:#6c757d">Se désinscrire</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>
  $html$,
  $text$
Bonjour {{lead.name|default:""}},

Vous avez réservé un bon d'achat chez l'un de nos commerçants partenaires d'Elne il y a quelques jours — j'espère qu'il vous a fait plaisir.

Je suis Nordine Mouaouia, agent immobilier Guy Hoquet à Perpignan, et c'est mon agence qui rend ce service de bons d'achat possible pour soutenir les commerces de notre quartier.

Si vous êtes propriétaire à Elne ou alentours, j'aimerais vous offrir quelque chose en retour :

L'ESTIMATION GRATUITE ET CONFIDENTIELLE DE VOTRE BIEN
- Réponse personnalisée en moins de 24 heures
- Analyse basée sur les ventes réelles de votre quartier (DVF officiel)
- Aucun engagement, aucun démarchage

C'est utile même si vous ne vendez pas demain — connaître la valeur de son bien aide à mieux décider (assurance, donation, fiscalité, projet futur).

Estimer mon bien gratuitement :
https://estime66.vercel.app?utm_source=monbonagent&utm_medium=email&utm_campaign=j5_immo_cross_sell

À très vite,
Nordine Mouaouia
Agent Guy Hoquet Perpignan
contact@monbonagent.fr

Se désinscrire : {{unsubscribe_url}}
  $text$,
  'cross_sell',
  true
)
on conflict (slug) do update
  set subject   = excluded.subject,
      body_html = excluded.body_html,
      body_text = excluded.body_text,
      kind      = excluded.kind;

-- 2. Séquence automatique : déclenche le template j+5 après new_lead
insert into public.email_sequences (id, slug, name, trigger_type, template_slug, delay_hours, is_active)
select gen_random_uuid(), 'j5-immo-cross-sell', 'Cross-sell immo J+5', 'new_lead', 'cross_sell_immo_j5', 120, true
where not exists (select 1 from public.email_sequences where slug = 'j5-immo-cross-sell');

-- 3. Vérification
select slug, name, trigger_type, template_slug, delay_hours, is_active
  from public.email_sequences
 where slug = 'j5-immo-cross-sell';

select slug, subject, kind from public.admin_email_templates where slug = 'cross_sell_immo_j5';
