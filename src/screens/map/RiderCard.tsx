import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getGroupsApi } from '../../api';
import { mapsDirectionsUrl } from '../../groups/meetPoint';
import { requestStateFor } from '../../groups/requestState';
import type { MyGroup, MyRequest, Participant } from '../../groups/types';
import { describeRider, markerColor } from '../../map/riderCard';
import type { Rider } from '../../map/types';
import { Button, colors, Field, Notice } from '../ui';

export function RiderCard({ rider, myGroup, mine, onClose, onChanged, now = Date.now() }: {
  rider: Rider;
  myGroup: MyGroup | null;
  mine: MyRequest[];
  onClose: () => void;
  onChanged: () => void;
  now?: number;
}) {
  const d = describeRider(rider, now);
  const [people, setPeople] = useState<Participant[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const state = rider.groupId ? requestStateFor(rider.groupId, myGroup?.groupId ?? null, mine, now) : null;

  // L'elenco dei partecipanti lo restituisce il server solo ai premium (o ai membri): se non c'è, resta nascosto.
  useEffect(() => {
    setPeople([]);
    if (!rider.groupId || rider.memberCount === null) return;
    let cancelled = false;
    getGroupsApi().participants(rider.groupId).then((p) => { if (!cancelled) setPeople(p); }, () => undefined);
    return () => { cancelled = true; };
  }, [rider.groupId, rider.memberCount]);

  const send = async () => {
    if (!rider.groupId) return;
    setBusy(true);
    setError(null);
    try {
      await getGroupsApi().requestJoin(rider.groupId, message.trim() || null);
      setMessage('');
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const cancel = async (requestId: string) => {
    setBusy(true);
    setError(null);
    try {
      await getGroupsApi().cancelRequest(requestId);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.card}>
      <View style={s.head}>
        <View style={[s.dot, { backgroundColor: markerColor(rider.gender) }]} />
        <Text style={s.title}>{d.title}</Text>
        {d.friendTag ? <Text style={s.tag}>amico</Text> : null}
        <TouchableOpacity onPress={onClose} hitSlop={12}>
          <Text style={s.close}>✕</Text>
        </TouchableOpacity>
      </View>
      {d.lines.map((l) => (
        <Text key={l} style={s.line}>{l}</Text>
      ))}
      {rider.memberCount !== null ? <Text style={s.line}>Partecipanti: {rider.memberCount}</Text> : null}
      {people.length > 0 ? <Text style={s.line}>{people.map((p) => p.nickname).join(', ')}</Text> : null}
      {d.premiumHint ? <Text style={s.hint}>I dati del giro, della moto e i partecipanti sono per gli utenti Premium.</Text> : null}
      {error ? <Notice text={error} /> : null}
      {state?.kind === 'can-request' ? (
        <>
          <Field label="Messaggio (facoltativo)" value={message} onChangeText={setMessage} maxLength={140} placeholder="Es. Ciao, posso unirmi?" />
          <Button title="Chiedi di unirti" onPress={send} busy={busy} />
        </>
      ) : null}
      {state?.kind === 'pending' ? (
        <>
          <Text style={s.info}>Richiesta inviata: in attesa di risposta.</Text>
          <Button title="Annulla la richiesta" variant="secondary" onPress={() => cancel(state.requestId)} busy={busy} />
        </>
      ) : null}
      {state?.kind === 'wait' ? <Text style={s.info}>Richiesta rifiutata. Potrai riprovare tra {state.waitMinutes} minuti.</Text> : null}
      {state?.kind === 'member' ? <Text style={s.info}>È il tuo gruppo.</Text> : null}
      {rider.exact ? (
        <Button
          title="Indicazioni con Google Maps"
          variant="secondary"
          onPress={() => Linking.openURL(mapsDirectionsUrl({ lat: rider.lat, lng: rider.lng })).catch(() => undefined)}
        />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: 'white', borderRadius: 12, padding: 14, gap: 4, elevation: 4, shadowOpacity: 0.2, shadowRadius: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  title: { fontSize: 17, fontWeight: '700', flex: 1 },
  tag: { backgroundColor: '#facc15', borderRadius: 6, paddingHorizontal: 6, fontSize: 12, fontWeight: '700' },
  close: { fontSize: 18, color: colors.muted },
  line: { fontSize: 14, color: '#334155' },
  hint: { fontSize: 13, color: '#7c3aed', marginTop: 4 },
  info: { fontSize: 14, color: '#1d4ed8', marginTop: 4 },
});
