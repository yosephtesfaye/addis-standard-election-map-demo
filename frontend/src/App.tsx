import { useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon paths (important for Leaflet in Vite)
delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
});

function App() {
  useEffect(() => {
    // Initialize the map
    const map = L.map('map').setView([9.03, 38.74], 6); // Center on Ethiopia, zoom level 6

    // Add free OpenStreetMap tiles (no token, no signup needed)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(map);

    // Add a sample marker for Addis Ababa
    L.marker([9.03, 38.74])
      .addTo(map)
      .bindPopup('<b>Addis Ababa</b><br>Mock polling station example')
      .openPopup();

    // Optional: Add a simple circle example (e.g., 5km radius around Addis)
    L.circle([9.03, 38.74], {
      color: 'red',
      fillColor: '#f03',
      fillOpacity: 0.2,
      radius: 5000, // 5 km
    }).addTo(map).bindPopup('5 km radius example');

    // Cleanup when component unmounts
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