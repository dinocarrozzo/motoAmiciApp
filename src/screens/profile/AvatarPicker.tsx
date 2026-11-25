import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AVATARS } from '../../profile/avatars';

export function AvatarPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <View style={s.grid}>
      {AVATARS.map((a) => (
        <TouchableOpacity
          key={a.id}
          accessibilityLabel={a.label}
          style={[s.cell, value === a.id && s.selected]}
          onPress={() => onChange(a.id)}
        >
          <Text style={s.emoji}>{a.emoji}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9', borderWidth: 2, borderColor: 'transparent' },
  selected: { borderColor: '#1d4ed8', backgroundColor: '#dbeafe' },
  emoji: { fontSize: 30 },
});
