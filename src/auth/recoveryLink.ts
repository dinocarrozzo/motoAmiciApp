/** Dove Supabase riporta l'utente dopo aver toccato il link nell'email di recupero password. */
export const RESET_REDIRECT = 'motoamici://reset-password';

export type RecoveryLink =
  | { kind: 'ok'; accessToken: string; refreshToken: string }
  | { kind: 'error'; message: string };

function decode(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

function parseParams(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of s.split('&')) {
    if (!part) continue;
    const i = part.indexOf('=');
    const key = decode(i < 0 ? part : part.slice(0, i));
    out[key] = i < 0 ? '' : decode(part.slice(i + 1));
  }
  return out;
}

/** Legge il link di recupero. I dati arrivano dopo il # (o il ?). Restituisce null se non è un link di recupero. */
export function parseRecoveryUrl(url: string): RecoveryLink | null {
  if (!url.startsWith(RESET_REDIRECT)) return null;
  const rest = url.slice(RESET_REDIRECT.length);
  if (rest && !/^[\/#?]/.test(rest)) return null;
  const params = parseParams(rest.replace(/^\/?[#?]?/, ''));
  if (params.error || params.error_code) {
    return { kind: 'error', message: 'Il link è scaduto o non è valido: richiedine uno nuovo' };
  }
  if (params.type !== 'recovery' || !params.access_token || !params.refresh_token) return null;
  return { kind: 'ok', accessToken: params.access_token, refreshToken: params.refresh_token };
}
