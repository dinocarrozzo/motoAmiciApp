# Avvisi push e link d'invito (piano B) — Progetto

Data: 2026-11-28 · Stato: **approvato dall'utente (design a voce, "ok va bene… procedi")** · Si appoggia su `2026-11-28-giri-di-gruppo-design.md` e sulla sezione 11 del progetto principale.

## 1. Perché
Chi guida ha il telefono sulla staffa con il navigatore aperto e gli auricolari: la nostra app è **in secondo piano**. Gli avvisi (richiesta di unirsi, risposta, invito) devono comparire sopra il navigatore, con suono e vibrazione, anche a schermo bloccato. Lo stesso meccanismo servirà all'emergenza.

## 2. Cosa si fa
- **Notifiche push Android** (Firebase Cloud Messaging tramite il servizio push di Expo). Banner in alto («heads-up») con suono e vibrazione; canali separati: `richieste` (importanza alta) ed `emergenza` (importanza massima, creato ora, usato dal passo emergenza).
- **Bottoni sul popup** «Accetta» / «Rifiuta» per le richieste di unirsi, senza aprire l'app (l'app è viva mentre si guida grazie al servizio in primo piano; se non lo è, il tocco sul corpo della notifica apre l'app sulla richiesta).
- **Chi riceve cosa:** richiesta di unirsi → tutti i membri attivi del gruppo; risposta (accettata/rifiutata) → il richiedente; invito a un amico → l'invitato. Testi brevissimi, in italiano.
- **Link d'invito** `https://www.motoamiciapp.it/invito/<codice>`: se l'app è installata si apre direttamente (collegamento verificato di Android) e propone di entrare nel gruppo; se non lo è, una pagina sul sito del cliente (Tophost) offre il download dell'APK di prova (poi gli store).
- **Icone vere** al posto delle emoji nella barra delle schede; controllo delle 20 emoji degli avatar (si tengono solo quelle supportate dai telefoni di qualche anno fa).

## 3. Non-obiettivi
iPhone (servono account Apple e permessi dedicati); lettura a voce degli avvisi; schermo a tutto schermo sopra altre app; schermo che lampeggia (Android lo consente solo ad app di chiamate e sveglie); impostazioni di silenziamento (si rimandano).

## 4. Anti-obiettivi
Un avviso che arriva a chi non deve riceverlo (bloccati, non membri); un'azione dal popup che accetta la persona sbagliata; dati personali nel testo dell'avviso più di nickname e un'espressione breve; chiavi segrete nel repository.

## 5. Scelte tecniche (mie)
- Invio dal database con l'estensione `pg_net` che chiama l'API push di Expo; i trigger sulle tabelle già esistenti (`join_requests`, `group_members`) creano gli avvisi. Un token per telefono in `push_tokens`.
- Expo Notifications nell'app; chiave del servizio Firebase caricata dall'utente su Expo (mai nel repository); `google-services.json` nel repository (non è un segreto).
- Collegamento verificato: `assetlinks.json` sul sito con l'impronta della chiave di firma di EAS (aggiunta quella di Google Play alla pubblicazione).
