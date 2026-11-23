# Configurare Supabase per il prototipo (guida passo passo)

Le schermate di Supabase cambiano ogni tanto: se un nome è leggermente diverso, cerca la voce più simile.

## 1. Crea il progetto
1. Vai su https://supabase.com/dashboard e accedi.
2. **New project** → nome `motoamici`, scegli una **password del database** (conservala, ma l'app non la usa), regione **Europa** (es. Frankfurt), piano **Free**.
3. Attendi un paio di minuti finché il progetto è pronto.

## 2. Attiva l'accesso anonimo
1. Nel menu a sinistra apri **Authentication**.
2. Sotto **Configuration** scegli **Sign In / Providers**.
3. Scorri fino alla sezione **User Signups**.
4. Attiva **Allow anonymous sign-ins** e premi **Save changes**.

(Nelle versioni più vecchie sta in Authentication → Providers → **Anonymous Sign-Ins**. Se non lo trovi, usa la ricerca del pannello e cerca "anonymous".)

## 3. Crea la tabella
1. Menu a sinistra → **SQL Editor** → **New query**.
2. Incolla tutto il contenuto di `supabase/migrations/0001_track_points.sql` e premi **Run**.
3. Deve comparire "Success. No rows returned".
4. Controlla in **Table Editor** che esista la tabella `track_points`.

## 4. Copia URL e chiave
1. Icona a forma di ingranaggio → **Project Settings** → **API Keys** (in alcune versioni: **API**).
2. Copia l'**URL del progetto** (forma `https://xxxx.supabase.co`).
3. Copia la chiave **anon** (nella scheda "Legacy API Keys") oppure la **Publishable key**: va bene una delle due.
4. **Non** usare né condividere la chiave `service_role`: serve solo allo script del referto e resta solo sul tuo computer.

Non incollare le chiavi in chat né nel repository: Claude te le chiede con un modulo sicuro.

## 5. Verifica (dopo la prima prova dal telefono)
In **Table Editor → track_points** deve comparire almeno una riga.

## Nota sul piano gratuito
Un progetto gratuito senza attività per circa una settimana viene messo in pausa: dal pannello si riattiva con un clic. Non perde i dati.
