# Note sull'API della mappa (@maplibre/maplibre-react-native 11.5.1)

Lette dai tipi installati (non a memoria).

- `Map` (`mapStyle`: URL stile o oggetto; `style`; `logo`, `attribution`; eventi `onRegionDidChange(e)` con `e.nativeEvent`: `{center, zoom, bearing, pitch, bounds, animated, userInteraction}`; `onDidFinishLoadingMap`).
- `bounds` è `LngLatBounds` = `[west, south, east, north]` (vedi `types/LngLatBounds.ts`).
- `Camera` dentro `Map`: `initialViewState` (centro/zoom), `trackUserLocation`, ref con `flyTo/easeTo/jumpTo({center:[lng,lat], zoom})`.
- `ViewAnnotation` (`lngLat`, `anchor`, `onPress`; un solo figlio React) per i segnaposto.
- `UserLocation` per il punto blu dell'utente (richiede il permesso di posizione).
- Plugin Expo: `"@maplibre/maplibre-react-native"` in `app.json`.
- Stile: `https://tiles.openfreemap.org/styles/liberty` (da confermare sul telefono).
