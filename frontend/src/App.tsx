import { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet marker icons for Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
});

function App() {
  const mapRef = useRef<L.Map | null>(null);
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);
  const [regionsData, setRegionsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string>('');

  // Fetch data from backend
  useEffect(() => {
    fetch('http://localhost:5000/api/regions')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load regions data');
        return res.json();
      })
      .then(data => {
        setRegionsData(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Initialize map and add layers
  useEffect(() => {
    if (!regionsData || mapRef.current) return;

    const map = L.map('map').setView([9.03, 38.74], 6);
    mapRef.current = map;

    // Base tiles (free OSM)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Choropleth color scale
    const getColor = (pct: number) => {
      return pct > 80 ? '#800026' :
             pct > 70 ? '#BD0026' :
             pct > 60 ? '#E31A1C' :
             pct > 50 ? '#FC4E2A' :
             pct > 40 ? '#FD8D3C' : '#FFEDA0';
    };

    // Add GeoJSON layer with real boundaries
    geoJsonLayerRef.current = L.geoJSON(regionsData, {
      style: (feature) => ({
        fillColor: getColor(feature?.properties?.turnout_pct || 0),
        weight: 2,
        opacity: 1,
        color: 'white',
        fillOpacity: 0.7
      }),
      onEachFeature: (feature, layer) => {
        const p = feature.properties;
        layer.bindPopup(`
          <b>${p.name_en} (${p.name_am || 'N/A'})</b><br>
          Registered Voters: ${p.registered_voters?.toLocaleString() || 'N/A'}<br>
          Valid Votes: ${p.valid_votes?.toLocaleString() || 'N/A'}<br>
          Turnout: ${p.turnout_pct?.toFixed(1) || 'N/A'}%<br>
          Winner: ${p.winner_party || 'N/A'}
        `);
      }
    }).addTo(map);

    const bounds = geoJsonLayerRef.current.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [20, 20] });
    }

    // Legend (bottom-right)
    const legend = new L.Control({ position: 'bottomright' });
    legend.onAdd = () => {
      const div = L.DomUtil.create('div', 'info legend');
      div.innerHTML = `
        <h4>Turnout %</h4>
        <i style="background:#800026"></i> >80%<br>
        <i style="background:#BD0026"></i> 70–80%<br>
        <i style="background:#E31A1C"></i> 60–70%<br>
        <i style="background:#FC4E2A"></i> 50–60%<br>
        <i style="background:#FD8D3C"></i> 40–50%<br>
        <i style="background:#FFEDA0"></i> <40%
      `;
      return div;
    };
    legend.addTo(map);

    // Region filter (top-right)
    const filterControl = new L.Control({ position: 'topright' });
    filterControl.onAdd = () => {
      const div = L.DomUtil.create('div', 'filter-control');
      div.innerHTML = `
        <label>Filter Region:</label>
        <select id="regionFilter">
          <option value="">All Regions</option>
          ${regionsData.features.map((f: any) => `<option value="${f.properties.name_en}">${f.properties.name_en}</option>`).join('')}
        </select>
      `;
      L.DomEvent.on(div.querySelector('#regionFilter')!, 'change', (e) => {
        setSelectedRegion((e.target as HTMLSelectElement).value);
      });
      return div;
    };
    filterControl.addTo(map);

    return () => {
      legend.remove();
      filterControl.remove();
      if (mapRef.current) mapRef.current.remove();
    };
  }, [regionsData]);

  // Apply filter without re-creating the map (prevents blinking)
  useEffect(() => {
    if (!regionsData || !geoJsonLayerRef.current) return;
    geoJsonLayerRef.current.clearLayers();
    geoJsonLayerRef.current.addData(
      regionsData.features.filter(
        (f: any) => !selectedRegion || f.properties.name_en === selectedRegion
      )
    );
  }, [regionsData, selectedRegion]);

  return (
    <div style={{ height: '100vh', width: '100vw', position: 'relative' }}>

      {/* Title/Header – top-left */}
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 1000, background: 'white', padding: '10px 20px', borderRadius: '8px', boxShadow: '0 0 10px rgba(0,0,0,0.3)' }}>
        <h2 style={{ margin: 0, fontSize: '20px' }}>2026 Election Map Prototype</h2>
        <p style={{ margin: '5px 0 0', fontSize: '14px' }}>Addis Standard Demo</p>
      </div>

      {/* Map container */}
      <div id="map" style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0 }} />

      {/* Loading / error */}
      {loading && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '20px', borderRadius: '8px' }}>
        Loading accurate Ethiopia regions...
      </div>}
      {error && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'white', color: 'red', padding: '20px', borderRadius: '8px', boxShadow: '0 0 10px rgba(0,0,0,0.5)' }}>
        Error: {error}
      </div>}
    </div>
  );
}

export default App;