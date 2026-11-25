import { normalizePhone, validateEmail, validateNickname, validatePassword, validateRegistration } from './validation';

describe('validateNickname', () => {
  test('ab → troppo corto', () => {
    const r = validateNickname('ab');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/almeno 3/);
  });
  test('21 caratteri → troppo lungo', () => {
    const r = validateNickname('a'.repeat(21));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/al massimo 20/);
  });
  test.each(['mario rossi', 'mario@', 'mario!', 'màrio'])('«%s» → caratteri non ammessi', (n) => {
    const r = validateNickname(n);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/lettere, numeri/);
  });
  test('Mario_88 → ok, con gli spazi ai lati tolti', () => {
    expect(validateNickname('  Mario_88 ')).toEqual({ ok: true, value: 'Mario_88' });
  });
});

describe('validatePassword', () => {
  test('1234567 → rifiutata', () => expect(validatePassword('1234567').ok).toBe(false));
  test('12345678 → ok', () => expect(validatePassword('12345678').ok).toBe(true));
});

describe('validateEmail', () => {
  test.each(['', 'mario', 'mario@', 'mario@x', 'ma rio@x.it'])('«%s» → non valida', (e) => {
    expect(validateEmail(e).ok).toBe(false);
  });
  test('mario@esempio.it → ok, minuscola e senza spazi', () => {
    expect(validateEmail('  Mario@Esempio.IT ')).toEqual({ ok: true, value: 'mario@esempio.it' });
  });
});

describe('validateRegistration', () => {
  const good = { email: 'a@b.it', password: '12345678', nickname: 'mario', isAdult: true, acceptedPrivacy: true };
  test('dati corretti → ok, nessun errore', () => {
    expect(validateRegistration(good)).toEqual({ ok: true, errors: {} });
  });
  test('senza isAdult → errore sul campo isAdult', () => {
    const r = validateRegistration({ ...good, isAdult: false });
    expect(r.ok).toBe(false);
    expect(r.errors.isAdult).toBeTruthy();
  });
  test('senza informativa → errore sul campo acceptedPrivacy', () => {
    expect(validateRegistration({ ...good, acceptedPrivacy: false }).errors.acceptedPrivacy).toBeTruthy();
  });
  test('più errori insieme, uno per campo', () => {
    const r = validateRegistration({ email: 'x', password: '1', nickname: 'a', isAdult: false, acceptedPrivacy: false });
    expect(Object.keys(r.errors).sort()).toEqual(['acceptedPrivacy', 'email', 'isAdult', 'nickname', 'password']);
  });
});

describe('normalizePhone', () => {
  test.each(['3331234567', '333 123 4567', '+39 333 123 4567', '0039 333 1234567', '333-123-4567'])(
    '«%s» → +393331234567',
    (p) => expect(normalizePhone(p)).toEqual({ ok: true, value: '+393331234567' }),
  );
  test('numero estero con prefisso resta com\'è', () => {
    expect(normalizePhone('+44 7911 123456')).toEqual({ ok: true, value: '+447911123456' });
  });
  test.each(['12', '', 'abc', '+1', '12345678901234567'])('«%s» → errore', (p) => {
    expect(normalizePhone(p).ok).toBe(false);
  });
});
