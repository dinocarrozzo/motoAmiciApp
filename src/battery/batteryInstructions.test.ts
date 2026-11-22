import { batteryInstructions } from './batteryInstructions';

const standby = (steps: string[]) => steps.filter((s) => s.toLowerCase().includes('stand-by'));

test('Samsung e SAMSUNG danno lo stesso risultato, con almeno 2 passi su stand-by', () => {
  const a = batteryInstructions('Samsung');
  expect(batteryInstructions('SAMSUNG')).toEqual(a);
  expect(standby(a.steps).length).toBeGreaterThanOrEqual(2);
});

test.each(['Xiaomi', 'Redmi', 'POCO'])('%s: i passi citano "Avvio automatico"', (m) => {
  const r = batteryInstructions(m);
  expect(r.steps.some((s) => s.includes('Avvio automatico'))).toBe(true);
});

test('una marca sconosciuta dà i passi generici, diversi da Samsung e Xiaomi', () => {
  const g = batteryInstructions('Google');
  expect(g.steps.length).toBeGreaterThan(0);
  expect(g).not.toEqual(batteryInstructions('Samsung'));
  expect(g).not.toEqual(batteryInstructions('Xiaomi'));
});

test('stringa vuota non lancia e dà i passi generici', () => {
  expect(() => batteryInstructions('')).not.toThrow();
  expect(batteryInstructions('')).toEqual(batteryInstructions('Google'));
});
