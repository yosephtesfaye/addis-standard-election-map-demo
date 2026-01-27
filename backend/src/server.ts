// backend/src/server.ts
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors()); // Allow frontend to connect
app.use(express.json());

// Mock GeoJSON data: 2 regions + fake votes
const mockRegionsGeoJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [38.7, 9.0], [39.0, 9.0], [39.0, 9.3], [38.7, 9.3], [38.7, 9.0]
          ]
        ]
      },
      properties: {
        name_en: 'Addis Ababa',
        name_am: 'አዲስ አበባ',
        registered_voters: 2500000,
        valid_votes: 1800000,
        turnout_pct: 72.0,
        winner_party: 'Prosperity'
      }
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [38.0, 8.0], [39.0, 8.0], [39.0, 8.5], [38.0, 8.5], [38.0, 8.0]
          ]
        ]
      },
      properties: {
        name_en: 'Oromia (Sample)',
        name_am: 'ኦሮሚያ (ምሳሌ)',
        registered_voters: 5000000,
        valid_votes: 3200000,
        turnout_pct: 64.0,
        winner_party: 'Opposition Coalition'
      }
    }
  ]
};

// API endpoint to get regions GeoJSON
app.get('/api/regions', (req, res) => {
  res.json(mockRegionsGeoJSON);
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});