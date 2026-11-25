import type { BikeType, Gender } from './types';

type Result = { ok: true; value: string } | { ok: false; error: string };

export function validateNickname(s: string): Result {
  const v = s.trim();
  if (v.length < 3) return { ok: false, error: 'Il nickname deve avere almeno 3 caratteri' };
  if (v.length > 20) return { ok: false, error: 'Il nickname può avere al massimo 20 caratteri' };
  if (!/^[A-Za-z0-9._-]+$/.test(v)) {
    return { ok: false, error: 'Usa solo lettere, numeri, punto, trattino e trattino basso' };
  }
  return { ok: true, value: v };
}

export function validatePassword(s: string): Result {
  if (s.length < 8) return { ok: false, error: 'La password deve avere almeno 8 caratteri' };
  return { ok: true, value: s };
}

export function validateEmail(s: string): Result {
  const v = s.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { ok: false, error: 'Email non valida' };
  return { ok: true, value: v };
}

export type RegistrationInput = {
  email: string;
  password: string;
  nickname: string;
  isAdult: boolean;
  acceptedPrivacy: boolean;
  gender: Gender | null;
  bikeType: BikeType | null;
};
type Field = 'email' | 'password' | 'nickname' | 'isAdult' | 'acceptedPrivacy' | 'gender' | 'bikeType';

export function validateRegistration(i: RegistrationInput): { ok: boolean; errors: Partial<Record<Field, string>> } {
  const errors: Partial<Record<Field, string>> = {};
  const email = validateEmail(i.email);
  if (!email.ok) errors.email = email.error;
  const password = validatePassword(i.password);
  if (!password.ok) errors.password = password.error;
  const nickname = validateNickname(i.nickname);
  if (!nickname.ok) errors.nickname = nickname.error;
  if (!i.isAdult) errors.isAdult = 'Devi avere almeno 18 anni';
  if (!i.acceptedPrivacy) errors.acceptedPrivacy = "Devi accettare l'informativa";
  if (!i.gender) errors.gender = "Scegli un'opzione";
  if (!i.bikeType) errors.bikeType = 'Scegli il tipo di moto';
  return { ok: Object.keys(errors).length === 0, errors };
}

/** Numero in formato internazionale (E.164). Senza prefisso si assume l'Italia (+39). */
export function normalizePhone(s: string): Result {
  let v = s.replace(/[\s().-]/g, '');
  if (v.startsWith('00')) v = '+' + v.slice(2);
  if (v.startsWith('+')) {
    if (/^\+\d{8,15}$/.test(v)) return { ok: true, value: v };
  } else if (/^3\d{8,9}$/.test(v)) {
    return { ok: true, value: '+39' + v };
  }
  return { ok: false, error: 'Numero di telefono non valido' };
}
