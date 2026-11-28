import { isMeetPointFresh } from './meetPoint';

const NOW = 1_000_000_000_000;
test('entro 24 ore', () => {
  expect(isMeetPointFresh(NOW - 23 * 3_600_000, NOW)).toBe(true);
});
test('oltre 24 ore o senza data', () => {
  expect(isMeetPointFresh(NOW - 25 * 3_600_000, NOW)).toBe(false);
  expect(isMeetPointFresh(null, NOW)).toBe(false);
});

import { mapsDirectionsUrl } from './meetPoint';
test('link a Google Maps con le indicazioni verso il punto', () => {
  expect(mapsDirectionsUrl({ lat: 40.35, lng: 18.17 })).toBe('https://www.google.com/maps/dir/?api=1&destination=40.35,18.17');
});
test('le coordinate non vengono arrotondate male', () => {
  expect(mapsDirectionsUrl({ lat: -33.8688, lng: 151.2093 })).toContain('destination=-33.8688,151.2093');
});
