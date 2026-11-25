export type Stage = 'login' | 'profile' | 'permissions' | 'app';

/** Quale schermata mostrare, nell'ordine: accesso, profilo, permessi, app. Senza accesso vince sempre «login». */
export function nextStage(s: { loggedIn: boolean; hasProfile: boolean; permissionsDone: boolean }): Stage {
  if (!s.loggedIn) return 'login';
  if (!s.hasProfile) return 'profile';
  if (!s.permissionsDone) return 'permissions';
  return 'app';
}
