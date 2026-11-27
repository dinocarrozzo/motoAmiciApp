import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { rideController } from '../../map/defaultRide';
import type { RideSettings } from '../../map/types';
import { buffer, stats, tracker } from '../../tracking/defaultTracker';
import { resetStats } from '../../tracking/stats';
import type { TrackerStatus } from '../../tracking/tracker';
import { Button } from '../ui';
import { RideSetupSheet } from './RideSetupSheet';

const WARNINGS: Record<Exclude<TrackerStatus, 'tracking'>, string> = {
  'permission-denied':
    'Permesso di posizione negato. Vai in Impostazioni → App → MotoAmici → Autorizzazioni → Posizione e scegli "Consenti sempre".',
  'foreground-only':
    'Il permesso è solo "mentre l\'app è in uso": il GPS si fermerebbe a schermo bloccato. Scegli "Consenti sempre" nelle impostazioni dell\'app.',
  error: 'Impossibile avviare il giro. Controlla la connessione e riprova.',
};

/** Pannello in basso nella Mappa: Parti / Ferma e i contatori del tracciamento. */
export function TrackPanel() {
  const [status, setStatus] = useState<TrackerStatus | 'idle'>('idle');
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [, tick] = useState(0);

  useEffect(() => {
    // Se il sistema ha chiuso l'app ma il GPS sta ancora tracciando, riprendi il giro.
    tracker.restore().then((id) => {
      if (id) {
        rideController.resume(id);
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

  const start = async (settings: RideSettings) => {
    setBusy(true);
    setProblem(null);
    resetStats();
    setPending(0);
    try {
      const r = await rideController.start(settings);
      setStatus(r.status);
      setSheet(false);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const stop = async () => {
    try {
      await rideController.stop();
    } finally {
      setStatus('idle');
    }
  };

  const tracking = status === 'tracking' || (status === 'foreground-only' && rideController.currentRideId() !== null);
  return (
    <View style={s.panel}>
      {status !== 'idle' && status !== 'tracking' && <Text style={s.warning}>{WARNINGS[status]}</Text>}
      {problem ? <Text style={s.warning}>{problem}</Text> : null}
      {tracking ? (
        <>
          <Text style={s.line}>
            Stai condividendo la posizione · inviati {stats.sent} · in attesa {pending}
          </Text>
          {stats.lastError ? <Text style={s.warning}>Ultimo errore: {stats.lastError}</Text> : null}
          <Button title="Ferma il giro" variant="danger" onPress={stop} />
        </>
      ) : (
        <Button title="Parti per un giro" onPress={() => setSheet(true)} />
      )}
      <RideSetupSheet visible={sheet} busy={busy} onCancel={() => setSheet(false)} onConfirm={start} />
    </View>
  );
}

const s = StyleSheet.create({
  panel: { backgroundColor: 'white', padding: 12, gap: 8, borderTopLeftRadius: 14, borderTopRightRadius: 14, elevation: 6 },
  line: { fontSize: 14, color: '#334155' },
  warning: { backgroundColor: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 8, fontSize: 14 },
});
