import type { BikeType, Gender, Profile } from '../profile/types';

type DbError = { message: string; code?: string } | null;

/** La parte del client Supabase che ci serve per i profili (permette un client finto nei test). */
export interface DbClient {
  auth: { getSession(): PromiseLike<{ data: { session: { user: { id: string } } | null } }> };
  from(table: string): {
    select(cols: string): {
      eq(col: string, val: string): { maybeSingle(): PromiseLike<{ data: any | null; error: DbError }> };
    };
    upsert(row: Record<string, unknown>): PromiseLike<{ error: DbError }>;
  };
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: any; error: DbError }>;
}

export type ProfileInput = Omit<Profile, 'id'>;
export type EmergencyContact = { name: string; phone: string };

function fail(e: NonNullable<DbError>): Error {
  if (e.code === '23505') return new Error('Nickname già in uso');
  return new Error(e.message);
}

export function createProfilesApi(client: DbClient) {
  async function myId(): Promise<string> {
    const { data } = await client.auth.getSession();
    if (!data.session) throw new Error('Accedi per continuare');
    return data.session.user.id;
  }

  return {
    async getMyProfile(): Promise<Profile | null> {
      const id = await myId();
      const { data, error } = await client
        .from('profiles')
        .select('id, nickname, display_name, gender, avatar, bike_type')
        .eq('id', id)
        .maybeSingle();
      if (error) throw fail(error);
      if (!data) return null;
      return {
        id: data.id,
        nickname: data.nickname,
        displayName: data.display_name ?? null,
        gender: data.gender as Gender,
        avatar: data.avatar,
        bikeType: (data.bike_type ?? null) as BikeType | null,
      };
    },

    async saveProfile(p: ProfileInput): Promise<void> {
      const id = await myId();
      const { error } = await client.from('profiles').upsert({
        id,
        nickname: p.nickname,
        display_name: p.displayName,
        gender: p.gender,
        avatar: p.avatar,
        bike_type: p.bikeType,
      });
      if (error) throw fail(error);
    },

    async isNicknameAvailable(nickname: string): Promise<boolean> {
      const { data, error } = await client.rpc('nickname_available', { n: nickname.trim() });
      if (error) throw fail(error);
      return data === true;
    },

    async getEmergencyContact(): Promise<EmergencyContact | null> {
      const id = await myId();
      const { data, error } = await client.from('emergency_contacts').select('name, phone').eq('user_id', id).maybeSingle();
      if (error) throw fail(error);
      return data ? { name: data.name, phone: data.phone } : null;
    },

    async saveEmergencyContact(c: EmergencyContact): Promise<void> {
      const id = await myId();
      const { error } = await client.from('emergency_contacts').upsert({ user_id: id, name: c.name, phone: c.phone });
      if (error) throw fail(error);
    },
  };
}
