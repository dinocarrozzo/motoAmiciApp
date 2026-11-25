import { useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { DEFAULT_AVATAR_ID } from '../../profile/avatars';
import type { Gender } from '../../profile/types';
import { validateNickname } from '../../profile/validation';
import { Button, Field, Notice, styles } from '../ui';
import { AvatarPicker } from './AvatarPicker';

const GENDERS: { id: Gender; label: string }[] = [
  { id: 'm', label: 'Uomo' },
  { id: 'f', label: 'Donna' },
  { id: 'x', label: 'Preferisco non dirlo' },
];

/** Schermata minima per completare un profilo mancante (es. registrazione chiusa a metà o nickname già preso). */
export function ProfileSetupScreen({ notice, onSave, onSignOut }: {
  notice?: string | null;
  onSave: (v: { nickname: string; avatar: string; gender: Gender }) => Promise<void>;
  onSignOut: () => void;
}) {
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState(DEFAULT_AVATAR_ID);
  const [gender, setGender] = useState<Gender>('x');
  const [error, setError] = useState<string | null>(notice ?? null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);

  const submit = async () => {
    if (sending.current) return;
    const n = validateNickname(nickname);
    if (!n.ok) return setError(n.error);
    sending.current = true;
    setBusy(true);
    setError(null);
    try {
      await onSave({ nickname: n.value, avatar, gender });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Completa il profilo</Text>
      <Text style={styles.subtitle}>Ancora un passo prima di iniziare.</Text>
      {error ? <Notice text={error} /> : null}
      <Field label="Nickname" value={nickname} onChangeText={setNickname} autoCapitalize="none" />
      <Text style={styles.label}>Avatar</Text>
      <AvatarPicker value={avatar} onChange={setAvatar} />
      <View style={{ height: 14 }} />
      <Text style={styles.label}>Sesso (decide il colore del tuo segnaposto)</Text>
      {GENDERS.map((g) => (
        <TouchableOpacity key={g.id} onPress={() => setGender(g.id)} style={{ paddingVertical: 8 }}>
          <Text style={{ fontSize: 16 }}>{gender === g.id ? '◉ ' : '○ '}{g.label}</Text>
        </TouchableOpacity>
      ))}
      <Button title="Salva" onPress={submit} busy={busy} />
      <TouchableOpacity onPress={onSignOut}><Text style={styles.link}>Esci</Text></TouchableOpacity>
    </ScrollView>
  );
}
