import { nextStep, performStep, progress, STEPS, type Grants, type StepId } from './flow';

const none: Grants = {
  'location-foreground': false,
  'location-background': false,
  notifications: false,
  battery: false,
};

test('i passi sono nell\'ordine: posizione, posizione sempre, notifiche, batteria', () => {
  expect(STEPS.map((s) => s.id)).toEqual([
    'location-foreground',
    'location-background',
    'notifications',
    'battery',
  ]);
});

test('ogni passo ha titolo, motivo, testo del tasto e suggerimento in italiano', () => {
  for (const s of STEPS) {
    expect(s.title.length).toBeGreaterThan(0);
    expect(s.why.length).toBeGreaterThan(10);
    expect(s.button.length).toBeGreaterThan(0);
    expect(s.hint.length).toBeGreaterThan(10);
  }
});

test('nextStep dà il primo passo non concesso, uno alla volta', () => {
  expect(nextStep(none)?.id).toBe('location-foreground');
  const g1 = { ...none, 'location-foreground': true };
  expect(nextStep(g1)?.id).toBe('location-background');
  const g2 = { ...g1, 'location-background': true };
  expect(nextStep(g2)?.id).toBe('notifications');
  const g3 = { ...g2, notifications: true };
  expect(nextStep(g3)?.id).toBe('battery');
  expect(nextStep({ ...g3, battery: true })).toBeNull();
});

test('"sempre" mai proposto prima della posizione base, anche se risulta concesso', () => {
  const odd = { ...none, 'location-background': true };
  expect(nextStep(odd)?.id).toBe('location-foreground');
});

test('progress conta i passi concessi', () => {
  expect(progress(none)).toEqual({ done: 0, total: 4 });
  expect(progress({ ...none, notifications: true, battery: true })).toEqual({ done: 2, total: 4 });
});

describe('performStep', () => {
  function deps(afterRequest: Grants) {
    const calls: string[] = [];
    return {
      calls,
      request: async (id: StepId) => {
        calls.push(`request:${id}`);
      },
      checkAll: async () => {
        calls.push('check');
        return afterRequest;
      },
    };
  }

  test('chiede il permesso e poi ricontrolla; concesso → granted true', async () => {
    const d = deps({ ...none, 'location-foreground': true });
    const r = await performStep('location-foreground', d);
    expect(d.calls).toEqual(['request:location-foreground', 'check']);
    expect(r.granted).toBe(true);
    expect(r.grants['location-foreground']).toBe(true);
  });

  test('non concesso dopo la richiesta → granted false (serve mostrare il suggerimento)', async () => {
    const d = deps(none);
    const r = await performStep('notifications', d);
    expect(r.granted).toBe(false);
  });

  test('se la richiesta lancia un errore, non lancia e restituisce granted false', async () => {
    const r = await performStep('battery', {
      request: async () => {
        throw new Error('non supportato');
      },
      checkAll: async () => none,
    });
    expect(r.granted).toBe(false);
  });
});
