import { useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity } from 'react-native';
import { Button, Field, Notice, styles } from '../ui';

export function LoginScreen({ onSignIn, onGoRegister, onGoForgot, notice }: {
  notice?: string | null;
  onSignIn: (email: string, password: string) => Promise<void>;
  onGoRegister: () => void;
  onGoForgot: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sending = useRef(false);

  const submit = async () => {
    if (sending.current) return; // niente doppio tocco
    sending.current = true;
    setBusy(true);
    setError(null);
    try {
      await onSignIn(email, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>MotoAmici</Text>
      <Text style={styles.subtitle}>Accedi per trovare compagni di giro.</Text>
      {notice ? <Notice text={notice} /> : null}
      {error ? <Notice text={error} /> : null}
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="password" />
      <Button title="Accedi" onPress={submit} busy={busy} />
      <TouchableOpacity onPress={onGoForgot}><Text style={styles.link}>Password dimenticata?</Text></TouchableOpacity>
      <Button title="Crea un account" onPress={onGoRegister} variant="secondary" />
    </ScrollView>
  );
}
