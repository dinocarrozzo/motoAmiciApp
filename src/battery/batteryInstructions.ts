export type BatteryInstructions = { title: string; steps: string[] };

const SAMSUNG: BatteryInstructions = {
  title: 'Samsung: evita che il telefono chiuda l\'app',
  steps: [
    'Impostazioni → Batteria → Limiti uso in background.',
    'Disattiva "Metti in stand-by le app inutilizzate".',
    'Apri "App mai in stand-by" e aggiungi MotoAmici.',
    'Impostazioni → App → MotoAmici → Batteria → scegli "Senza limitazioni".',
    'Impostazioni → App → MotoAmici → Autorizzazioni → Posizione → "Consenti sempre".',
  ],
};

const XIAOMI: BatteryInstructions = {
  title: 'Xiaomi / Redmi / POCO: evita che il telefono chiuda l\'app',
  steps: [
    'Impostazioni → App → Gestisci app → MotoAmici → attiva "Avvio automatico".',
    'Nella stessa pagina, "Risparmio energetico" → scegli "Nessuna restrizione".',
    'Apri le app recenti, tieni premuta la scheda di MotoAmici e tocca il lucchetto per bloccarla.',
    'Impostazioni → App → Gestisci app → MotoAmici → Autorizzazioni → Posizione → "Consenti sempre".',
  ],
};

const GENERIC: BatteryInstructions = {
  title: 'Evita che il telefono chiuda l\'app',
  steps: [
    'Impostazioni → App → MotoAmici → Batteria → scegli "Nessuna restrizione" o "Senza limitazioni".',
    'Impostazioni → App → MotoAmici → Autorizzazioni → Posizione → "Consenti sempre".',
    'Se esiste un elenco di app "protette" o "sempre attive", aggiungi MotoAmici.',
  ],
};

export function batteryInstructions(manufacturer: string): BatteryInstructions {
  const m = (manufacturer ?? '').trim().toLowerCase();
  if (m === 'samsung') return SAMSUNG;
  if (m === 'xiaomi' || m === 'redmi' || m === 'poco') return XIAOMI;
  return GENERIC;
}
