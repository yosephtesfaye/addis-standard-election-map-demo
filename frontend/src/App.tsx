import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons for Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
});

function App() {
  const mapRef = useRef<L.Map | null>(null); // Ref to store map instance

  useEffect(() => {
    // Only initialize if map container exists and map not already created
    const mapContainer = document.getElementById('map');
    if (!mapContainer || mapRef.current) return;

    // Create map
    mapRef.current = L.map('map', {
      center: [9.03, 38.74], // Ethiopia center (Addis)
      zoom: 6,
      zoomControl: true,
    });

    // Add free OSM tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(mapRef.current);

    // Marker in Addis Ababa
    L.marker([9.03, 38.74])
      .addTo(mapRef.current)
      .bindPopup('<b>Addis Ababa</b><br>Mock polling station<br>Lat: 9.03, Lon: 38.74')
      .openPopup();

    // Red 5km circle example
    L.circle([9.03, 38.74], {
      color: 'red',
      fillColor: '#f03',
      fillOpacity: 0.2,
      radius: 5000,
    }).addTo(mapRef.current).bindPopup('5 km radius around Addis');

    // Cleanup on unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div style={{ height: '100vh', width: '100vw', position: 'relative' }}>
      <div 
        id="map" 
        style={{ 
          height: '100%', 
          width: '100%', 
          position: 'absolute', 
          top: 0, 
          left: 0 
        }} 
      />
    </div>
  );
}

export default App;