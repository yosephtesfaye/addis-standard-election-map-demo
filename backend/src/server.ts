import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { authenticate, authorize } from './middleware/auth';

dotenv.config();

const defaultDbUrl = 'mysql://root:root@localhost:3306/addis';
const dbUrl = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('mysql://')
  ? process.env.DATABASE_URL
  : defaultDbUrl;
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'your-secret-key-change-this-in-production';
}

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET as string;

app.use(cors());
app.use(express.json());

type UserRole = 'REPORTER' | 'EDITOR' | 'ADMIN';

const pool = mysql.createPool(dbUrl);

const initDatabase = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(191) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role ENUM('REPORTER','EDITOR','ADMIN') NOT NULL DEFAULT 'REPORTER'
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS articles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      status ENUM('DRAFT','REVIEW','APPROVED') NOT NULL DEFAULT 'DRAFT',
      authorId INT NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_articles_author FOREIGN KEY (authorId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
};

initDatabase().catch((err) => {
  console.error('Database init failed:', err);
});

const statusOrder = ['DRAFT', 'REVIEW', 'APPROVED'] as const;
type ArticleStatus = typeof statusOrder[number];

const isValidStatus = (value: any): value is ArticleStatus => statusOrder.includes(value);
const canTransitionStatus = (current: ArticleStatus, next: ArticleStatus) => {
  const currentIndex = statusOrder.indexOf(current);
  return currentIndex >= 0 && statusOrder[currentIndex + 1] === next;
};

// ────────────────────────────────────────────────
// GeoJSON Loading & Normalization (Task 1)
// ────────────────────────────────────────────────

type Position = [number, number];

interface GeoJSONFeature {
  type: 'Feature';
  properties: Record<string, any>;
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: any[];
  };
  bbox?: [number, number, number, number];
}

interface GeoJSON {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
  bbox?: [number, number, number, number];
}

const geoJsonPath = path.join(__dirname, '../data/ethiopia-regions.geojson');
let regionsGeoJSON: GeoJSON;

// Name normalization map
const normalizeNameMap: Record<string, string> = {
  AddisAbeba: 'Addis Ababa',
  'Benshangul-Gumaz': 'Benishangul-Gumuz',
  DireDawa: 'Dire Dawa',
  GambelaPeoples: 'Gambela',
  HarariPeople: 'Harari',
  'SouthernNations,Nationalities': 'Southern Nations, Nationalities and Peoples',
};

// Flatten polygon coordinates
const flattenPolygonCoords = (coords: any[]): Position[] => {
  const positions: Position[] = [];
  for (const ring of coords || []) {
    for (const pos of ring || []) {
      if (Array.isArray(pos) && pos.length >= 2 && typeof pos[0] === 'number' && typeof pos[1] === 'number') {
        positions.push([pos[0], pos[1]]);
      }
    }
  }
  return positions;
};

// Collect all positions from geometry
const collectPositions = (geometry: any): Position[] => {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return flattenPolygonCoords(geometry.coordinates);
  if (geometry.type === 'MultiPolygon') {
    const positions: Position[] = [];
    for (const polygon of geometry.coordinates || []) {
      positions.push(...flattenPolygonCoords(polygon));
    }
    return positions;
  }
  return [];
};

// Compute bounding box
const computeBbox = (positions: Position[]): [number, number, number, number] | null => {
  if (!positions.length) return null;
  let minLng = Infinity, minLat = Infinity;
  let maxLng = -Infinity, maxLat = -Infinity;
  for (const [lng, lat] of positions) {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLng, minLat, maxLng, maxLat];
};

// Compute center from bbox
const computeCenter = (bbox: [number, number, number, number] | null): Position | null => {
  if (!bbox) return null;
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
};

// Normalize GeoJSON (add bbox, center, clean names)
const normalizeRegionsGeoJSON = (geojson: GeoJSON): GeoJSON => {
  if (!geojson?.features?.length) return geojson;

  const allPositions: Position[] = [];

  const features = geojson.features.map((feature: GeoJSONFeature) => {
    const props = feature.properties || {};
    const rawName = props.name_en || props.NAME_1 || props.name || 'Unknown';
    const nameEn = normalizeNameMap[rawName] || rawName;
    const iso = props.iso || props.HASC_1 || props.ISO_1 || null;
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
        center,
      },
    };
  });

  return {
    ...geojson,
    bbox: computeBbox(allPositions) || undefined,
    features,
  };
};

// Load GeoJSON from file
try {
  const rawData = fs.readFileSync(geoJsonPath, 'utf-8');
  const parsed = JSON.parse(rawData);
  regionsGeoJSON = normalizeRegionsGeoJSON(parsed);
  console.log(`Successfully loaded and normalized ${regionsGeoJSON.features.length} real Ethiopia regions from ${geoJsonPath}`);
} catch (err: any) {
  console.error('Failed to load GeoJSON file:', err.message);
  regionsGeoJSON = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[[38.7, 9.0], [39.0, 9.0], [39.0, 9.3], [38.7, 9.3], [38.7, 9.0]]],
        },
        properties: { name_en: 'Addis Ababa', name_am: 'አዲስ አበባ' },
      },
    ],
  };
}

// Add mock election stats
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
      winner_party: ['Prosperity', 'Blue Party', 'Ezema', 'Independent'][Math.floor(Math.random() * 4)],
    },
  };
});

// Regions API endpoint
app.get('/api/regions', (req, res) => {
  res.json(regionsGeoJSON);
});

// ────────────────────────────────────────────────
// Task 2: INMS Mini-Module – Auth & Articles
// ────────────────────────────────────────────────

// Register new user
app.post('/register', async (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password || !['REPORTER', 'EDITOR', 'ADMIN'].includes(role)) {
    return res.status(400).json({ error: 'Invalid input: username, password, and valid role required' });
  }

  const roleValue = role as UserRole;

  try {
    const [existingRows] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM users WHERE username = ?',
      [username],
    );
    if (existingRows.length) return res.status(409).json({ error: 'Username already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [username, hashedPassword, roleValue],
    );
    const userId = result.insertId;

    res.status(201).json({
      message: 'User registered',
      user: { id: userId, username, role: roleValue },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, username, password, role FROM users WHERE username = ?',
      [username],
    );
    const user = rows[0] as { id: number; username: string; password: string; role: UserRole } | undefined;
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });

    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// ────────────────────────────────────────────────
// Protected Article Routes
// ────────────────────────────────────────────────

// Create article (Reporter only)
app.post('/api/articles', authenticate, authorize(['REPORTER']), async (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Title and content required' });

  const user = (req as any).user;

  try {
    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO articles (title, content, status, authorId) VALUES (?, ?, ?, ?)',
      [title, content, 'DRAFT', user.id],
    );
    const articleId = result.insertId;
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, title, content, status, authorId, createdAt, updatedAt FROM articles WHERE id = ?',
      [articleId],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create article' });
  }
});

// List articles (all authenticated users)
app.get('/api/articles', authenticate, async (req, res) => {
  const status = req.query.status as string | undefined;
  if (status && !isValidStatus(status)) {
    return res.status(400).json({ error: 'Invalid status filter' });
  }

  try {
    const params: Array<string> = [];
    let sql = `
      SELECT a.id, a.title, a.content, a.status, a.authorId, a.createdAt, a.updatedAt,
             u.username AS authorUsername, u.role AS authorRole
      FROM articles a
      JOIN users u ON u.id = a.authorId
    `;
    if (status) {
      sql += ' WHERE a.status = ?';
      params.push(status);
    }
    const [rows] = await pool.query<RowDataPacket[]>(sql, params);
    const articles = rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      status: row.status,
      authorId: row.authorId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      author: { username: row.authorUsername, role: row.authorRole },
    }));
    res.json(articles);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list articles' });
  }
});

// Edit article (Reporter or Editor)
app.put('/api/articles/:id', authenticate, authorize(['REPORTER', 'EDITOR']), async (req, res) => {
  const id = Number(req.params.id);
  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Title and content required' });
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid article id' });

  try {
    const [result] = await pool.execute<ResultSetHeader>(
      'UPDATE articles SET title = ?, content = ? WHERE id = ?',
      [title, content, id],
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Article not found' });
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, title, content, status, authorId, createdAt, updatedAt FROM articles WHERE id = ?',
      [id],
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update article' });
  }
});

// Change status (Editor or Admin only)
app.put('/api/articles/:id/status', authenticate, authorize(['EDITOR', 'ADMIN']), async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid article id' });

  if (!isValidStatus(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, status FROM articles WHERE id = ?',
      [id],
    );
    const current = rows[0] as { id: number; status: ArticleStatus } | undefined;
    if (!current) return res.status(404).json({ error: 'Article not found' });
    if (!canTransitionStatus(current.status, status)) {
      return res.status(400).json({ error: `Invalid status transition: ${current.status} -> ${status}` });
    }
    await pool.execute<ResultSetHeader>(
      'UPDATE articles SET status = ? WHERE id = ?',
      [status, id],
    );
    const [updatedRows] = await pool.query<RowDataPacket[]>(
      'SELECT id, title, content, status, authorId, createdAt, updatedAt FROM articles WHERE id = ?',
      [id],
    );
    res.json(updatedRows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});