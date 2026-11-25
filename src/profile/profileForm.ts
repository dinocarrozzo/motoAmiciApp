import { isValidAvatar } from './avatars';
import type { BikeType, Gender, Profile } from './types';
import { normalizePhone, validateNickname } from './validation';

const BIKE_TYPES: BikeType[] = ['stradale-sportiva', 'custom', 'naked', 'enduro', 'maxienduro'];

export type ProfileForm = {
  nickname: string;
  displayName: string;
  gender: Gender | null;
  avatar: string;
  bikeType: BikeType | null;
  contactName: string;
  contactPhone: string;
};

export type ProfileFormResult = {
  ok: boolean;
  errors: Record<string, string>;
  value?: { profile: Omit<Profile, 'id'>; contact: { name: string; phone: string } | null };
};

export function validateProfileForm(f: ProfileForm): ProfileFormResult {
  const errors: Record<string, string> = {};

  const nickname = validateNickname(f.nickname);
  if (!nickname.ok) errors.nickname = nickname.error;

  const displayName = f.displayName.trim();
  if (displayName.length > 40) errors.displayName = 'Il nome può avere al massimo 40 caratteri';

  if (!isValidAvatar(f.avatar)) errors.avatar = 'Scegli un avatar';
  if (!f.gender) errors.gender = "Scegli un'opzione";
  if (f.bikeType === null) errors.bikeType = 'Scegli il tipo di moto';
  else if (!BIKE_TYPES.includes(f.bikeType)) errors.bikeType = 'Tipo di moto non valido';

  const contactName = f.contactName.trim();
  const contactPhone = f.contactPhone.trim();
  let contact: { name: string; phone: string } | null = null;
  if (contactName || contactPhone) {
    if (!contactName) errors.contactName = 'Inserisci anche il nome del contatto';
    else if (contactName.length > 60) errors.contactName = 'Il nome può avere al massimo 60 caratteri';
    if (!contactPhone) errors.contactPhone = 'Inserisci anche il numero di telefono';
    else {
      const phone = normalizePhone(contactPhone);
      if (!phone.ok) errors.contactPhone = phone.error;
      else if (!errors.contactName) contact = { name: contactName, phone: phone.value };
    }
  }

  if (Object.keys(errors).length > 0 || !nickname.ok || !f.gender) return { ok: false, errors };
  return {
    ok: true,
    errors: {},
    value: {
      profile: {
        nickname: nickname.value,
        displayName: displayName || null,
        gender: f.gender,
        avatar: f.avatar,
        bikeType: f.bikeType,
      },
      contact,
    },
  };
}
