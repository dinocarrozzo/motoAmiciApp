import { recordError, recordSent, resetStats, stats } from './stats';

beforeEach(() => resetStats());

test('recordSent somma i punti inviati e segna l\'ora dell\'ultimo invio', () => {
  recordSent(4, 1000);
  recordSent(6, 2000);
  expect(stats.sent).toBe(10);
  expect(stats.lastSentAt).toBe(2000);
  expect(stats.lastError).toBeNull();
});

test('recordError conserva il messaggio, un invio riuscito lo cancella', () => {
  recordError('niente rete');
  expect(stats.lastError).toBe('niente rete');
  recordSent(1, 3000);
  expect(stats.lastError).toBeNull();
});

test('resetStats riporta tutto a zero (nuovo giro)', () => {
  recordSent(88, 5000);
  recordError('x');
  resetStats();
  expect(stats).toEqual({ sent: 0, lastSentAt: null, lastError: null });
});
