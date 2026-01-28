# Addis Standard Election Map Demo (Task 1)

Prototype for GIS & Software Developer position at Addis Standard.

## Features
- Leaflet.js with free OSM tiles
- Real Ethiopia regions (11 regions) loaded from local GeoJSON via REST API
- Choropleth coloring by mock turnout %
- Clickable popups with region name, voters, votes, turnout %, winner
- Region filter dropdown (bonus)
- Legend for color scale (bonus)
- INMS mini-module: auth + role-based article workflow (Task 2)

## How to Run
1. Backend
   cd backend
   npm install
  Create `backend/.env` with MySQL settings:
  DATABASE_URL=mysql://addis:addis123@localhost:3306/addis
  JWT_SECRET=your-secret-key-change-this-in-production
  PORT=5000
  Create the database if it does not exist:
  CREATE DATABASE addis;
  npm run dev
  → Tables are created automatically on first run.
   → API: http://localhost:5000/api/regions
   → Auth: POST /register, POST /login
   → Articles: GET/POST /api/articles, PUT /api/articles/:id, PUT /api/articles/:id/status

2. Frontend
   cd frontend
   npm install
   npm run dev
   → Map: http://localhost:5173

## Screenshot
![Election Map](screenshot.png)  <!-- Add screenshot here -->

## Notes
- Mock election data used (allowed)
- No paid services (Mapbox token not needed)
- Article workflow statuses: DRAFT → REVIEW → APPROVED