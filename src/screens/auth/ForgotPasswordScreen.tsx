import { useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity } from 'react-native';
import { validateEmail } from '../../profile/validation';
import { Button, Field, Notice, styles } from '../ui';

export function ForgotPasswordScreen({ onSend, onBack }: { onSend: (email: string) => Promise<void>; onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const sending = useRef(false);

  const submit = async () => {
    if (sending.current) return;
    const v = validateEmail(email);
    if (!v.ok) return setError(v.error);
    sending.current = true;
    setBusy(true);
    setError(null);
    try {
      await onSend(v.value);
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Recupera la password</Text>
      <Text style={styles.subtitle}>Ti mandiamo un'email con le istruzioni.</Text>
      {error ? <Notice text={error} /> : null}
      {sent ? <Notice kind="info" text="Email inviata: controlla la posta (anche lo spam)." /> : null}
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Button title="Invia" onPress={submit} busy={busy} />
      <TouchableOpacity onPress={onBack}><Text style={styles.link}>Torna all'accesso</Text></TouchableOpacity>
    </ScrollView>
  );
}
