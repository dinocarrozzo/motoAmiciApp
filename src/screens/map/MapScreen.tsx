import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getRidersApi } from '../../api';
import { createRefreshLoop } from '../../friends/refreshLoop';
import { sameRiders } from '../../map/geojson';
import { createRidersFeed } from '../../map/useRiders';
import { REFRESH_RIDERS_MS, type Rider } from '../../map/types';
import { MapLegend } from './MapLegend';
import { RiderCard } from './RiderCard';
import { RidersMap } from './RidersMap';
import { TrackPanel } from './TrackPanel';

type LngLat = [number, number];

/** Posizione del telefono: l'ultima nota, altrimenti una lettura veloce (max 4 s). Null se non c'è permesso o posizione. */
async function findMe(): Promise<LngLat | null> {
  try {
    const p = await Location.getForegroundPermissionsAsync();
    if (!p.granted) return null;
    const last = await Location.getLastKnownPositionAsync();
    if (last) return [last.coords.longitude, last.coords.latitude];
    const now = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((res) => setTimeout(() => res(null), 4000)),
    ]);
    return now ? [now.coords.longitude, now.coords.latitude] : null;
  } catch {
    return null;
  }
}

/** Mappa a schermo intero: vedi gli altri senza dover condividere la tua posizione. */
export function MapScreen({ active }: { active: boolean }) {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false); // la mappa si apre solo dopo aver cercato la tua posizione
  const [start, setStart] = useState<LngLat | null>(null);
  const [showUser, setShowUser] = useState(false);
  const [recenter, setRecenter] = useState<{ at: LngLat; n: number } | null>(null);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const looked = useRef(false);

  const feed = useMemo(
    () =>
      createRidersFeed({
        fetch: (box) => getRidersApi().inArea(box),
        onRiders: (r) => {
          setRiders((old) => (sameRiders(old, r) ? old : r));
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

  // Alla prima apertura: cerca dove sei, poi apri la mappa su un'area di circa 100 km di raggio.
  useEffect(() => {
    if (!active || looked.current) return;
    looked.current = true;
    findMe().then((me) => {
      setStart(me);
      setShowUser(me !== null);
      setReady(true);
    });
  }, [active]);

  const onRecenter = async () => {
    const me = await findMe();
    if (me) {
      setShowUser(true);
      setRecenter((r) => ({ at: me, n: (r?.n ?? 0) + 1 }));
    } else {
      setError('Non riesco a trovare la tua posizione. Controlla che il GPS sia acceso e il permesso concesso.');
    }
  };

  const onBounds = useCallback((b: Parameters<typeof feed.setBox>[0]) => feed.setBox(b), [feed]);
  const selected = useMemo(() => riders.find((r) => r.id === selectedId) ?? null, [riders, selectedId]);

  return (
    <View style={s.root}>
      {ready ? (
        <RidersMap
          riders={riders}
          onBoundsChange={onBounds}
          onSelect={setSelectedId}
          showUser={showUser}
          start={start}
          recenter={recenter}
          onMapError={() => setError('Non riesco a caricare la mappa. Controlla la connessione.')}
        />
      ) : (
        <View style={s.loading}>
          <Text>Cerco la tua posizione…</Text>
        </View>
      )}
      {error ? (
        <View style={s.error} pointerEvents="none">
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : null}
      <View style={s.legend} pointerEvents="none">
        <MapLegend />
      </View>
      <TouchableOpacity style={s.recenter} onPress={onRecenter} accessibilityLabel="Ricentra sulla mia posizione">
        <View style={s.target}>
          <View style={s.targetDot} />
        </View>
      </TouchableOpacity>
      <View style={s.bottom}>
        {selected ? (
          <View style={s.cardWrap}>
            <RiderCard rider={selected} onClose={() => setSelectedId(null)} />
          </View>
        ) : null}
        <TrackPanel />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e2e8f0' },
  error: { position: 'absolute', top: 50, left: 16, right: 16, backgroundColor: '#fee2e2', padding: 10, borderRadius: 8 },
  errorText: { color: '#991b1b', fontSize: 14 },
  legend: { position: 'absolute', left: 10, top: 110 },
  recenter: {
    position: 'absolute', right: 12, top: 110, width: 46, height: 46, borderRadius: 23, backgroundColor: 'white',
    alignItems: 'center', justifyContent: 'center', elevation: 5, shadowOpacity: 0.25, shadowRadius: 4,
  },
  target: { width: 22, height: 22, borderRadius: 11, borderWidth: 2.5, borderColor: '#1d4ed8', alignItems: 'center', justifyContent: 'center' },
  targetDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1d4ed8' },
  cardWrap: { marginHorizontal: 12, marginBottom: 8 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
