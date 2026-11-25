export type Avatar = { id: string; emoji: string; label: string };

/** Catalogo fisso: nessun caricamento di foto, quindi niente da moderare. */
export const AVATARS: Avatar[] = [
  { id: 'moto', emoji: '🏍️', label: 'Moto' },
  { id: 'volpe', emoji: '🦊', label: 'Volpe' },
  { id: 'lupo', emoji: '🐺', label: 'Lupo' },
  { id: 'orso', emoji: '🐻', label: 'Orso' },
  { id: 'aquila', emoji: '🦅', label: 'Aquila' },
  { id: 'gufo', emoji: '🦉', label: 'Gufo' },
  { id: 'tigre', emoji: '🐯', label: 'Tigre' },
  { id: 'leone', emoji: '🦁', label: 'Leone' },
  { id: 'drago', emoji: '🐉', label: 'Drago' },
  { id: 'gatto', emoji: '🐱', label: 'Gatto' },
  { id: 'cane', emoji: '🐶', label: 'Cane' },
  { id: 'rana', emoji: '🐸', label: 'Rana' },
  { id: 'pinguino', emoji: '🐧', label: 'Pinguino' },
  { id: 'scimmia', emoji: '🐵', label: 'Scimmia' },
  { id: 'riccio', emoji: '🦔', label: 'Riccio' },
  { id: 'squalo', emoji: '🦈', label: 'Squalo' },
  { id: 'razzo', emoji: '🚀', label: 'Razzo' },
  { id: 'fulmine', emoji: '⚡', label: 'Fulmine' },
  { id: 'fiamma', emoji: '🔥', label: 'Fiamma' },
  { id: 'stella', emoji: '🌟', label: 'Stella' },
];

export const DEFAULT_AVATAR_ID = 'moto';

export function isValidAvatar(id: string): boolean {
  return AVATARS.some((a) => a.id === id);
}
