import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { getProfilesApi } from '../../api';
import { DEFAULT_AVATAR_ID } from '../../profile/avatars';
import { validateProfileForm, type ProfileForm } from '../../profile/profileForm';
import type { BikeType, Gender } from '../../profile/types';
import { Button, colors, Field, Notice, styles } from '../ui';
import { AvatarPicker } from './AvatarPicker';

const GENDERS: { id: Gender; label: string }[] = [
  { id: 'm', label: 'Uomo' },
  { id: 'f', label: 'Donna' },
  { id: 'x', label: 'Preferisco non dirlo' },
];
const BIKES: { id: BikeType; label: string }[] = [
  { id: 'stradale-sportiva', label: 'Stradale sportiva' },
  { id: 'custom', label: 'Custom' },
  { id: 'naked', label: 'Naked' },
  { id: 'enduro', label: 'Enduro' },
  { id: 'maxienduro', label: 'Maxi enduro' },
];

const empty: ProfileForm = {
  nickname: '', displayName: '', gender: 'x', avatar: DEFAULT_AVATAR_ID, bikeType: null, contactName: '', contactPhone: '',
};

function Choice({ selected, label, onPress }: { selected: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ paddingVertical: 8 }}>
      <Text style={{ fontSize: 16, color: selected ? colors.primary : '#111' }}>{selected ? '◉ ' : '○ '}{label}</Text>
    </TouchableOpacity>
  );
}

export function ProfileEditScreen({ onSaved, onSignOut }: { onSaved: () => void; onSignOut: () => void }) {
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [hadContact, setHadContact] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);

  useEffect(() => {
    const api = getProfilesApi();
    Promise.all([api.getMyProfile(), api.getEmergencyContact()])
      .then(([p, c]) => {
        setHadContact(!!c);
        setForm({
          ...empty,
          nickname: p?.nickname ?? '',
          displayName: p?.displayName ?? '',
          gender: p?.gender ?? 'x',
          avatar: p?.avatar ?? DEFAULT_AVATAR_ID,
          bikeType: p?.bikeType ?? null,
          contactName: c?.name ?? '',
          contactPhone: c?.phone ?? '',
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (!form) {
    return (
      <View style={[styles.screen, { alignItems: 'center' }]}>
        {error ? <Notice text={error} /> : <ActivityIndicator size="large" />}
      </View>
    );
  }
  const set = <K extends keyof ProfileForm>(k: K, v: ProfileForm[K]) => {
    setSaved(false);
    setForm({ ...form, [k]: v });
  };

  const submit = async () => {
    if (sending.current) return;
    const r = validateProfileForm(form);
    setErrors(r.errors);
    setError(null);
    if (!r.ok || !r.value) return;
    sending.current = true;
    setBusy(true);
    try {
      const api = getProfilesApi();
      await api.saveProfile(r.value.profile);
      if (r.value.contact) await api.saveEmergencyContact(r.value.contact);
      else if (hadContact) await api.clearEmergencyContact();
      setHadContact(!!r.value.contact);
      setSaved(true);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Il tuo profilo</Text>
      {error ? <Notice text={error} /> : null}
      {saved ? <Notice kind="info" text="Profilo salvato." /> : null}
      <Field label="Nickname" value={form.nickname} onChangeText={(v) => set('nickname', v)} autoCapitalize="none" error={errors.nickname} />
      <Field label="Nome (facoltativo)" value={form.displayName} onChangeText={(v) => set('displayName', v)} error={errors.displayName} />
      <Text style={styles.label}>Avatar</Text>
      <AvatarPicker value={form.avatar} onChange={(v) => set('avatar', v)} />
      {errors.avatar ? <Text style={styles.error}>{errors.avatar}</Text> : null}
      <View style={{ height: 14 }} />
      <Text style={styles.label}>Sesso (decide il colore del tuo segnaposto)</Text>
      {GENDERS.map((g) => <Choice key={g.id} selected={form.gender === g.id} label={g.label} onPress={() => set('gender', g.id)} />)}
      <View style={{ height: 8 }} />
      <Text style={styles.label}>Che moto hai?</Text>
      {BIKES.map((b) => <Choice key={b.id} selected={form.bikeType === b.id} label={b.label} onPress={() => set('bikeType', b.id)} />)}
      <Choice selected={form.bikeType === null} label="Non lo dico" onPress={() => set('bikeType', null)} />
      <View style={{ height: 12 }} />
      <Text style={styles.label}>Contatto fidato per le emergenze</Text>
      <Text style={styles.subtitle}>Se premi il tasto di emergenza, riceverà un messaggio con la tua posizione. Solo tu vedi questo numero.</Text>
      <Field label="Nome del contatto" value={form.contactName} onChangeText={(v) => set('contactName', v)} error={errors.contactName} />
      <Field label="Numero di telefono" value={form.contactPhone} onChangeText={(v) => set('contactPhone', v)} keyboardType="phone-pad" error={errors.contactPhone} />
      <Button title="Salva" onPress={submit} busy={busy} />
      <Button title="Esci dall'account" onPress={onSignOut} variant="secondary" />
    </ScrollView>
  );
}
