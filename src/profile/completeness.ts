import type { Profile } from './types';

/**
 * Un profilo è completo quando c'è e ha il tipo di moto. Il sesso ha sempre un valore
 * («preferisco non dirlo» è una scelta valida), quindi conta solo la moto: è anche ciò che
 * ferma gli account creati prima che questi dati fossero obbligatori.
 */
export function isProfileComplete(p: Profile | null | undefined): boolean {
  return !!p && p.bikeType !== null;
}
