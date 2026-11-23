import { useCallback, useEffect, useState } from 'react';
import { AppState, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { nextStep, performStep, progress, type Grants } from '../onboarding/flow';
import { checkAll, openAppSettings, request } from '../onboarding/permissionsAdapter';

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const [grants, setGrants] = useState<Grants | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setGrants(await checkAll());
  }, []);

  useEffect(() => {
    refresh();
    // Quando torni dalle impostazioni di sistema, ricontrolla.
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const step = grants ? nextStep(grants) : null;
  useEffect(() => {
    if (grants && !step) onDone();
  }, [grants, step, onDone]);

  if (!grants || !step) return <View style={styles.container} />;
  const { done, total } = progress(grants);

  const onPress = async () => {
    setBusy(true);
    const r = await performStep(step.id, { request, checkAll });
    setGrants(r.grants);
    setShowHint(!r.granted);
    setBusy(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.progress}>Passo {done + 1} di {total}</Text>
      <Text style={styles.title}>{step.title}</Text>
      <Text style={styles.why}>{step.why}</Text>
      {showHint && (
        <View style={styles.hint}>
          <Text style={styles.hintText}>{step.hint}</Text>
          <TouchableOpacity style={styles.secondary} onPress={openAppSettings}>
            <Text style={styles.secondaryText}>Apri le impostazioni dell'app</Text>
          </TouchableOpacity>
        </View>
      )}
      <TouchableOpacity style={[styles.primary, busy && styles.disabled]} onPress={onPress} disabled={busy}>
        <Text style={styles.primaryText}>{showHint ? 'Riprova' : step.button}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 80, gap: 14 },
  progress: { fontSize: 14, color: '#555' },
  title: { fontSize: 26, fontWeight: '700' },
  why: { fontSize: 17, color: '#333' },
  hint: { backgroundColor: '#fef3c7', padding: 12, borderRadius: 8, gap: 10 },
  hintText: { fontSize: 15, color: '#78350f' },
  primary: { padding: 16, borderRadius: 8, backgroundColor: '#1d4ed8', alignItems: 'center' },
  disabled: { opacity: 0.5 },
  primaryText: { color: 'white', fontSize: 18, fontWeight: '700' },
  secondary: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#888', alignItems: 'center' },
  secondaryText: { fontSize: 15 },
});
