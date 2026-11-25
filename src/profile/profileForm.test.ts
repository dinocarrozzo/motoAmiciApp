import { validateProfileForm, type ProfileForm } from './profileForm';

const base: ProfileForm = {
  nickname: 'Mario_88',
  displayName: '',
  gender: 'm',
  avatar: 'volpe',
  bikeType: 'naked',
  contactName: '',
  contactPhone: '',
};

test('modulo corretto, senza contatto → ok, contact null, nome vuoto → null', () => {
  const r = validateProfileForm(base);
  expect(r.ok).toBe(true);
  expect(r.value).toEqual({
    profile: { nickname: 'Mario_88', displayName: null, gender: 'm', avatar: 'volpe', bikeType: 'naked' },
    contact: null,
  });
});
test('nome del contatto senza telefono → errore sul telefono', () => {
  const r = validateProfileForm({ ...base, contactName: 'Anna' });
  expect(r.ok).toBe(false);
  expect(r.errors.contactPhone).toBeTruthy();
  expect(r.errors.contactName).toBeUndefined();
});
test('telefono senza nome del contatto → errore sul nome', () => {
  const r = validateProfileForm({ ...base, contactPhone: '333 123 4567' });
  expect(r.ok).toBe(false);
  expect(r.errors.contactName).toBeTruthy();
});
test('contatto con numero scritto con spazi → salvato in formato internazionale', () => {
  const r = validateProfileForm({ ...base, contactName: ' Anna ', contactPhone: '333 123 4567' });
  expect(r.value?.contact).toEqual({ name: 'Anna', phone: '+393331234567' });
});
test('numero non valido → errore sul telefono', () => {
  expect(validateProfileForm({ ...base, contactName: 'Anna', contactPhone: '12' }).errors.contactPhone).toBeTruthy();
});
test('solo spazi nei campi del contatto contano come vuoti', () => {
  const r = validateProfileForm({ ...base, contactName: '   ', contactPhone: '  ' });
  expect(r.ok).toBe(true);
  expect(r.value?.contact).toBeNull();
});
test('avatar inesistente → errore', () => {
  expect(validateProfileForm({ ...base, avatar: 'inesistente' }).errors.avatar).toBeTruthy();
});
test('sesso non scelto (null) → x, cioè «non indicato»', () => {
  expect(validateProfileForm({ ...base, gender: null }).value?.profile.gender).toBe('x');
});
test('tipo di moto sconosciuto → errore; assente → null', () => {
  expect(validateProfileForm({ ...base, bikeType: 'monopattino' as any }).errors.bikeType).toBeTruthy();
  expect(validateProfileForm({ ...base, bikeType: null }).value?.profile.bikeType).toBeNull();
});
test('nickname non valido → errore sul nickname', () => {
  expect(validateProfileForm({ ...base, nickname: 'a b' }).errors.nickname).toBeTruthy();
});
test('nome oltre 40 caratteri → errore', () => {
  expect(validateProfileForm({ ...base, displayName: 'x'.repeat(41) }).errors.displayName).toBeTruthy();
});
test('nome con spazi ai lati → pulito', () => {
  expect(validateProfileForm({ ...base, displayName: '  Mario Rossi ' }).value?.profile.displayName).toBe('Mario Rossi');
});
