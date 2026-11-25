import { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View } from 'react-native';

export const colors = { primary: '#1d4ed8', danger: '#b91c1c', ok: '#15803d', muted: '#555', border: '#cbd5e1' };

export function Field(props: TextInputProps & { label: string; error?: string }) {
  const { label, error, style, ...rest } = props;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...rest} style={[styles.input, error ? styles.inputError : null, style]} placeholderTextColor="#94a3b8" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function Button({ title, onPress, busy, variant = 'primary' }: {
  title: string;
  onPress: () => void;
  busy?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  return (
    <TouchableOpacity
      style={[styles.button, variant === 'secondary' && styles.secondary, variant === 'danger' && styles.dangerBtn, busy && styles.disabled]}
      onPress={onPress}
      disabled={busy}
    >
      {busy ? (
        <ActivityIndicator color={variant === 'secondary' ? colors.primary : 'white'} />
      ) : (
        <Text style={[styles.buttonText, variant === 'secondary' && { color: colors.primary }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

export function Check({ checked, onToggle, children, error }: {
  checked: boolean;
  onToggle: () => void;
  children: ReactNode;
  error?: string;
}) {
  return (
    <View style={styles.field}>
      <TouchableOpacity style={styles.checkRow} onPress={onToggle}>
        <View style={[styles.box, checked && styles.boxOn]}>{checked ? <Text style={styles.tick}>✓</Text> : null}</View>
        <Text style={styles.checkText}>{children}</Text>
      </TouchableOpacity>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export const Notice = ({ text, kind = 'error' }: { text: string; kind?: 'error' | 'info' }) => (
  <Text style={[styles.notice, kind === 'info' ? styles.noticeInfo : styles.noticeError]}>{text}</Text>
);

export const styles = StyleSheet.create({
  screen: { padding: 20, paddingTop: 70, gap: 6 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 16, color: colors.muted, marginBottom: 12 },
  field: { marginBottom: 12 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: 'white' },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: 13, marginTop: 4 },
  button: { padding: 15, borderRadius: 8, backgroundColor: colors.primary, alignItems: 'center', marginTop: 8 },
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary },
  dangerBtn: { backgroundColor: colors.danger },
  disabled: { opacity: 0.5 },
  buttonText: { color: 'white', fontSize: 17, fontWeight: '700' },
  link: { color: colors.primary, fontSize: 15, textAlign: 'center', padding: 10 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  box: { width: 24, height: 24, borderWidth: 2, borderColor: colors.primary, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.primary },
  tick: { color: 'white', fontWeight: '700' },
  checkText: { flex: 1, fontSize: 15 },
  notice: { padding: 12, borderRadius: 8, marginBottom: 10, fontSize: 15 },
  noticeError: { backgroundColor: '#fee2e2', color: '#991b1b' },
  noticeInfo: { backgroundColor: '#dbeafe', color: '#1e3a8a' },
});
