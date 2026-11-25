import { createAuthApi, type AuthClient } from './authApi';

type Err = { message: string; code?: string; status?: number } | null;

function fake(opts: { signUp?: Err; signIn?: Err; reset?: Err; signOut?: Err; session?: boolean; anonymous?: boolean } = {}) {
  const calls: Record<string, unknown[]> = {};
  const rec = (n: string, a: unknown) => (calls[n] = [...(calls[n] ?? []), a]);
  let listener: ((e: string, s: unknown) => void) | null = null;
  const client: AuthClient = {
    auth: {
      signUp: async (c) => (rec('signUp', c), { data: {}, error: opts.signUp ?? null }),
      signInWithPassword: async (c) => (rec('signIn', c), { data: {}, error: opts.signIn ?? null }),
      signOut: async () => ({ error: opts.signOut ?? null }),
      resetPasswordForEmail: async (e) => (rec('reset', e), { data: {}, error: opts.reset ?? null }),
      getSession: async () => ({ data: { session: opts.session ? { user: { is_anonymous: opts.anonymous === true } } : null } }),
      onAuthStateChange: (cb) => {
        listener = cb;
        return { data: { subscription: { unsubscribe: () => rec('unsub', 1) } } };
      },
    },
  };
  return { client, calls, emit: (e: string, s: unknown) => listener!(e, s) };
}

test('signUp pulisce l\'email (minuscola, senza spazi) e passa la password', async () => {
  const { client, calls } = fake();
  await createAuthApi(client).signUp('  Mario@Esempio.IT ', 'password1');
  expect(calls.signUp).toEqual([{ email: 'mario@esempio.it', password: 'password1' }]);
});
test('signUp con email già registrata → «Email già registrata»', async () => {
  const { client } = fake({ signUp: { message: 'User already registered', code: 'user_already_exists', status: 422 } });
  await expect(createAuthApi(client).signUp('a@b.it', 'password1')).rejects.toThrow('Email già registrata');
});
test('signIn con credenziali sbagliate → «Credenziali non valide»', async () => {
  const { client } = fake({ signIn: { message: 'Invalid login credentials', code: 'invalid_credentials', status: 400 } });
  await expect(createAuthApi(client).signIn('a@b.it', 'x')).rejects.toThrow('Credenziali non valide');
});
test('troppe richieste (limite email) → messaggio chiaro', async () => {
  const { client } = fake({ reset: { message: 'email rate limit exceeded', code: 'over_email_send_rate_limit', status: 429 } });
  await expect(createAuthApi(client).sendPasswordReset('a@b.it')).rejects.toThrow('Troppe richieste');
});
test('un errore sconosciuto mantiene il testo originale', async () => {
  const { client } = fake({ signIn: { message: 'boom' } });
  await expect(createAuthApi(client).signIn('a@b.it', 'x')).rejects.toThrow('boom');
});
test('sendPasswordReset passa l\'email pulita', async () => {
  const { client, calls } = fake();
  await createAuthApi(client).sendPasswordReset(' A@B.it ');
  expect(calls.reset).toEqual(['a@b.it']);
});
test('getSession è true solo con una sessione', async () => {
  expect(await createAuthApi(fake({ session: true }).client).getSession()).toBe(true);
  expect(await createAuthApi(fake({ session: false }).client).getSession()).toBe(false);
});
test('onSessionChange inoltra true/false e restituisce la funzione per disiscriversi', () => {
  const { client, emit, calls } = fake();
  const seen: boolean[] = [];
  const off = createAuthApi(client).onSessionChange((v) => seen.push(v));
  emit('SIGNED_IN', {});
  emit('SIGNED_OUT', null);
  off();
  expect(seen).toEqual([true, false]);
  expect(calls.unsub).toEqual([1]);
});
test('signOut con errore lo rilancia', async () => {
  const { client } = fake({ signOut: { message: 'rete assente' } });
  await expect(createAuthApi(client).signOut()).rejects.toThrow('rete assente');
});

test('una sessione anonima delle versioni di prova non conta come accesso', async () => {
  expect(await createAuthApi(fake({ session: true, anonymous: true }).client).getSession()).toBe(false);
});
test('onSessionChange: una sessione anonima vale «non connesso»', () => {
  const { client, emit } = fake();
  const seen: boolean[] = [];
  createAuthApi(client).onSessionChange((v) => seen.push(v));
  emit('INITIAL_SESSION', { user: { is_anonymous: true } });
  emit('SIGNED_IN', { user: { is_anonymous: false } });
  expect(seen).toEqual([false, true]);
});
