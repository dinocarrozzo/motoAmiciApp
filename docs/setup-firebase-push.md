# Firebase per le notifiche (guida passo passo)

Serve un progetto Firebase gratuito. Non mandarmi mai la chiave privata (punto 6): la carichi tu su Expo.

1. Vai su https://console.firebase.google.com e accedi con un account Google (meglio uno tuo, non personale di lavoro).
2. **Aggiungi progetto** → nome `MotoAmici` → disattiva Google Analytics (non serve) → Crea.
3. Nella pagina del progetto tocca l'icona Android («Aggiungi app»). **Nome pacchetto Android: `it.motoamici.prototype`** (esatto). Soprannome facoltativo. Registra l'app.
4. Scarica **`google-services.json`** e mandamelo (nella chat va bene: non è un segreto; contiene solo identificativi del progetto).
5. Salta i passaggi successivi dell'installazione di Firebase (li faccio io) e chiudi.
6. Chiave per Expo: ingranaggio ⚙ → *Impostazioni progetto* → scheda **Account di servizio** → **Genera nuova chiave privata** → scarica il file `.json`. **Questo file è un segreto: non incollarlo in chat e non metterlo nel repository.**
7. Carica quel file su Expo: https://expo.dev → progetto `motoamici-gps-prova` → **Credentials** → Android → `it.motoamici.prototype` → **FCM V1 service account key** → *Add a service account key* → carica il file. (Se non trovi la voce, dimmelo: la schermata cambia spesso.)
8. Quando hai finito, dimmi «Firebase fatto» (e allega `google-services.json`).

Dopo, puoi eliminare il file della chiave dal tuo computer.
