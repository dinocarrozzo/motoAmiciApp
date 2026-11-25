import { useRef, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { validatePassword } from '../../profile/validation';
import { Button, Field, Notice, styles } from '../ui';

export function ResetPasswordScreen({ onSubmit, onDone }: { onSubmit: (password: string) => Promise<void>; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);

  const submit = async () => {
    if (sending.current) return;
    const v = validatePassword(password);
    if (!v.ok) return setError(v.error);
    if (password !== again) return setError('Le due password non coincidono');
    sending.current = true;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(password);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Scegli una nuova password</Text>
      <Text style={styles.subtitle}>Almeno 8 caratteri.</Text>
      {error ? <Notice text={error} /> : null}
      <Field label="Nuova password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
      <Field label="Ripeti la password" value={again} onChangeText={setAgain} secureTextEntry autoCapitalize="none" />
      <Button title="Salva la nuova password" onPress={submit} busy={busy} />
    </ScrollView>
  );
}
