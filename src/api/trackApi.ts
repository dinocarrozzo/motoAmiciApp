import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import type { TrackPoint } from '../tracking/types';

type DbError = { message: string } | null;

/** La parte del client Supabase che ci serve (permette un client finto nei test). */
export interface TrackClient {
  auth: {
    getSession(): Promise<{ data: { session: unknown | null } }>;
    signInAnonymously(): Promise<{ error: DbError }>;
  };
  from(table: string): {
    upsert(
      rows: unknown,
      options: { onConflict: string; ignoreDuplicates: boolean },
    ): PromiseLike<{ error: DbError }>;
  };
}

export function createTrackApi(client: TrackClient) {
  return {
    async ensureSignedIn(): Promise<void> {
      const { data } = await client.auth.getSession();
      if (data.session) return;
      const { error } = await client.auth.signInAnonymously();
      if (error) throw new Error(error.message);
    },

    async sendPoints(points: TrackPoint[]): Promise<void> {
      if (points.length === 0) return;
      const rows = points.map((p) => ({
        session_id: p.sessionId,
        recorded_at: new Date(p.recordedAt).toISOString(),
        lat: p.lat,
        lng: p.lng,
        accuracy: p.accuracy,
        speed: p.speed,
      }));
      const { error } = await client
        .from('track_points')
        .upsert(rows, { onConflict: 'session_id,recorded_at', ignoreDuplicates: true });
      if (error) throw new Error(error.message);
    },
  };
}

let defaultApi: ReturnType<typeof createTrackApi> | null = null;

function api() {
  if (!defaultApi) {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error('Mancano EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_ANON_KEY nel file .env');
    }
    const client = createClient(url, key, {
      auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true },
    });
    defaultApi = createTrackApi(client as unknown as TrackClient);
  }
  return defaultApi;
}

export const ensureSignedIn = (): Promise<void> => api().ensureSignedIn();
export const sendPoints = (points: TrackPoint[]): Promise<void> => api().sendPoints(points);
