import type { TrackPoint } from '../tracking/types';
import { getClient } from './supabaseClient';

type DbError = { message: string } | null;

/** La parte del client Supabase che ci serve (permette un client finto nei test). */
export interface TrackClient {
  auth: {
    getSession(): PromiseLike<{ data: { session: unknown | null } }>;
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
      // Serve un utente che ha fatto l'accesso (niente più accesso anonimo): i punti restano in coda e si riprova.
      const { data } = await client.auth.getSession();
      if (!data.session) throw new Error('Accedi per continuare');
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
  if (!defaultApi) defaultApi = createTrackApi(getClient() as unknown as TrackClient);
  return defaultApi;
}

export const ensureSignedIn = (): Promise<void> => api().ensureSignedIn();
export const sendPoints = (points: TrackPoint[]): Promise<void> => api().sendPoints(points);
