import { parseRecoveryUrl, RESET_REDIRECT } from './recoveryLink';

test('RESET_REDIRECT è l\'indirizzo dell\'app per il recupero password', () => {
  expect(RESET_REDIRECT).toBe('motoamici://reset-password');
});
test('link di recupero con i dati dopo il # → token riconosciuti', () => {
  const url = 'motoamici://reset-password#access_token=AAA.BBB&refresh_token=RRR&expires_in=3600&token_type=bearer&type=recovery';
  expect(parseRecoveryUrl(url)).toEqual({ kind: 'ok', accessToken: 'AAA.BBB', refreshToken: 'RRR' });
});
test('link con i dati dopo il ? → riconosciuti ugualmente', () => {
  expect(parseRecoveryUrl('motoamici://reset-password?access_token=A&refresh_token=R&type=recovery')).toEqual({
    kind: 'ok', accessToken: 'A', refreshToken: 'R',
  });
});
test('valori con caratteri codificati vengono decodificati', () => {
  const r = parseRecoveryUrl('motoamici://reset-password#access_token=a%2Bb&refresh_token=r%3D&type=recovery');
  expect(r).toEqual({ kind: 'ok', accessToken: 'a+b', refreshToken: 'r=' });
});
test('manca un token → null', () => {
  expect(parseRecoveryUrl('motoamici://reset-password#access_token=A&type=recovery')).toBeNull();
  expect(parseRecoveryUrl('motoamici://reset-password#refresh_token=R&type=recovery')).toBeNull();
});
test('tipo diverso da recovery (es. signup) → null: non si apre il cambio password', () => {
  expect(parseRecoveryUrl('motoamici://reset-password#access_token=A&refresh_token=R&type=signup')).toBeNull();
  expect(parseRecoveryUrl('motoamici://reset-password#access_token=A&refresh_token=R')).toBeNull();
});
test('link scaduto o rifiutato → errore leggibile', () => {
  const r = parseRecoveryUrl('motoamici://reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
  expect(r).toEqual({ kind: 'error', message: 'Il link è scaduto o non è valido: richiedine uno nuovo' });
});
test('indirizzi che non c\'entrano, vuoti o rotti → null', () => {
  expect(parseRecoveryUrl('')).toBeNull();
  expect(parseRecoveryUrl('https://esempio.it/#access_token=A&refresh_token=R&type=recovery')).toBeNull();
  expect(parseRecoveryUrl('motoamici://altro#access_token=A&refresh_token=R&type=recovery')).toBeNull();
  expect(parseRecoveryUrl('%%%')).toBeNull();
});
