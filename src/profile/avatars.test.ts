import { AVATARS, DEFAULT_AVATAR_ID, isValidAvatar } from './avatars';

test('il catalogo ha 20 avatar con id unici, emoji ed etichetta', () => {
  expect(AVATARS).toHaveLength(20);
  expect(new Set(AVATARS.map((a) => a.id)).size).toBe(20);
  for (const a of AVATARS) {
    expect(a.emoji.length).toBeGreaterThan(0);
    expect(a.label.length).toBeGreaterThan(0);
  }
});
test('isValidAvatar riconosce solo gli id del catalogo', () => {
  expect(isValidAvatar(AVATARS[3].id)).toBe(true);
  expect(isValidAvatar('inesistente')).toBe(false);
  expect(isValidAvatar('')).toBe(false);
});
test("l'avatar predefinito esiste nel catalogo", () => {
  expect(isValidAvatar(DEFAULT_AVATAR_ID)).toBe(true);
});
