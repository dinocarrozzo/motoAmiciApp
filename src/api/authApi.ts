type AuthError = { message: string; code?: string; status?: number } | null;

/** La parte del client Supabase che ci serve per l'accesso (permette un client finto nei test). */
export interface AuthClient {
  auth: {
    signUp(c: { email: string; password: string }): PromiseLike<{ data: unknown; error: AuthError }>;
    signInWithPassword(c: { email: string; password: string }): PromiseLike<{ data: unknown; error: AuthError }>;
    signOut(): PromiseLike<{ error: AuthError }>;
    resetPasswordForEmail(email: string): PromiseLike<{ data: unknown; error: AuthError }>;
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
      check((await client.auth.resetPasswordForEmail(clean(email))).error);
    },
    async getSession(): Promise<boolean> {
      return (await client.auth.getSession()).data.session !== null;
    },
    onSessionChange(cb: (loggedIn: boolean) => void): () => void {
      const { data } = client.auth.onAuthStateChange((_event, session) => cb(session !== null));
      return () => data.subscription.unsubscribe();
    },
  };
}
