import { createProfilesApi, type DbClient } from './profilesApi';

type Res = { data?: any; error?: { message: string; code?: string } | null };

function fake(opts: { session?: boolean; row?: any; rpc?: Res; upsert?: Res } = {}) {
  const calls: { upserts: any[]; selects: any[]; rpcs: any[]; deletes: any[] } = { upserts: [], selects: [], rpcs: [], deletes: [] };
  const client: DbClient = {
    auth: { getSession: async () => ({ data: { session: opts.session === false ? null : { user: { id: 'me' } } } }) },
    from: (table: string) => ({
      select: (cols: string) => ({
        eq: (col: string, val: string) => ({
          maybeSingle: async () => {
            calls.selects.push({ table, cols, col, val });
            return { data: opts.row ?? null, error: null };
          },
        }),
      }),
      upsert: async (row: any) => {
        calls.upserts.push({ table, row });
        return { error: opts.upsert?.error ?? null };
      },
      delete: () => ({
        eq: async (col: string, val: string) => {
          calls.deletes.push({ table, col, val });
          return { error: null };
        },
      }),
    }),
    rpc: async (fn: string, args?: any) => {
      calls.rpcs.push({ fn, args });
      return { data: opts.rpc?.data ?? null, error: opts.rpc?.error ?? null };
    },
  };
  return { client, calls };
}

const row = { id: 'me', nickname: 'Mario', display_name: 'Mario Rossi', gender: 'm', avatar: 'volpe', bike_type: 'naked' };

test('getMyProfile senza riga → null', async () => {
  const { client } = fake();
  expect(await createProfilesApi(client).getMyProfile()).toBeNull();
});
test('getMyProfile converte i nomi del database in quelli dell\'app', async () => {
  const { client, calls } = fake({ row });
  expect(await createProfilesApi(client).getMyProfile()).toEqual({
    id: 'me', nickname: 'Mario', displayName: 'Mario Rossi', gender: 'm', avatar: 'volpe', bikeType: 'naked',
  });
  expect(calls.selects[0]).toMatchObject({ table: 'profiles', col: 'id', val: 'me' });
});
test('getMyProfile senza sessione → «Accedi per continuare»', async () => {
  const { client } = fake({ session: false });
  await expect(createProfilesApi(client).getMyProfile()).rejects.toThrow('Accedi per continuare');
});
test('saveProfile scrive con l\'id della sessione e i nomi del database', async () => {
  const { client, calls } = fake();
  await createProfilesApi(client).saveProfile({ nickname: 'Mario', displayName: null, gender: 'm', avatar: 'volpe', bikeType: null });
  expect(calls.upserts[0]).toEqual({
    table: 'profiles',
    row: { id: 'me', nickname: 'Mario', display_name: null, gender: 'm', avatar: 'volpe', bike_type: null },
  });
});
test('saveProfile con nickname già preso (violazione di unicità) → «Nickname già in uso»', async () => {
  const { client } = fake({ upsert: { error: { message: 'duplicate key', code: '23505' } } });
  await expect(
    createProfilesApi(client).saveProfile({ nickname: 'Mario', displayName: null, gender: 'x', avatar: 'moto', bikeType: null }),
  ).rejects.toThrow('Nickname già in uso');
});
test('isNicknameAvailable chiede al server il nickname pulito e restituisce il booleano', async () => {
  const { client, calls } = fake({ rpc: { data: true } });
  expect(await createProfilesApi(client).isNicknameAvailable('  Mario ')).toBe(true);
  expect(calls.rpcs[0]).toEqual({ fn: 'nickname_available', args: { n: 'Mario' } });
});
test('contatto fidato: lettura e scrittura sulla tabella giusta', async () => {
  const f1 = fake({ row: { name: 'Anna', phone: '+393331234567' } });
  expect(await createProfilesApi(f1.client).getEmergencyContact()).toEqual({ name: 'Anna', phone: '+393331234567' });
  expect(f1.calls.selects[0]).toMatchObject({ table: 'emergency_contacts', col: 'user_id', val: 'me' });
  const f2 = fake();
  await createProfilesApi(f2.client).saveEmergencyContact({ name: 'Anna', phone: '+393331234567' });
  expect(f2.calls.upserts[0]).toEqual({ table: 'emergency_contacts', row: { user_id: 'me', name: 'Anna', phone: '+393331234567' } });
});
test('contatto fidato assente → null', async () => {
  expect(await createProfilesApi(fake().client).getEmergencyContact()).toBeNull();
});

test('clearEmergencyContact cancella la riga del proprietario', async () => {
  const { client, calls } = fake();
  await createProfilesApi(client).clearEmergencyContact();
  expect(calls.deletes).toEqual([{ table: 'emergency_contacts', col: 'user_id', val: 'me' }]);
});
