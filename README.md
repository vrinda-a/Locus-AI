<div align="center">

# ◎ LOCUS AI

**Infrastructure site-selection intelligence, on open data.**

A dense geospatial analytics workstation for institutional site selection —
data centers, shipping, and logistics — built on Leaflet, satellite imagery,
and free federal open-data feeds.

`Leaflet 1.9` · `Esri World Imagery` · `HIFLD` · `FEMA NFHL` · `OSM Overpass` · `Node + PostgreSQL`

</div>

---

## What it does

Locus AI puts twelve infrastructure and risk layers on a single satellite canvas, then scores any point you click on a 0–100 feasibility scale. Click a parcel, and it computes distance-decay proximity to substations, transmission corridors, Class I rail, and air/marine freight hubs — then subtracts for flood exposure using true point-in-polygon checks against FEMA's Special Flood Hazard Areas. Promising sites get saved to a persistent registry with notes, status, and one-click fly-to.

It is one HTML file. No build step, no framework install. Open it and it works.

```
+-----------------------------------------------------------------------+
|  ◎ LOCUS   project ▾        sources online · features indexed · user  |
+-------------------+-------------------------------+-------------------+
|  01 Power & Grid  |                               | A Feature         |
|  02 Logistics     |      Esri Satellite Canvas    |   Inspector       |
|  03 Risk          |      + 12 vector layers       | B Locus Score /100|
|  04 Spatial Query |      + marker clustering      | C Saved Sites     |
+-------------------+-------------------------------+-------------------+
```

## Features

- **Twelve toggleable layers** organized into Power & Grid, Logistics & Freight, and Risk & Constraints, each with live per-layer feature counts and feed-status indicators
- **Viewport-bounded queries** — every ArcGIS pull is clipped to the current map bounds with a record cap, and refetches automatically when the map settles. Pan anywhere in the US and the layers follow
- **Voltage filtering** — a live slider hides transmission lines below your kV floor (default 115 kV)
- **Locus Scoring System** — a five-factor weighted model rendered on a segmented gauge with a full dependency breakdown (see [The scoring model](#the-scoring-model))
- **Custom spatial query tool** — "show substations ≥ X kV, buffer them at Y miles, exclude the 100-year floodplain" — then flags every saved site pass/fail against your criteria
- **Feature inspector** — click any substation, line, plant, port, or warehouse to parse its raw API attributes
- **Persistent site registry** — save scored candidates with type, status (Prospect / Under Review / Approved / Rejected), and free-form notes; clicking a saved site flies the map to it and re-scores
- **Graceful degradation** — any feed that is unreachable falls back to a clearly labeled demo extract, so the app never renders blank

## Quick start

### Frontend only (30 seconds)

```bash
# any static server works — or just double-click the file
npx serve .            # then open http://localhost:3000/locus-ai.html
```

Saved sites live in memory in this mode (they reset on refresh). For durable storage, run the backend.

### Full stack (frontend + Postgres persistence)

```bash
npm init -y && npm install express pg cors

createdb locus
psql -d locus -f schema.sql

DATABASE_URL=postgres://localhost/locus node server.js
# → Locus API listening on :3001
```

Then point the client at the API by adding one line to `locus-ai.html`, just above the main `<script>`:

```html
<script>window.LOCUS_API_BASE = "http://localhost:3001";</script>
```

The storage adapter detects the API and switches to database mode automatically — the panel footer will read `DB: EXPRESS API`.

### Deploy

| Target | How |
|---|---|
| **Netlify Drop** | Rename to `index.html`, drag onto app.netlify.com/drop. Live in seconds. |
| **GitHub Pages** | Push as `index.html`, enable Pages in repo settings. |
| **Render / Railway** | Deploy `server.js` + a Postgres instance for the API, static file anywhere. Set `LOCUS_API_BASE` to the API's URL. |

> Hosting it un-sandboxed is the best version of the app: the live HIFLD, FEMA, and Overpass feeds fetch freely, so you see real infrastructure wherever you pan.

## Data sources

All feeds are free, public, and fetched client-side as GeoJSON.

| Layer | Source | Endpoint type |
|---|---|---|
| Transmission lines, substations, power plants | HIFLD Open | ArcGIS FeatureServer |
| Railroads, airports, marine ports | HIFLD Open | ArcGIS FeatureServer |
| Flood hazard zones (SFHA) | FEMA National Flood Hazard Layer, layer 28 | ArcGIS MapServer |
| Fault lines | USGS 2014 hazard faults | ArcGIS MapServer |
| Warehouses (`building=warehouse`), industrial zoning (`landuse=industrial`) | OpenStreetMap | Overpass API (POST, bbox-scoped) |
| Basemap + labels | Esri World Imagery / Boundaries & Places | XYZ tiles |
| Aquifer scarcity | Demo extract (no free national REST feed) | Bundled GeoJSON |

Feed status is shown per layer: `●` live, `◐` demo extract in use.

## The scoring model

Weights sum to 100. Proximity factors use linear distance decay — full credit inside the near radius, zero past the far radius.

| Factor | Weight | Full credit | Zero credit | Notes |
|---|---:|---|---|---|
| Grid proximity (substation) | 35 | ≤ 1.5 mi | ≥ 15 mi | 15% haircut if nearest substation < 230 kV |
| Transmission access | 15 | ≤ 1 mi | ≥ 12 mi | Respects the active kV floor |
| Rail service | 15 | ≤ 2 mi | ≥ 20 mi | |
| Air / marine access | 15 | ≤ 8 mi | ≥ 60 mi | Nearest of airports ∪ ports |
| Flood exposure | 20 | Outside SFHA | Inside SFHA | Point-in-polygon vs. loaded NFHL zones |

**Verdicts:** ≥ 75 Strong Candidate · 50–74 Conditional · < 50 Constrained.

The weights and decay curves live in one place (`WEIGHTS` and `computeScore` in `locus-ai.html`) and are meant to be tuned per asset class — a hyperscale data center search weights power differently than a cross-dock.

## API reference

`server.js` exposes four routes backed by the `saved_locations` table:

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/sites?userId=:id` | List a user's saved sites (hydrates the dashboard) |
| `POST` | `/api/sites` | Save a scored coordinate + notes payload |
| `PUT` | `/api/sites/:id` | Update name, type, status, score, or notes |
| `DELETE` | `/api/sites/:id` | Purge a site from the registry |

Schema is in `schema.sql`, including a commented PostGIS upgrade path (generated geometry column + GIST index) for server-side spatial queries.

## Project layout

```
locus-ai.html    the entire client — layout, map engine, data pipeline,
                 scoring, spatial query, storage adapter (~1,400 lines)
server.js        Express persistence API (4 routes, parameterized SQL)
schema.sql       Postgres schema + seed user + optional PostGIS block
```

## Engineering notes

- **Never pull nationally.** A `where=1=1` request against HIFLD transmission lines is hundreds of megabytes. Every query here sends an `esriGeometryEnvelope` of the current viewport plus `resultRecordCount=400`.
- **Storage adapter.** One async interface, three backends: Express API → persistent key-value storage (when embedded in an environment that provides `window.storage`) → in-memory. The active mode is displayed in the Saved Sites header.
- **Demo fallback is honest.** Fallback features are watermarked `DEMO EXTRACT` in the inspector and `◐` in the layer list — the app never passes sample data off as live.
- **No secrets.** Every endpoint is keyless and public; there is nothing to leak in a static deploy.

## Roadmap

- [ ] Fiber route layer (no free national feed yet; FCC broadband data as proxy)
- [ ] Drawn-polygon AOI scoring (score a parcel boundary, not a point)
- [ ] PDF site report export per saved candidate
- [ ] Multi-user auth in front of the Express API
- [ ] Next.js App Router port with server-side feed proxy + caching

## License & attribution

Application code: MIT. Imagery © Esri, Maxar, Earthstar Geographics. Infrastructure data via HIFLD Open and FEMA NFHL (public domain). Map data © OpenStreetMap contributors (ODbL). Verify all data against primary sources before making investment decisions — this is a screening tool, not a substitute for due diligence.

---

<div align="center"><sub>◎ Built for analysts who think in kilovolts and floodplains.</sub></div>
