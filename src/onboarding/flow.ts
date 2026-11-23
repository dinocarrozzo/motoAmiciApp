export type StepId = 'location-foreground' | 'location-background' | 'notifications' | 'battery';
export type Grants = Record<StepId, boolean>;

export type StepInfo = {
  id: StepId;
  title: string;
  why: string;
  button: string;
  /** Cosa fare se dopo la richiesta il permesso non risulta concesso. */
  hint: string;
};

export const STEPS: StepInfo[] = [
  {
    id: 'location-foreground',
    title: 'Posizione',
    why: 'Serve per mostrare e condividere dove ti trovi durante il giro.',
    button: 'Consenti la posizione',
    hint: 'Nella finestra che compare scegli «Durante l\'uso dell\'app».',
  },
  {
    id: 'location-background',
    title: 'Posizione sempre attiva',
    why: 'Così il GPS continua a funzionare a schermo bloccato, con il telefono in tasca.',
    button: 'Consenti sempre',
    hint: 'Si apre la pagina Posizione dell\'app: scegli «Consenti sempre» e torna indietro.',
  },
  {
    id: 'notifications',
    title: 'Notifiche',
    why: 'Android richiede una notifica fissa mentre il GPS è attivo, e servono anche per gli avvisi di emergenza.',
    button: 'Consenti le notifiche',
    hint: 'Se la finestra non compare, apri le impostazioni dell\'app e attiva le notifiche.',
  },
  {
    id: 'battery',
    title: 'Batteria senza limitazioni',
    why: 'Senza questo il telefono può fermare l\'app mentre sei in moto e sparirai dalla mappa.',
    button: 'Escludi dal risparmio batteria',
    hint: 'Nella finestra scegli «Consenti» (oppure «Senza limitazioni»).',
  },
];

/** Il primo passo non ancora concesso, nell'ordine dei passi. Null se è tutto concesso. */
export function nextStep(grants: Grants): StepInfo | null {
  return STEPS.find((s) => !grants[s.id]) ?? null;
}

export function progress(grants: Grants): { done: number; total: number } {
  return { done: STEPS.filter((s) => grants[s.id]).length, total: STEPS.length };
}

/** Chiede un permesso e poi ricontrolla lo stato di tutti. Non lancia mai. */
export async function performStep(
  id: StepId,
  deps: { request: (id: StepId) => Promise<void>; checkAll: () => Promise<Grants> },
): Promise<{ granted: boolean; grants: Grants }> {
  try {
    await deps.request(id);
  } catch {
    // il controllo qui sotto dice comunque com'è andata
  }
  const grants = await deps.checkAll();
  return { granted: grants[id], grants };
}
