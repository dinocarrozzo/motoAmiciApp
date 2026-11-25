import { RESET_REDIRECT } from '../auth/recoveryLink';

type AuthError = { message: string; code?: string; status?: number } | null;

/** La parte del client Supabase che ci serve per l'accesso (permette un client finto nei test). */
export interface AuthClient {
  auth: {
    signUp(c: { email: string; password: string }): PromiseLike<{ data: unknown; error: AuthError }>;
    signInWithPassword(c: { email: string; password: string }): PromiseLike<{ data: unknown; error: AuthError }>;
    signOut(): PromiseLike<{ error: AuthError }>;
    resetPasswordForEmail(email: string, opts?: { redirectTo?: string }): PromiseLike<{ data: unknown; error: AuthError }>;
    setSession(s: { access_token: string; refresh_token: string }): PromiseLike<{ data: unknown; error: AuthError }>;
    updateUser(attrs: { password: string }): PromiseLike<{ data: unknown; error: AuthError }>;
    getSession(): PromiseLike<{ data: { session: unknown | null } }>;
    onAuthStateChange(cb: (event: string, session: unknown | null) => void): {
      data: { subscription: { unsubscribe(): void } };
    };
  };
}

function friendly(e: NonNullable<AuthError>): Error {
  const m = e.message.toLowerCase();
  if (e.code === 'user_already_exists' || m.includes('already registered')) return new Error('Email già registrata');
  if (e.code === 'invalid_credentials' || m.includes('invalid login credentials')) return new Error('Credenziali non valide');
  if (e.code === 'weak_password' || m.includes('password should be')) return new Error('Password troppo debole');
  if (e.code === 'email_not_confirmed' || m.includes('not confirmed')) return new Error("Conferma prima l'email");
  if (e.status === 429 || e.code === 'over_email_send_rate_limit' || m.includes('rate limit')) {
    return new Error('Troppe richieste, riprova tra poco');
  }
  return new Error(e.message);
}

const clean = (email: string) => email.trim().toLowerCase();

/** Le versioni di prova usavano un accesso anonimo: quella sessione non è un account vero. */
const isRealSession = (s: unknown): boolean => s !== null && s !== undefined && !(s as { user?: { is_anonymous?: boolean } }).user?.is_anonymous;

export function createAuthApi(client: AuthClient) {
  const check = (error: AuthError) => {
    if (error) throw friendly(error);
  };
  return {
    async signUp(email: string, password: string): Promise<void> {
      check((await client.auth.signUp({ email: clean(email), password })).error);
    },
    async signIn(email: string, password: string): Promise<void> {
      check((await client.auth.signInWithPassword({ email: clean(email), password })).error);
    },
    async signOut(): Promise<void> {
      check((await client.auth.signOut()).error);
    },
    async sendPasswordReset(email: string): Promise<void> {
      check((await client.auth.resetPasswordForEmail(clean(email), { redirectTo: RESET_REDIRECT })).error);
    },
    /** Apre la sessione di recupero con i dati del link ricevuto per email. */
    async recoverSession(accessToken: string, refreshToken: string): Promise<void> {
      check((await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })).error);
    },
    async updatePassword(newPassword: string): Promise<void> {
      check((await client.auth.updateUser({ password: newPassword })).error);
    },
    async getSession(): Promise<boolean> {
      return isRealSession((await client.auth.getSession()).data.session);
    },
    onSessionChange(cb: (loggedIn: boolean) => void): () => void {
      const { data } = client.auth.onAuthStateChange((_event, session) => cb(isRealSession(session)));
      return () => data.subscription.unsubscribe();
    },
  };
}
