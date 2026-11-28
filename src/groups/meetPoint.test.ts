import { isMeetPointFresh } from './meetPoint';

const NOW = 1_000_000_000_000;
test('entro 24 ore', () => {
  expect(isMeetPointFresh(NOW - 23 * 3_600_000, NOW)).toBe(true);
});
test('oltre 24 ore o senza data', () => {
  expect(isMeetPointFresh(NOW - 25 * 3_600_000, NOW)).toBe(false);
  expect(isMeetPointFresh(null, NOW)).toBe(false);
});
