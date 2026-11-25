import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { fetchWithTimeout } from './fetchWithTimeout';

let client: SupabaseClient | null = null;

/** L'unico client Supabase dell'app: sessione salvata sul telefono, richieste con tempo massimo. */
export function getClient(): SupabaseClient {
  if (!client) {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error('Mancano EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_ANON_KEY nel file .env');
    }
    client = createClient(url, key, {
      auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
      global: { fetch: fetchWithTimeout(15_000) },
    });
  }
  return client;
}
