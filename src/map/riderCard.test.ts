import { describeRider, markerColor } from './riderCard';
import type { Rider } from './types';

const base: Rider = {
  id: '1', nickname: 'Marco', avatar: 'moto', gender: 'm', lat: 45, lng: 9, exact: true, isFriend: true,
  recordedAt: 1_000_000, rideType: null, bikeType: null, destination: null, groupId: null, memberCount: null,
};

test('colori', () => {
  expect(markerColor('m')).toBe('#0ea5e9');
  expect(markerColor('f')).toBe('#ec4899');
  expect(markerColor('x')).toBe('#8b5cf6');
});
test('non amico approssimato', () => {
  const d = describeRider({ ...base, exact: false, isFriend: false }, 1_020_000);
  expect(d.lines.join('|')).toContain('Posizione approssimata');
  expect(d.friendTag).toBe(false);
});
test('amico esatto', () => {
  const d = describeRider(base, 1_020_000);
  expect(d.friendTag).toBe(true);
  expect(d.lines.join('|')).not.toContain('approssimata');
  expect(d.title).toBe('Marco');
});
test('senza dati: suggerimento premium', () => {
  const d = describeRider(base, 1_020_000);
  expect(d.premiumHint).toBe(true);
  expect(d.lines.join('|')).not.toContain('Passeggiata');
});
test('con dati', () => {
  const d = describeRider({ ...base, rideType: 'passeggiata-veloce', bikeType: 'naked', destination: 'Lago' }, 1_020_000);
  expect(d.premiumHint).toBe(false);
  const t = d.lines.join('|');
  expect(t).toContain('Passeggiata veloce');
  expect(t).toContain('Naked');
  expect(t).toContain('Lago');
});
test('età', () => {
  expect(describeRider(base, 1_020_000).lines.join('|')).toContain('Aggiornato 20 s fa');
  expect(describeRider(base, 1_090_000).lines.join('|')).toContain('Aggiornato 1 min fa');
});
