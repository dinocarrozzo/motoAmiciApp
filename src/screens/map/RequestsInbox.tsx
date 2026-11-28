import { Text, View } from 'react-native';
import type { IncomingRequest } from '../../groups/types';
import { Button } from '../ui';

/** Richieste di unirsi al mio gruppo: ognuno dei membri può rispondere, vale la prima risposta. */
export function RequestsInbox({ incoming, onAccept, onDecline }: {
  incoming: IncomingRequest[];
  onAccept: (r: IncomingRequest) => void;
  onDecline: (r: IncomingRequest) => void;
}) {
  if (incoming.length === 0) return null;
  return (
    <View style={{ gap: 6 }}>
      {incoming.map((r) => (
        <View key={r.requestId} style={{ backgroundColor: '#fef9c3', borderRadius: 8, padding: 10, gap: 4 }}>
          <Text style={{ fontWeight: '700' }}>{r.nickname} vuole unirsi al giro</Text>
          {r.message ? <Text style={{ color: '#334155' }}>“{r.message}”</Text> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Button title="Accetta" onPress={() => onAccept(r)} /></View>
            <View style={{ flex: 1 }}><Button title="Rifiuta" variant="secondary" onPress={() => onDecline(r)} /></View>
          </View>
        </View>
      ))}
    </View>
  );
}
