import { useMemo, useRef } from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

type Props = {
  latitude: number;
  longitude: number;
  label?: string;
  zoom?: number;
  style?: StyleProp<ViewStyle>;
  /**
   * When provided, the pin becomes draggable and tapping anywhere on the
   * map moves the pin there. Fires with the new coordinates on each gesture.
   */
  onChange?: (lat: number, lng: number) => void;
};

// Leaflet inside a WebView, themed to mimic Apple Maps Standard: CartoDB
// Voyager tiles (soft beige land, muted blue water, rounded labels), a custom
// SF-Symbols-ish pin, and a subtle dot under the pin for the "you are here"
// shadow. Works in Expo Go since there's no native module.
function buildHtml(
  lat: number,
  lng: number,
  label: string,
  zoom: number,
  draggable: boolean,
): string {
  const safeLabel = label.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #f3efe8; }
      .apl-pin {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: #ff3b30;
        border: 3px solid #fff;
        box-shadow: 0 2px 6px rgba(0,0,0,0.35);
        position: relative;
        transition: transform 120ms ease-out;
      }
      .apl-pin::after {
        content: '';
        position: absolute;
        left: 50%;
        top: 50%;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #fff;
        transform: translate(-50%, -50%);
      }
      .leaflet-marker-draggable .apl-pin { cursor: grab; }
      .leaflet-marker-dragging .apl-pin { transform: scale(1.25); cursor: grabbing; }
      .leaflet-popup-content-wrapper {
        border-radius: 10px;
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif;
        font-size: 13px;
        font-weight: 600;
      }
      .leaflet-popup-tip { box-shadow: none; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      const draggable = ${draggable ? 'true' : 'false'};
      const map = L.map('map', { zoomControl: false, attributionControl: false })
        .setView([${lat}, ${lng}], ${zoom});
      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        { subdomains: 'abcd', maxZoom: 19 }
      ).addTo(map);
      const pin = L.divIcon({
        className: '',
        html: '<div class="apl-pin"></div>',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -12],
      });
      const marker = L.marker([${lat}, ${lng}], { icon: pin, draggable: draggable })
        .addTo(map)
        .bindPopup(${JSON.stringify(safeLabel)});

      function notify(latlng) {
        try {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'move',
            lat: latlng.lat,
            lng: latlng.lng,
          }));
        } catch (e) {}
      }

      if (draggable) {
        marker.on('dragend', function (e) {
          notify(e.target.getLatLng());
        });
        // Tap-to-place: convenient when the pin isn't where you're looking.
        map.on('click', function (e) {
          marker.setLatLng(e.latlng);
          notify(e.latlng);
        });
      }
    </script>
  </body>
</html>`;
}

export function MapPin({
  latitude,
  longitude,
  label = 'Pickup',
  zoom = 14,
  style,
  onChange,
}: Props) {
  const draggable = !!onChange;
  // Only rebuild the HTML when the inputs change in a way that resets the
  // marker — dragging triggers onChange but parent state echoes the same
  // coords back, so we'd rebuild and lose the in-flight gesture without this
  // memoisation.
  const html = useMemo(
    () => buildHtml(latitude, longitude, label, zoom, draggable),
    [latitude, longitude, label, zoom, draggable],
  );

  const lastEmitted = useRef<{ lat: number; lng: number } | null>(null);

  function onMessage(e: WebViewMessageEvent) {
    if (!onChange) return;
    try {
      const parsed = JSON.parse(e.nativeEvent.data);
      if (parsed?.type !== 'move') return;
      const lat = Number(parsed.lat);
      const lng = Number(parsed.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      // Coalesce rapid duplicate events from the WebView.
      const prev = lastEmitted.current;
      if (prev && prev.lat === lat && prev.lng === lng) return;
      lastEmitted.current = { lat, lng };
      onChange(lat, lng);
    } catch {}
  }

  return (
    <View style={[styles.wrap, style]}>
      <WebView
        source={{ html }}
        originWhitelist={['*']}
        javaScriptEnabled
        scrollEnabled={false}
        style={styles.web}
        onMessage={draggable ? onMessage : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: '#f3efe8' },
  web: { flex: 1, backgroundColor: 'transparent' },
});
