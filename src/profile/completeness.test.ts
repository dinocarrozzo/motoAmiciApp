import { isProfileComplete } from './completeness';
import type { Profile } from './types';

const p: Profile = { id: 'u1', nickname: 'mario', displayName: null, gender: 'm', avatar: 'moto', bikeType: 'naked' };

test('nessun profilo → incompleto', () => expect(isProfileComplete(null)).toBe(false));
test('profilo senza tipo di moto → incompleto (anche per gli account già creati)', () => {
  expect(isProfileComplete({ ...p, bikeType: null })).toBe(false);
});
test('profilo con la moto indicata → completo', () => expect(isProfileComplete(p)).toBe(true));
test('«preferisco non dirlo» come sesso non rende il profilo incompleto', () => {
  expect(isProfileComplete({ ...p, gender: 'x' })).toBe(true);
});
