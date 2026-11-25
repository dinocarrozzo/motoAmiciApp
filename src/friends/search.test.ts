import { debounce, normalizeQuery } from './search';

describe('normalizeQuery', () => {
  test('toglie gli spazi ai lati', () => expect(normalizeQuery(' ma ')).toBe('ma'));
  test('riduce gli spazi multipli', () => expect(normalizeQuery('mario   rossi')).toBe('mario rossi'));
  test('sotto i 2 caratteri → null', () => {
    expect(normalizeQuery('m')).toBeNull();
    expect(normalizeQuery('')).toBeNull();
    expect(normalizeQuery('   ')).toBeNull();
  });
  test('rimuove % _ e \\ (caratteri jolly)', () => {
    expect(normalizeQuery('a%_b')).toBe('ab');
    expect(normalizeQuery('a\\b')).toBe('ab');
  });
  test('solo caratteri speciali → null', () => expect(normalizeQuery('%_%')).toBeNull());
});

describe('debounce', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('tre chiamate in 100 ms → una sola esecuzione, con gli argomenti dell\'ultima', () => {
    const fn = jest.fn();
    const d = debounce(fn, 300);
    d('m');
    jest.advanceTimersByTime(50);
    d('ma');
    jest.advanceTimersByTime(50);
    d('mar');
    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('mar');
  });
  test('due chiamate distanziate oltre il ritardo → due esecuzioni', () => {
    const fn = jest.fn();
    const d = debounce(fn, 100);
    d('a');
    jest.advanceTimersByTime(150);
    d('b');
    jest.advanceTimersByTime(150);
    expect(fn.mock.calls).toEqual([['a'], ['b']]);
  });
});
