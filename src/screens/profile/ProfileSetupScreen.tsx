import { useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { DEFAULT_AVATAR_ID } from '../../profile/avatars';
import type { BikeType, Gender, Profile } from '../../profile/types';
import { validateNickname } from '../../profile/validation';
import { Button, Field, Notice, styles } from '../ui';
import { AvatarPicker } from './AvatarPicker';
import { GenderAndBike } from './ProfileChoices';

export type SetupValues = { nickname: string; avatar: string; gender: Gender; bikeType: BikeType };

/**
 * Completa un profilo mancante o incompleto (registrazione chiusa a metà, nickname già preso,
 * account creato prima che sesso e moto fossero obbligatori). Se c'è già un profilo, parte dai suoi dati.
 */
export function ProfileSetupScreen({ initial, notice, onSave, onSignOut }: {
  initial: Profile | null;
  notice?: string | null;
  onSave: (v: SetupValues) => Promise<void>;
  onSignOut: () => void;
}) {
  const [nickname, setNickname] = useState(initial?.nickname ?? '');
  const [avatar, setAvatar] = useState(initial?.avatar ?? DEFAULT_AVATAR_ID);
  const [gender, setGender] = useState<Gender | null>(initial?.gender ?? null);
  const [bikeType, setBikeType] = useState<BikeType | null>(initial?.bikeType ?? null);
  const [errors, setErrors] = useState<{ gender?: string; bikeType?: string }>({});
  const [error, setError] = useState<string | null>(notice ?? null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);

  const submit = async () => {
    if (sending.current) return;
    const n = validateNickname(nickname);
    const e: { gender?: string; bikeType?: string } = {};
    if (!gender) e.gender = "Scegli un'opzione";
    if (!bikeType) e.bikeType = 'Scegli il tipo di moto';
    setErrors(e);
    if (!n.ok) return setError(n.error);
    if (!gender || !bikeType) return setError(null);
    sending.current = true;
    setBusy(true);
    setError(null);
    try {
      await onSave({ nickname: n.value, avatar, gender, bikeType });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Completa il profilo</Text>
      <Text style={styles.subtitle}>Mancano ancora un paio di dati prima di iniziare.</Text>
      {error ? <Notice text={error} /> : null}
      <Field label="Nickname" value={nickname} onChangeText={setNickname} autoCapitalize="none" />
      <Text style={styles.label}>Avatar</Text>
      <AvatarPicker value={avatar} onChange={setAvatar} />
      <View style={{ height: 14 }} />
      <GenderAndBike gender={gender} bikeType={bikeType} onGender={setGender} onBike={setBikeType} errors={errors} />
      <Button title="Salva" onPress={submit} busy={busy} />
      <TouchableOpacity onPress={onSignOut}><Text style={styles.link}>Esci</Text></TouchableOpacity>
    </ScrollView>
  );
}
