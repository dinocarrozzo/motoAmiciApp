import { bboxFromBounds, clampBox, movedEnough } from './bbox';

const box = (a: number, b: number, c: number, d: number) => ({ minLat: a, minLng: b, maxLat: c, maxLng: d });

test('bboxFromBounds usa [ovest, sud, est, nord]', () => {
  expect(bboxFromBounds([9, 45, 10, 46])).toEqual(box(45, 9, 46, 10));
});
test('clampBox riduce una zona di 3° a 1° attorno al centro', () => {
  const r = clampBox(box(40, 8, 43, 11));
  expect(r.maxLat - r.minLat).toBeCloseTo(1);
  expect(r.maxLng - r.minLng).toBeCloseTo(1);
  expect((r.minLat + r.maxLat) / 2).toBeCloseTo(41.5);
  expect((r.minLng + r.maxLng) / 2).toBeCloseTo(9.5);
});
test('clampBox lascia invariata una zona piccola', () => {
  const b = box(45, 9, 45.2, 9.2);
  expect(clampBox(b)).toEqual(b);
});
test('movedEnough', () => {
  const a = box(45, 9, 45.2, 9.2);
  expect(movedEnough(null, a)).toBe(true);
  expect(movedEnough(a, box(45.02, 9.02, 45.22, 9.22))).toBe(false);
  expect(movedEnough(a, box(45.08, 9.08, 45.28, 9.28))).toBe(true);
  expect(movedEnough(a, box(44.9, 8.9, 45.3, 9.3))).toBe(true);
});
