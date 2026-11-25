/** Testo dell'invito. Il link per scaricare l'app si aggiunge quando l'app sarà negli store. */
export function buildInviteMessage(nickname: string, link: string | null): string {
  const base = `Ciao! Uso MotoAmici per trovare compagni di giro in moto. Cercami: il mio nickname è ${nickname}.`;
  return link ? `${base}\nScarica l'app qui: ${link}` : base;
}

/** Apre WhatsApp con il testo già scritto (l'invio resta all'utente). */
export const whatsappUrl = (text: string): string => `https://wa.me/?text=${encodeURIComponent(text)}`;

/** Da impostare con il vero indirizzo di download quando l'app è pubblicata. */
export const APP_DOWNLOAD_LINK: string | null = null;
