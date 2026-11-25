import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AVATARS } from '../../profile/avatars';
import type { ProfileSummary } from '../../profile/types';
import { colors } from '../ui';

const GENDER_COLORS = { m: '#0ea5e9', f: '#ec4899', x: '#8b5cf6' } as const;

export function PersonRow({ person, children }: { person: ProfileSummary; children?: ReactNode }) {
  const emoji = AVATARS.find((a) => a.id === person.avatar)?.emoji ?? '🏍️';
  return (
    <View style={s.row}>
      <View style={[s.avatar, { borderColor: GENDER_COLORS[person.gender] }]}>
        <Text style={{ fontSize: 26 }}>{emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.nick}>{person.nickname}</Text>
        {person.displayName ? <Text style={s.name}>{person.displayName}</Text> : null}
      </View>
      <View style={s.actions}>{children}</View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  nick: { fontSize: 17, fontWeight: '700' },
  name: { fontSize: 14, color: colors.muted },
  actions: { flexDirection: 'row', gap: 6, alignItems: 'center', flexShrink: 1, flexWrap: 'wrap', justifyContent: 'flex-end' },
});
