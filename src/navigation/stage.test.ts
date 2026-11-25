import { nextStage } from './stage';

test('non connesso → login, qualunque cosa sia fatta', () => {
  expect(nextStage({ loggedIn: false, hasProfile: false, permissionsDone: false })).toBe('login');
  expect(nextStage({ loggedIn: false, hasProfile: true, permissionsDone: true })).toBe('login');
});
test('connesso senza profilo → profile (anche dopo una registrazione chiusa a metà)', () => {
  expect(nextStage({ loggedIn: true, hasProfile: false, permissionsDone: false })).toBe('profile');
  expect(nextStage({ loggedIn: true, hasProfile: false, permissionsDone: true })).toBe('profile');
});
test('connesso con profilo ma senza permessi → permissions', () => {
  expect(nextStage({ loggedIn: true, hasProfile: true, permissionsDone: false })).toBe('permissions');
});
test('tutto fatto → app', () => {
  expect(nextStage({ loggedIn: true, hasProfile: true, permissionsDone: true })).toBe('app');
});
