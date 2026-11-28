const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const PATTERN = new RegExp(`^[${ALPHABET}]{6}$`);

/** Pulisce un codice d'invito scritto a mano; null se non può essere valido. */
export function normalizeInviteCode(input: string): string | null {
  const c = (input ?? '').replace(/[\s-]/g, '').toUpperCase();
  return PATTERN.test(c) ? c : null;
}
