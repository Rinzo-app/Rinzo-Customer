import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

interface Coord {
  lat: number;
  lng: number;
}

/**
 * A lightweight live map showing the rider's current position and the
 * customer's location, drawn with Leaflet + OpenStreetMap inside a
 * WebView (no Google Maps API key, no native map SDK). The parent
 * re-renders this with fresh rider coords as the order is polled.
 */
export function RiderMap({ rider, dest }: { rider: Coord; dest: Coord }) {
  const html = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>html,body,#map{height:100%;margin:0;background:#12151D}</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var rider=[${rider.lat},${rider.lng}], dest=[${dest.lat},${dest.lng}];
  var map=L.map('map',{zoomControl:false,attributionControl:false});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
  L.polyline([rider,dest],{color:'#10B981',weight:3,dashArray:'6,8'}).addTo(map);
  L.circleMarker(dest,{radius:8,color:'#fff',weight:2,fillColor:'#EF4444',fillOpacity:1}).addTo(map);
  L.circleMarker(rider,{radius:9,color:'#fff',weight:2,fillColor:'#2563EB',fillOpacity:1}).addTo(map).bindTooltip('Rider',{permanent:false});
  try { map.fitBounds([rider,dest],{padding:[36,36],maxZoom:16}); } catch(e){ map.setView(rider,14); }
</script>
</body>
</html>`;

  return (
    <View style={styles.wrap}>
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        style={styles.web}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
        // Keying on coords forces a reload when the rider moves.
        key={`${rider.lat.toFixed(5)},${rider.lng.toFixed(5)}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 180,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#12151D",
  },
  web: { flex: 1, backgroundColor: "transparent" },
});
