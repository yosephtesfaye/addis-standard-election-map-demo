import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
});

function App() {
  const mapRef = useRef<L.Map | null>(null);
  const [regionsData, setRegionsData] = useState<any>(null);

  // Fetch GeoJSON from backend
  useEffect(() => {
    fetch('http://localhost:5000/api/regions')
      .then(res => res.json())
      .then(data => setRegionsData(data))
      .catch(err => console.error('Error fetching regions:', err));
  }, []);

  useEffect(() => {
    if (!regionsData) return;

    const map = L.map('map').setView([9.03, 38.74], 6);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    // Function to get color based on turnout
    const getColor = (turnout: number) => {
      return turnout > 80 ? '#800026' :
             turnout > 70 ? '#BD0026' :
             turnout > 60 ? '#E31A1C' :
             turnout > 50 ? '#FC4E2A' :
             turnout > 40 ? '#FD8D3C' : '#FFEDA0';
    };

    // Add choropleth layer
    L.geoJSON(regionsData, {
      style: (feature) => ({
        fillColor: getColor(feature?.properties.turnout_pct || 0),
        weight: 2,
        opacity: 1,
        color: 'white',
        fillOpacity: 0.7
      }),
      onEachFeature: (feature, layer) => {
        const props = feature.properties;
        layer.bindPopup(`
          <b>${props.name_en} (${props.name_am})</b><br>
          Registered: ${props.registered_voters.toLocaleString()}<br>
          Valid Votes: ${props.valid_votes.toLocaleString()}<br>
          Turnout: ${props.turnout_pct.toFixed(1)}%<br>
          Winner: ${props.winner_party}
        `);
      }
    }).addTo(map);

    return () => {
      map.remove();
    };
  }, [regionsData]);

  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <div id="map" style={{ height: '100%', width: '100%' }} />
      {!regionsData && <p>Loading election data...</p>}
    </div>
  );
}

export default App;