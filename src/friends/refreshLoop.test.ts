import { createRefreshLoop } from './refreshLoop';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

function setup(refresh: () => Promise<void> = async () => undefined) {
  const fn = jest.fn(refresh);
  const loop = createRefreshLoop({ refresh: fn, intervalMs: 20_000 });
  return { fn, loop };
}

test('attivandolo aggiorna subito, poi ogni intervallo', async () => {
  const { fn, loop } = setup();
  loop.setActive(true);
  expect(fn).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(20_000);
  expect(fn).toHaveBeenCalledTimes(2);
  await jest.advanceTimersByTimeAsync(40_000);
  expect(fn).toHaveBeenCalledTimes(4);
  loop.dispose();
});

test('disattivandolo non aggiorna più', async () => {
  const { fn, loop } = setup();
  loop.setActive(true);
  loop.setActive(false);
  const before = fn.mock.calls.length;
  await jest.advanceTimersByTimeAsync(120_000);
  expect(fn).toHaveBeenCalledTimes(before);
});

test('attivarlo due volte non crea due timer', async () => {
  const { fn, loop } = setup();
  loop.setActive(true);
  loop.setActive(true);
  expect(fn).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(20_000);
  expect(fn).toHaveBeenCalledTimes(2);
  loop.dispose();
});

test('se un aggiornamento è ancora in corso, il giro successivo viene saltato', async () => {
  let release!: () => void;
  const { fn, loop } = setup(() => new Promise<void>((r) => (release = r)));
  loop.setActive(true);
  await jest.advanceTimersByTimeAsync(60_000); // tre giri, ma il primo non è finito
  expect(fn).toHaveBeenCalledTimes(1);
  release();
  await jest.advanceTimersByTimeAsync(20_000);
  expect(fn).toHaveBeenCalledTimes(2);
  loop.dispose();
});

test('un errore di rete non ferma gli aggiornamenti successivi', async () => {
  let n = 0;
  const { fn, loop } = setup(async () => {
    n += 1;
    if (n === 1) throw new Error('rete assente');
  });
  loop.setActive(true);
  await jest.advanceTimersByTimeAsync(20_000);
  expect(fn).toHaveBeenCalledTimes(2);
  loop.dispose();
});

test('riattivandolo dopo una pausa aggiorna subito', async () => {
  const { fn, loop } = setup();
  loop.setActive(true);
  loop.setActive(false);
  await jest.advanceTimersByTimeAsync(300_000);
  loop.setActive(true);
  expect(fn).toHaveBeenCalledTimes(2);
  loop.dispose();
});

test('dopo dispose() non parte più niente, nemmeno riattivandolo', async () => {
  const { fn, loop } = setup();
  loop.setActive(true);
  loop.dispose();
  loop.setActive(true);
  await jest.advanceTimersByTimeAsync(120_000);
  expect(fn).toHaveBeenCalledTimes(1);
});
