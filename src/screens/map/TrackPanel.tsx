import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { getGroupsApi } from '../../api';
import type { GroupSnapshot } from '../../groups/useGroupState';
import { visibleAnswers } from '../../groups/requestState';
import type { IncomingRequest } from '../../groups/types';
import { rideController } from '../../map/defaultRide';
import type { RideSettings } from '../../map/types';
import { buffer, stats, tracker } from '../../tracking/defaultTracker';
import { resetStats } from '../../tracking/stats';
import type { TrackerStatus } from '../../tracking/tracker';
import { Button, Notice } from '../ui';
import { GroupPanel } from './GroupPanel';
import { JoinByCode } from './JoinByCode';
import { RequestsInbox } from './RequestsInbox';
import { RideSetupSheet } from './RideSetupSheet';

const WARNINGS: Record<Exclude<TrackerStatus, 'tracking'>, string> = {
  'permission-denied':
    'Permesso di posizione negato. Vai in Impostazioni → App → MotoAmici → Autorizzazioni → Posizione e scegli "Consenti sempre".',
  'foreground-only':
    'Il permesso è solo "mentre l\'app è in uso": il GPS si fermerebbe a schermo bloccato. Scegli "Consenti sempre" nelle impostazioni dell\'app.',
  error: 'Impossibile avviare il giro. Controlla la connessione e riprova.',
};

/** Pannello in basso nella Mappa: giro, gruppo, richieste e inviti. */
export function TrackPanel({ snapshot, nickname, now, onAccept, onChanged }: {
  snapshot: GroupSnapshot;
  nickname: string;
  now: number;
  onAccept: (r: IncomingRequest) => void;
  onChanged: () => void;
}) {
  const [status, setStatus] = useState<TrackerStatus | 'idle'>('idle');
  const [sheet, setSheet] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [seen, setSeen] = useState<string[]>([]);
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

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setProblem(null);
    try {
      await fn();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const start = (settings: RideSettings) =>
    run(async () => {
      resetStats();
      setPending(0);
      const r = await rideController.start(settings);
      setStatus(r.status);
      setSheet(false);
      onChanged();
    });
  const startWithGroup = (groupId: string) =>
    run(async () => {
      resetStats();
      setPending(0);
      const r = await rideController.start({ rideType: null, visibility: 'all', destination: null }, groupId);
      setStatus(r.status);
      onChanged();
    });
  const stop = async () => {
    try {
      await rideController.stop();
    } finally {
      setStatus('idle');
      onChanged();
    }
  };
  const decline = (r: IncomingRequest) => run(async () => { await getGroupsApi().respond(r.requestId, false, null, null); onChanged(); });
  const answerInvite = (groupId: string, accept: boolean) => run(async () => { await getGroupsApi().respondInvite(groupId, accept); onChanged(); });

  const group = snapshot.group;
  const tracking = status === 'tracking' || (status === 'foreground-only' && rideController.currentRideId() !== null) || (group?.rideId ?? null) !== null;
  const answered = visibleAnswers(snapshot.mine, group, now, seen);

  return (
    <ScrollView style={s.panel} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
      {status !== 'idle' && status !== 'tracking' && <Text style={s.warning}>{WARNINGS[status]}</Text>}
      {problem ? <Notice text={problem} /> : null}
      <RequestsInbox incoming={snapshot.incoming} onAccept={onAccept} onDecline={decline} />
      {snapshot.invites.map((i) => (
        <View key={i.groupId} style={s.invite}>
          <Text style={{ fontWeight: '700' }}>{i.inviterNickname} ti invita al suo giro{i.destination ? ` verso ${i.destination}` : ''}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Button title="Entra" onPress={() => answerInvite(i.groupId, true)} busy={busy} /></View>
            <View style={{ flex: 1 }}><Button title="Rifiuta" variant="secondary" onPress={() => answerInvite(i.groupId, false)} busy={busy} /></View>
          </View>
        </View>
      ))}
      {answered.map((r) => (
        <View key={r.requestId} style={r.status === 'accepted' ? s.ok : s.invite}>
          {r.status === 'accepted' ? (
            <>
              <Text style={{ fontWeight: '700' }}>Richiesta accettata!{r.meetNote ? ` ${r.meetNote}` : ''}</Text>
              {r.meet ? <Text>Il punto d'incontro è segnato in verde sulla mappa.</Text> : null}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}><Button title="Parti con il gruppo" onPress={() => startWithGroup(r.groupId)} busy={busy} /></View>
                <View style={{ flex: 1 }}><Button title="Dopo" variant="secondary" onPress={() => setSeen((x) => [...x, r.requestId])} /></View>
              </View>
            </>
          ) : (
            <>
              <Text>Il gruppo ha rifiutato la tua richiesta. Potrai riprovare tra un po'.</Text>
              <Button title="Ok" variant="secondary" onPress={() => setSeen((x) => [...x, r.requestId])} />
            </>
          )}
        </View>
      ))}
      {tracking ? (
        <>
          {group ? <GroupPanel group={group} nickname={nickname} onChanged={onChanged} /> : null}
          <Text style={s.line}>Stai condividendo la posizione · inviati {stats.sent} · in attesa {pending}</Text>
          {stats.lastError ? <Text style={s.warning}>Ultimo errore: {stats.lastError}</Text> : null}
          <Button title="Ferma il giro" variant="danger" onPress={stop} />
        </>
      ) : (
        <>
          {group ? (
            <>
              <Text style={{ fontWeight: '700' }}>
                Sei nel gruppo di un giro{group.destination ? ` verso ${group.destination}` : ''}
              </Text>
              <Button title="Parti con il gruppo" onPress={() => startWithGroup(group.groupId)} busy={busy} />
            </>
          ) : null}
          <Button title="Parti per un giro" onPress={() => setSheet(true)} />
          <Button title="Ho un codice" variant="secondary" onPress={() => setCodeOpen(true)} />
        </>
      )}
      <RideSetupSheet visible={sheet} busy={busy} onCancel={() => setSheet(false)} onConfirm={start} />
      <JoinByCode visible={codeOpen} onClose={() => setCodeOpen(false)} onJoined={onChanged} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  panel: { backgroundColor: 'white', padding: 12, borderTopLeftRadius: 14, borderTopRightRadius: 14, elevation: 6, maxHeight: 360 },
  line: { fontSize: 14, color: '#334155' },
  warning: { backgroundColor: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 8, fontSize: 14 },
  invite: { backgroundColor: '#e0f2fe', borderRadius: 8, padding: 10, gap: 4 },
  ok: { backgroundColor: '#dcfce7', borderRadius: 8, padding: 10, gap: 4 },
});
