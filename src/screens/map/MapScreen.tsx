import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { getRidersApi } from '../../api';
import { createRefreshLoop } from '../../friends/refreshLoop';
import { createRidersFeed } from '../../map/useRiders';
import { REFRESH_RIDERS_MS, type Rider } from '../../map/types';
import { RiderCard } from './RiderCard';
import { RidersMap } from './RidersMap';
import { TrackPanel } from './TrackPanel';

/** Mappa a schermo intero: vedi gli altri senza dover condividere la tua posizione. */
export function MapScreen({ active }: { active: boolean }) {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [selected, setSelected] = useState<Rider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showUser, setShowUser] = useState(false);
  const [center, setCenter] = useState<[number, number] | null>(null);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');

  const feed = useMemo(
    () =>
      createRidersFeed({
        fetch: (box) => getRidersApi().inArea(box),
        onRiders: (r) => {
          setRiders(r);
          setError(null);
        },
        onError: (m) => setError(m),
      }),
    [],
  );
  const loop = useMemo(() => createRefreshLoop({ refresh: () => feed.refresh(), intervalMs: REFRESH_RIDERS_MS }), [feed]);
  useEffect(() => () => { loop.dispose(); feed.dispose(); }, [loop, feed]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => setAppActive(st === 'active'));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    loop.setActive(active && appActive);
  }, [loop, active, appActive]);

  // Il punto blu e il centro sulla tua posizione solo se il permesso c'è già; la mappa funziona anche senza.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    (async () => {
      try {
        const p = await Location.getForegroundPermissionsAsync();
        if (!p.granted || cancelled) return;
        setShowUser(true);
        const last = await Location.getLastKnownPositionAsync();
        if (last && !cancelled) setCenter((c) => c ?? [last.coords.longitude, last.coords.latitude]);
      } catch {
        // senza posizione la mappa si vede lo stesso
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active]);

  const onBounds = useCallback((b: Parameters<typeof feed.setBox>[0]) => feed.setBox(b), [feed]);

  return (
    <View style={s.root}>
      <RidersMap
        riders={riders}
        onBoundsChange={onBounds}
        onSelect={setSelected}
        showUser={showUser}
        center={center}
        onMapError={() => setError('Non riesco a caricare la mappa. Controlla la connessione.')}
      />
      {error ? (
        <View style={s.error} pointerEvents="none">
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : null}
      {selected ? (
        <View style={s.cardWrap}>
          <RiderCard rider={selected} onClose={() => setSelected(null)} />
        </View>
      ) : null}
      <View style={s.bottom}>
        <TrackPanel />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  error: { position: 'absolute', top: 50, left: 16, right: 16, backgroundColor: '#fee2e2', padding: 10, borderRadius: 8 },
  errorText: { color: '#991b1b', fontSize: 14 },
  cardWrap: { position: 'absolute', left: 12, right: 12, bottom: 130 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
