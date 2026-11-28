import { whatsappUrl } from '../friends/invite';

export const INVITE_BASE_URL = 'https://www.motoamiciapp.it/invito/';

export function buildGroupInviteMessage(a: { nickname: string; destination: string | null; code: string }): string {
  const where = a.destination ? ` verso ${a.destination}` : '';
  return (
    `Ciao! Sono ${a.nickname}, sto facendo un giro in moto${where} con MotoAmici. Unisciti a noi:\n` +
    `${INVITE_BASE_URL}${a.code}\n` +
    `Se il link non si apre, installa l'app e inserisci il codice ${a.code}.`
  );
}

export const groupInviteWhatsappUrl = (message: string): string => whatsappUrl(message);
