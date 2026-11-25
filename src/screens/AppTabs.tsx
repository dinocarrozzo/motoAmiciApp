import { ReactNode, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from './ui';

export type TabDef = { id: string; label: string; icon: string; render: () => ReactNode };

/** Barra di schede semplice in basso. Le schede non selezionate restano montate, così il giro in corso non si perde. */
export function AppTabs({ tabs }: { tabs: TabDef[] }) {
  const [active, setActive] = useState(tabs[0].id);
  const [visited, setVisited] = useState<string[]>([tabs[0].id]);
  const open = (id: string) => {
    setActive(id);
    setVisited((v) => (v.includes(id) ? v : [...v, id]));
  };
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {tabs.map((t) =>
          visited.includes(t.id) ? (
            <View key={t.id} style={{ flex: 1, display: t.id === active ? 'flex' : 'none' }}>{t.render()}</View>
          ) : null,
        )}
      </View>
      <View style={s.bar}>
        {tabs.map((t) => (
          <TouchableOpacity key={t.id} style={s.tab} onPress={() => open(t.id)}>
            <Text style={{ fontSize: 22 }}>{t.icon}</Text>
            <Text style={[s.label, t.id === active && { color: colors.primary, fontWeight: '700' }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: 1, borderColor: '#e2e8f0', backgroundColor: 'white', paddingBottom: 6 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  label: { fontSize: 12, color: '#475569' },
});
