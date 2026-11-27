import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { describeRider, markerColor } from '../../map/riderCard';
import type { Rider } from '../../map/types';
import { colors } from '../ui';

export function RiderCard({ rider, onClose, now = Date.now() }: { rider: Rider; onClose: () => void; now?: number }) {
  const d = describeRider(rider, now);
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
      {d.premiumHint ? <Text style={s.hint}>I dati del giro e della moto sono per gli utenti Premium.</Text> : null}
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
});
