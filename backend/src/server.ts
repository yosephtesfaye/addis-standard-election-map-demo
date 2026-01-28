import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Load real GeoJSON from local file
const geoJsonPath = path.join(__dirname, '../data/ethiopia-regions.geojson');
let regionsGeoJSON: any;

try {
  const rawData = fs.readFileSync(geoJsonPath, 'utf-8');
  regionsGeoJSON = JSON.parse(rawData);
  console.log(`Successfully loaded ${regionsGeoJSON.features.length} real Ethiopia regions from ${geoJsonPath}`);
} catch (err: any) {
  console.error('Failed to load GeoJSON file:', err.message);
  // Fallback mock (only if file is missing)
  regionsGeoJSON = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[[38.7, 9.0], [39.0, 9.0], [39.0, 9.3], [38.7, 9.3], [38.7, 9.0]]]
        },
        properties: { name_en: 'Addis Ababa', name_am: 'አዲስ አበባ' }
      }
    ]
  };
}

// Add mock election stats to each region
regionsGeoJSON.features = regionsGeoJSON.features.map((feature: any) => {
  const registered = Math.floor(Math.random() * 5000000) + 1000000;
  const valid = Math.floor(Math.random() * (registered * 0.9)) + Math.floor(registered * 0.5);
  return {
    ...feature,
    properties: {
      ...feature.properties,
      registered_voters: registered,
      valid_votes: valid,
      turnout_pct: registered > 0 ? (valid / registered) * 100 : 0,
      winner_party: ['Prosperity', 'Blue Party', 'Ezema', 'Independent'][Math.floor(Math.random() * 4)]
    }
  };
});

// API endpoint to serve regions
app.get('/api/regions', (req, res) => {
  res.json(regionsGeoJSON);
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});