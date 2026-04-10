# OK Avantages — Edge Functions

Deux fonctions Deno à déployer sur Supabase :

## 1. `send-email`
Envoie un email unique via Resend pour un commerçant.

**POST** `/functions/v1/send-email`
```json
{ "template_id": "uuid", "lead_id": "uuid", "merchant_id": "uuid", "sequence_id": "uuid" }
```

## 2. `process-sequences`
Job cron qui balaye les séquences actives et envoie les emails éligibles.

## Déploiement

### Pré-requis (une fois)
```bash
# Installer le CLI Supabase
brew install supabase/tap/supabase   # macOS
# ou : npm install -g supabase

# Se connecter
supabase login

# Lier le projet
supabase link --project-ref rvknysmuuusygowwauar

# Créer les secrets
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
```

### Déployer les fonctions
```bash
supabase functions deploy send-email
supabase functions deploy process-sequences
```

### Programmer le cron (à coller dans SQL Editor Supabase)
```sql
-- Active les extensions cron + http si pas déjà fait
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Toutes les heures, process-sequences tourne
select cron.schedule(
  'process-sequences-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://rvknysmuuusygowwauar.functions.supabase.co/process-sequences',
    headers := jsonb_build_object('Authorization','Bearer ' || current_setting('app.service_role_key', true))
  );
  $$
);
```

> Note : remplace `current_setting(...)` par ta vraie clé service_role si tu n'as
> pas configuré la variable de session, ou exécute le cron depuis Supabase Studio
> qui autorise déjà l'appel.

## Tests rapides

### Test `send-email` directement
```bash
curl -X POST https://rvknysmuuusygowwauar.functions.supabase.co/send-email \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"template_id":"<tpl_uuid>","lead_id":"<lead_uuid>"}'
```

### Test `process-sequences`
```bash
curl -X POST https://rvknysmuuusygowwauar.functions.supabase.co/process-sequences \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>"
```
