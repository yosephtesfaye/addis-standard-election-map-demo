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

type Position = [number, number];

// Path to GeoJSON file
const geoJsonPath = path.join(__dirname, '../data/ethiopia-regions.geojson');
let regionsGeoJSON: any;

const normalizeNameMap: Record<string, string> = {
  AddisAbeba: 'Addis Ababa',
  'Benshangul-Gumaz': 'Benishangul-Gumuz',
  DireDawa: 'Dire Dawa',
  GambelaPeoples: 'Gambela',
  HarariPeople: 'Harari',
  'SouthernNations,Nationalities': 'Southern Nations, Nationalities and Peoples'
};

const flattenPolygonCoords = (coords: any): Position[] => {
  const positions: Position[] = [];
  for (const ring of coords || []) {
    for (const pos of ring || []) {
      if (Array.isArray(pos) && pos.length >= 2) {
        positions.push([pos[0], pos[1]]);
      }
    }
  }
  return positions;
};

const collectPositions = (geometry: any): Position[] => {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') {
    return flattenPolygonCoords(geometry.coordinates);
  }
  if (geometry.type === 'MultiPolygon') {
    const positions: Position[] = [];
    for (const polygon of geometry.coordinates || []) {
      positions.push(...flattenPolygonCoords(polygon));
    }
    return positions;
  }
  return [];
};

const computeBbox = (positions: Position[]): [number, number, number, number] | null => {
  if (!positions.length) return null;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of positions) {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLng, minLat, maxLng, maxLat];
};

const computeCenter = (bbox: [number, number, number, number] | null): Position | null => {
  if (!bbox) return null;
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
};

const normalizeRegionsGeoJSON = (geojson: any) => {
  if (!geojson?.features?.length) return geojson;
  const allPositions: Position[] = [];

  const features = geojson.features.map((feature: any) => {
    const props = feature.properties || {};
    const rawName = props.name_en || props.NAME_1 || props.name || 'Unknown';
    const nameEn = normalizeNameMap[rawName] || rawName;
    const iso =
      props.iso ||
      (props.HASC_1 ? String(props.HASC_1).replace('.', '-') : props.ISO_1 || null);
    const positions = collectPositions(feature.geometry);
    const bbox = computeBbox(positions);
    const center = computeCenter(bbox);
    allPositions.push(...positions);

    return {
      ...feature,
      bbox: bbox || undefined,
      properties: {
        ...props,
        name_en: nameEn,
        name_am: props.name_am || null,
        iso,
        center
      }
    };
  });

  return {
    ...geojson,
    bbox: computeBbox(allPositions) || undefined,
    features
  };
};

try {
  const rawData = fs.readFileSync(geoJsonPath, 'utf-8');
  regionsGeoJSON = normalizeRegionsGeoJSON(JSON.parse(rawData));
  console.log(`Successfully loaded ${regionsGeoJSON.features.length} real Ethiopia regions from ${geoJsonPath}`);
} catch (err: any) {
  console.error('Failed to load GeoJSON file:', err.message);
  // Fallback - only used if file is missing (remove this in production)
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

// API endpoint
app.get('/api/regions', (req, res) => {
  res.json(regionsGeoJSON);
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});