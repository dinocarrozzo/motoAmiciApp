import { fetchWithTimeout } from './fetchWithTimeout';

test('una richiesta che non risponde viene annullata allo scadere del tempo', async () => {
  jest.useFakeTimers();
  try {
    let sawSignal: AbortSignal | undefined;
    const base = (_input: any, init?: any) =>
      new Promise<Response>((_, reject) => {
        sawSignal = init.signal;
        init.signal.addEventListener('abort', () => reject(new Error('annullata')));
      });
    const f = fetchWithTimeout(15_000, base as any);
    const result = f('https://esempio.test').catch((e: Error) => e.message);
    await jest.advanceTimersByTimeAsync(15_000);
    expect(await result).toBe('annullata');
    expect(sawSignal?.aborted).toBe(true);
  } finally {
    jest.useRealTimers();
  }
});

test('una richiesta che risponde in tempo passa il risultato e non viene annullata', async () => {
  const ok = { ok: true } as Response;
  let sawSignal: AbortSignal | undefined;
  const base = async (_input: any, init?: any) => {
    sawSignal = init.signal;
    return ok;
  };
  const res = await fetchWithTimeout(15_000, base as any)('https://esempio.test');
  expect(res).toBe(ok);
  expect(sawSignal?.aborted).toBe(false);
});
