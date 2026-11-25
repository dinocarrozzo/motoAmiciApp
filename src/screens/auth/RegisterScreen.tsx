import { useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { DEFAULT_AVATAR_ID } from '../../profile/avatars';
import { validateRegistration } from '../../profile/validation';
import { AvatarPicker } from '../profile/AvatarPicker';
import { Button, Check, Field, Notice, styles } from '../ui';

export type RegisterValues = { email: string; password: string; nickname: string; avatar: string };

export function RegisterScreen({ onRegister, onBack }: {
  onRegister: (v: RegisterValues) => Promise<void>;
  onBack: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState(DEFAULT_AVATAR_ID);
  const [isAdult, setIsAdult] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);

  const submit = async () => {
    if (sending.current) return; // niente doppio tocco
    const check = validateRegistration({ email, password, nickname, isAdult, acceptedPrivacy });
    setErrors(check.errors as Record<string, string>);
    setServerError(null);
    if (!check.ok) return;
    sending.current = true;
    setBusy(true);
    try {
      await onRegister({ email, password, nickname: nickname.trim(), avatar });
    } catch (e) {
      setServerError(e instanceof Error ? e.message : String(e));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Crea il tuo account</Text>
      {serverError ? <Notice text={serverError} /> : null}
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" error={errors.email} />
      <View>
        <Field label="Password (almeno 8 caratteri)" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoCapitalize="none" error={errors.password} />
        <TouchableOpacity onPress={() => setShowPassword((v) => !v)}>
          <Text style={styles.link}>{showPassword ? 'Nascondi la password' : 'Mostra la password'}</Text>
        </TouchableOpacity>
      </View>
      <Field label="Nickname (come ti vedranno gli altri)" value={nickname} onChangeText={setNickname} autoCapitalize="none" error={errors.nickname} />
      <Text style={styles.label}>Scegli il tuo avatar</Text>
      <AvatarPicker value={avatar} onChange={setAvatar} />
      <View style={{ height: 14 }} />
      <Check checked={isAdult} onToggle={() => setIsAdult((v) => !v)} error={errors.isAdult}>Ho almeno 18 anni</Check>
      <Check checked={acceptedPrivacy} onToggle={() => setAcceptedPrivacy((v) => !v)} error={errors.acceptedPrivacy}>
        Accetto l'informativa e che la mia posizione sia visibile agli altri motociclisti mentre sono in giro
      </Check>
      <Button title="Registrati" onPress={submit} busy={busy} />
      <TouchableOpacity onPress={onBack}><Text style={styles.link}>Ho già un account</Text></TouchableOpacity>
    </ScrollView>
  );
}
