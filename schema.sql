-- Locus AI — persistence schema (PostgreSQL; PostGIS optional but recommended)
-- Run: psql -d locus -f schema.sql

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS saved_locations (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    site_name VARCHAR(255) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    site_type VARCHAR(50),          -- 'Data Center', 'Logistics Hub', ...
    status VARCHAR(30) DEFAULT 'Prospect',
    feasibility_score INT,
    user_notes TEXT,
    saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_saved_locations_user ON saved_locations(user_id);

-- Seed analyst account used by the demo client
INSERT INTO users (id, username, email)
VALUES (1, 'jreyes', 'j.reyes@example.com')
ON CONFLICT (id) DO NOTHING;

-- Optional PostGIS upgrade (enables true spatial queries server-side):
-- CREATE EXTENSION IF NOT EXISTS postgis;
-- ALTER TABLE saved_locations ADD COLUMN geom geometry(Point, 4326)
--   GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)) STORED;
-- CREATE INDEX idx_saved_locations_geom ON saved_locations USING GIST (geom);
