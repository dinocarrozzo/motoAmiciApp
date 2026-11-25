import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors } from '../ui';

export function SmallButton({ title, onPress, kind = 'primary', disabled }: {
  title: string;
  onPress?: () => void;
  kind?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[s.btn, kind === 'ghost' && s.ghost, kind === 'danger' && s.danger, disabled && { opacity: 0.5 }]}
    >
      <Text style={[s.text, kind === 'ghost' && { color: colors.primary }, kind === 'danger' && { color: colors.danger }]}>{title}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: { backgroundColor: colors.primary, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 8 },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary },
  danger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.danger },
  text: { color: 'white', fontWeight: '700', fontSize: 14 },
});
