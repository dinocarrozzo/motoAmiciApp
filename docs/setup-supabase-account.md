# Accesso al progetto Supabase per le migrazioni

Servono perché l'editor SQL di Supabase sul telefono rovina il testo incollato.

## Passi dell'utente (una volta)
1. In Supabase: profilo in alto a destra → **Account Preferences → Access Tokens → Generate new token** (inizia con `sbp_`).
2. Darlo alla sessione di Claude con il modulo sicuro per l'host `api.supabase.com`. A fine lavoro si può revocare dalla stessa pagina.

## Cosa si fa con il token (dal container)
- Leggere e cambiare le impostazioni di Auth: `GET/PATCH https://api.supabase.com/v1/projects/<ref>/config/auth`.
- Eseguire SQL: `POST https://api.supabase.com/v1/projects/<ref>/database/query` con `{"query": "..."}`.
- Con la credenziale salvata si usa `Authorization: Bearer proxy-injected` (il proxy mette il valore vero).

## Impostazioni applicate al progetto `motoamici` (ref `uqymtqlcotuhudshwszf`)
- Conferma email **spenta** (`mailer_autoconfirm: true`) durante lo sviluppo: il servizio email gratuito invia solo 2 messaggi l'ora. Da riaccendere prima della pubblicazione, con un servizio di invio email vero.
- Password minima 8 caratteri (`password_min_length: 8`).
- Accesso anonimo: resta attivo finché esistono le versioni di prova che lo usano; si spegne con la build di account (Task 8).
