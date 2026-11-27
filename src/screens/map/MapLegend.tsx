import { StyleSheet, Text, View } from 'react-native';
import { FRIEND_RING_COLOR } from '../../map/geojson';
import { markerColor } from '../../map/riderCard';

const ITEMS: { color: string; ring?: string; label: string }[] = [
  { color: markerColor('m'), label: 'Uomo' },
  { color: markerColor('f'), label: 'Donna' },
  { color: markerColor('x'), label: 'Sesso non indicato' },
  { color: '#ffffff', ring: FRIEND_RING_COLOR, label: 'Cerchio giallo: amico' },
];

export function MapLegend() {
  return (
    <View style={s.box}>
      {ITEMS.map((i) => (
        <View key={i.label} style={s.row}>
          <View style={[s.dot, { backgroundColor: i.color, borderColor: i.ring ?? '#cbd5e1' }]} />
          <Text style={s.text}>{i.label}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  box: { backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 10, padding: 8, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 3 },
  text: { fontSize: 12, color: '#1e293b' },
});
