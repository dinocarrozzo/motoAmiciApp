import { ridersToGeoJSON, FRIEND_RING_COLOR } from './geojson';
import type { Rider } from './types';

const r = (o: Partial<Rider>): Rider => ({ id: 'a', nickname: 'a', avatar: 'moto', gender: 'f', lat: 45, lng: 9, exact: true, isFriend: false, recordedAt: 0, rideType: null, bikeType: null, destination: null, ...o });

test('coordinate in ordine [lng, lat] e id nelle proprietà', () => {
  const g = ridersToGeoJSON([r({ id: 'x', lat: 45.5, lng: 9.2 })]);
  expect(g.type).toBe('FeatureCollection');
  expect(g.features[0].geometry).toEqual({ type: 'Point', coordinates: [9.2, 45.5] });
  expect(g.features[0].properties?.id).toBe('x');
});
test('colore dal sesso, anello giallo solo per gli amici', () => {
  const g = ridersToGeoJSON([r({ gender: 'm' }), r({ id: 'b', gender: 'f', isFriend: true })]);
  expect(g.features[0].properties).toMatchObject({ color: '#0ea5e9', ring: '#ffffff' });
  expect(g.features[1].properties).toMatchObject({ color: '#ec4899', ring: FRIEND_RING_COLOR });
});
test('nessuno → collezione vuota', () => {
  expect(ridersToGeoJSON([]).features).toEqual([]);
});
import { sameRiders } from './geojson';
test('sameRiders', () => {
  expect(sameRiders([r({})], [r({})])).toBe(true);
  expect(sameRiders([r({})], [r({ lat: 46 })])).toBe(false);
});
