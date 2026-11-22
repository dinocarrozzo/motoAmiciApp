# Configurare Supabase per il prototipo

Passi da fare una volta sola, a mano:

1. Crea un progetto gratuito su supabase.com.
2. In **Authentication → Sign In / Providers**, attiva **Allow anonymous sign-ins**.
3. In **SQL Editor** incolla ed esegui il contenuto di `supabase/migrations/0001_track_points.sql`.
4. In **Project Settings → API** copia l'URL del progetto e la chiave `anon`.
5. Copia `.env.example` in `.env` e compila `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
6. Per lo script del referto (`scripts/analyze-session.ts`) serve anche la chiave `service_role`:
   mettila solo nell'ambiente del terminale come `SUPABASE_SERVICE_ROLE_KEY`, **mai** nel repository né nell'app.

## Verifica
Dopo la prima registrazione di prova dal telefono, in **Table Editor → track_points** deve comparire almeno una riga.
