import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { getFriendsApi } from '../../api';
import { createFriendSearch } from '../../friends/useFriendSearch';
import type { ProfileSummary } from '../../profile/types';
import { colors, styles } from '../ui';

/** Barra di ricerca: i suggerimenti compaiono mentre si scrive. Le righe le disegna chi la usa. */
export function SearchBar({ onResults, onActive }: { onResults: (r: ProfileSummary[]) => void; onActive: (active: boolean) => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const search = useMemo(
    () =>
      createFriendSearch({
        search: async (q) => {
          setLoading(true);
          try {
            return await getFriendsApi().search(q);
          } finally {
            setLoading(false);
          }
        },
        onResults,
        onError: setError,
      }),
    [onResults],
  );
  useEffect(() => () => search.dispose(), [search]);

  return (
    <View>
      <TextInput
        value={text}
        onChangeText={(v) => {
          setText(v);
          setError(null);
          onActive(v.trim().length > 0);
          search.type(v);
        }}
        placeholder="Cerca un amico per nickname o nome"
        placeholderTextColor="#94a3b8"
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, { marginBottom: 6 }]}
      />
      {loading ? <ActivityIndicator style={{ marginVertical: 4 }} /> : null}
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      {text.trim().length === 1 ? <Text style={{ color: colors.muted, fontSize: 13 }}>Scrivi almeno 2 lettere</Text> : null}
    </View>
  );
}
