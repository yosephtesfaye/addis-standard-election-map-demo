import { useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet marker icon paths for Vite (very important!)
delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
});

function App() {
  useEffect(() => {
    // Create the map instance
    const map = L.map('map').setView([9.03, 38.74], 6); // Center on Ethiopia (Addis Ababa coords)

    // Add free, public OpenStreetMap tiles (no token, no signup)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(map);

    // Add a marker for Addis Ababa with popup
    L.marker([9.03, 38.74])
      .addTo(map)
      .bindPopup('<b>Addis Ababa</b><br>Mock polling station example<br>Latitude: 9.03, Longitude: 38.74')
      .openPopup();

    // Add a simple circle (5 km radius around Addis) as a GIS example
    L.circle([9.03, 38.74], {
      color: 'red',
      fillColor: '#f03',
      fillOpacity: 0.2,
      radius: 5000, // 5 km in meters
    }).addTo(map).bindPopup('Example 5 km radius around Addis Ababa');

    // Cleanup when component unmounts (prevents memory leaks)
    return () => {
      map.remove();
    };
  }, []);

  return (
    <div style={{ height: '100vh', width: '100%' }}>
      <div id="map" style={{ height: '100%', width: '100%' }} />
    </div>
  );
}

export default App;