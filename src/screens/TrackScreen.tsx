import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { buffer, stats, tracker } from '../tracking/defaultTracker';
import { resetStats } from '../tracking/stats';
import type { TrackerStatus } from '../tracking/tracker';

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const WARNINGS: Record<Exclude<TrackerStatus, 'tracking'>, string> = {
  'permission-denied':
    'Permesso di posizione negato. Vai in Impostazioni → App → MotoAmici → Autorizzazioni → Posizione e scegli "Consenti sempre".',
  'foreground-only':
    'Il permesso è solo "mentre l\'app è in uso": il GPS si fermerebbe a schermo bloccato. Scegli "Consenti sempre" nelle impostazioni dell\'app.',
  error: 'Impossibile avviare il tracciamento (controlla .env, l\'accesso anonimo di Supabase o la licenza della libreria).',
};

export function TrackScreen({ nickname, onSignOut }: { nickname: string; onSignOut: () => void }) {
  const [status, setStatus] = useState<TrackerStatus | 'idle'>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [, tick] = useState(0);

  useEffect(() => {
    // Se il sistema ha chiuso l'app ma il GPS sta ancora tracciando, riprendi la sessione.
    tracker.restore().then((id) => {
      if (id) {
        setSessionId(id);
        setStatus('tracking');
      }
    });
  }, []);

  useEffect(() => {
    const id = setInterval(async () => {
      setPending(await buffer.pendingCount());
      tick((n) => n + 1);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const start = async () => {
    const id = uuidv4();
    resetStats();
    setPending(0);
    setSessionId(id);
    setStatus(await tracker.start(id));
  };
  const stop = async () => {
    try {
      await tracker.stop();
    } finally {
      setStatus('idle'); // anche se qualcosa va storto, il tasto torna a «Avvia»
    }
  };

  const tracking = status === 'tracking';
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>MotoAmici GPS (prova)</Text>
      {nickname ? <Text style={styles.line}>Ciao, {nickname}</Text> : null}
      {status !== 'idle' && status !== 'tracking' && <Text style={styles.warning}>{WARNINGS[status]}</Text>}
      {status === 'error' && tracker.lastError() && (
        <Text style={styles.warning}>Dettaglio: {tracker.lastError()}</Text>
      )}
      <Text style={styles.line}>Stato: {tracking ? 'sta tracciando' : 'fermo'}</Text>
      <Text style={styles.line}>Sessione: {sessionId ?? '—'}</Text>
      <Text style={styles.line}>Punti registrati: {stats.sent + pending}</Text>
      <Text style={styles.line}>Punti inviati: {stats.sent}</Text>
      <Text style={styles.line}>Punti in attesa: {pending}</Text>
      <Text style={styles.line}>
        Ultimo invio: {stats.lastSentAt ? new Date(stats.lastSentAt).toLocaleTimeString() : '—'}
      </Text>
      {stats.lastError && <Text style={styles.warning}>Ultimo errore: {stats.lastError}</Text>}
      <View style={{ height: 12 }} />
      <TouchableOpacity style={[styles.button, tracking && styles.stop]} onPress={tracking ? stop : start}>
        <Text style={styles.buttonText}>{tracking ? 'Ferma' : 'Avvia'}</Text>
      </TouchableOpacity>
      {!tracking ? (
        <TouchableOpacity style={{ padding: 14, alignItems: 'center' }} onPress={onSignOut}>
          <Text style={{ fontSize: 16, color: '#1d4ed8' }}>Esci dall'account</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 60, gap: 8 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  line: { fontSize: 16 },
  warning: { backgroundColor: '#fee2e2', color: '#991b1b', padding: 12, borderRadius: 8, fontSize: 15 },
  button: { padding: 16, borderRadius: 8, backgroundColor: '#15803d', alignItems: 'center' },
  stop: { backgroundColor: '#b91c1c' },
  buttonText: { color: 'white', fontSize: 18, fontWeight: '700' },
});
