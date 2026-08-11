# Pet Place Malaysia

A mobile-friendly web app for discovering pet-friendly places in Malaysia. Data is crowd-sourced and imported from a CSV dataset. Users can browse places on an interactive map, search by name or area, filter by state and category, share their GPS location to find nearby spots, and submit new places for review.

---

## Features

- **Interactive map** — OpenStreetMap tiles with marker clustering; loads only the places visible in the current viewport
- **Search & filter** — Search by name, area, or address; filter by state, category, and seating type
- **Nearby search** — Uses the browser Geolocation API + PostGIS radius query to find places within a configurable radius
- **Submit a place** — Users can submit new places via a form; submissions land in a moderation queue
- **PWA** — Installable on Android/iOS; OSM tiles are cached by the service worker for offline browsing
- **Production-ready** — Nginx reverse proxy, rate limiting, SSL via Let's Encrypt, Redis, Docker Compose

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), Tailwind CSS, Leaflet + markercluster |
| Backend | FastAPI, SQLAlchemy 2, GeoAlchemy2, Alembic, Pydantic v2 |
| Database | PostgreSQL 16 + PostGIS |
| Cache | Redis 7 |
| Proxy | Nginx |
| Infra | Docker Compose (dev + prod) |

---

## Project Structure

```
pet_place/
├── backend/
│   ├── app/
│   │   ├── api/routes/      # places.py, submissions.py
│   │   ├── models/          # SQLAlchemy ORM models
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   ├── core/            # Settings (pydantic-settings)
│   │   ├── db/              # SQLAlchemy session
│   │   └── main.py          # FastAPI app entry point
│   ├── alembic/             # Database migrations
│   ├── scripts/
│   │   └── import_csv.py    # One-time CSV import with optional geocoding
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js App Router pages
│   │   ├── components/      # Map, SearchBar, FilterPanel, PlaceCard, SubmitModal
│   │   ├── lib/api.ts       # API client (relative URLs in browser, internal URL for SSR)
│   │   └── types/           # TypeScript types
│   └── public/
│       ├── manifest.json    # PWA manifest
│       └── sw.js            # Service worker
├── nginx/
│   ├── nginx.conf           # Dev reverse proxy
│   └── nginx.prod.conf      # Prod: SSL, rate limiting, security headers
├── data/
│   └── pet_friendly_place_data.csv
├── docker-compose.yml       # Development
├── docker-compose.prod.yml  # Production
├── Makefile
└── .env.prod.example
```

---

## Getting Started (Development)

### Prerequisites

- Docker & Docker Compose
- GNU Make
- A Google Maps Geocoding API key (optional — needed only for geocoding during import)

### 1. Configure environment

```bash
cp .env.prod.example .env
```

Edit `.env` and fill in at minimum:

```env
POSTGRES_USER=petplace
POSTGRES_PASSWORD=yourpassword
POSTGRES_DB=petplace_db
POSTGRES_HOST=db
POSTGRES_PORT=5432

DATABASE_URL=postgresql://petplace:yourpassword@db:5432/petplace_db
REDIS_URL=redis://redis:6379/0
SECRET_KEY=generate-with-openssl-rand-hex-32

GOOGLE_GEOCODING_API_KEY=   # leave blank to skip geocoding
NEXT_PUBLIC_API_BASE_URL=   # leave blank — browser uses relative URLs through nginx
```

### 2. Start containers

```bash
make up-d
```

Services started:
- `http://localhost` — the app (via Nginx)
- `http://localhost:3000` — Next.js dev server (direct)
- `http://localhost:8000` — FastAPI (direct)

### 3. Run migrations

```bash
make migrate
```

### 4. Import place data

**With geocoding** (requires `GOOGLE_GEOCODING_API_KEY`):
```bash
make import
```

**Without geocoding** (fast, uses lat/lon from CSV where available):
```bash
make import-no-geocode
```

Open `http://localhost` — you should see the map populated with markers.

---

## API Reference

Base URL: `/api`  
Interactive docs: `http://localhost:8000/docs`

### Places

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/places` | List places; supports `state`, `area`, `category`, `seating`, bbox params (`north/south/east/west`), `skip`, `limit` |
| `GET` | `/api/places/nearby` | Places within radius; requires `lat`, `lng`; optional `radius_km` (default 5), `category`, `limit` |
| `GET` | `/api/places/search` | Full-text search across name, area, sub_area, address; optional `state`, `category` |
| `GET` | `/api/places/states` | List of distinct states |
| `GET` | `/api/places/areas` | List of areas (optionally filtered by `state`) |
| `GET` | `/api/places/{id}` | Single place by ID |

### Submissions

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/submissions` | Submit a new place for review |
| `GET` | `/api/submissions` | List submissions; filter by `status` (`pending`/`approved`/`rejected`) |
| `PATCH` | `/api/submissions/{id}/approve` | Approve a submission |
| `PATCH` | `/api/submissions/{id}/reject` | Reject a submission |

---

## Make Commands

| Command | Description |
|---|---|
| `make up` | Start all services (foreground) |
| `make up-d` | Start all services (background) |
| `make down` | Stop all services |
| `make build` | Rebuild Docker images (after dependency changes) |
| `make migrate` | Run Alembic migrations |
| `make import` | Import CSV with geocoding |
| `make import-no-geocode` | Import CSV without geocoding (fast) |
| `make shell-backend` | Open a shell in the backend container |
| `make shell-db` | Open psql in the database container |
| `make logs` | Follow all container logs |
| `make prod-up` | Start production stack |
| `make prod-build` | Build production images |
| `make prod-migrate` | Run migrations on production stack |
| `make ssl-init` | Issue Let's Encrypt certificate (run once after DNS is set) |

---

## Production Deployment

### 1. Provision a server

A VPS with Docker installed (Ubuntu 22.04 recommended). Point your domain's A record to the server's IP.

### 2. Configure production environment

```bash
cp .env.prod.example .env.prod
# Fill in all values — strong passwords, real API keys, your domain
```

Update the domain placeholder in `nginx/nginx.prod.conf`:
```
CHANGE_ME_YOUR_DOMAIN → your-actual-domain.com
```

### 3. Issue SSL certificate

```bash
make ssl-init
# Follow the prompts — runs Certbot in webroot mode
```

### 4. Build and launch

```bash
make prod-build
make prod-up
make prod-migrate
```

### What's included in production mode

- **SSL** — TLS 1.2/1.3 with auto-renewed Let's Encrypt certificates
- **Rate limiting** — 30 req/min on `/api/`, 5 req/min on `/api/submissions`
- **Security headers** — `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`
- **Gzip** — Enabled for JSON, CSS, JS responses
- **Redis** — `allkeys-lru` eviction, 256 MB cap
- **Multi-stage Docker build** — Frontend built to static assets; no dev server in prod

---

## Data

The source data (`data/pet_friendly_place_data.csv`) is a crowd-sourced list of pet-friendly establishments in Malaysia. Columns include outlet name, address, area, sub-area, state, category (café, restaurant, park, etc.), seating type, and Google Maps URL.

The import script (`backend/scripts/import_csv.py`):
- Handles the UTF-8 BOM header (`utf-8-sig` encoding)
- Geocodes each address via Google Maps API to fill `latitude`/`longitude` and PostGIS `location` columns
- Is idempotent: `TRUNCATE`s then re-inserts on every run
- Adds a 50 ms delay between geocode calls to stay within API rate limits
- Set `SKIP_GEOCODING=1` to import from lat/lon columns in the CSV directly

---

## Architecture Notes

**Why relative API URLs?**  
The frontend uses `""` as the base URL in the browser, so all `/api/…` requests go to the same origin and are proxied by Nginx to the backend. This avoids CORS entirely. For SSR (server components), the internal Docker URL `http://backend:8000` is used instead.

**Why plain `lat/lon BETWEEN` instead of PostGIS `ST_Within`?**  
GeoAlchemy2's `ST_Within` + `ST_MakeEnvelope` triggers a SQLAlchemy `_static_cache_key` incompatibility at runtime. Plain column comparisons work correctly, perform well with the GIST index supplemented by a btree index on the float columns, and are simpler to reason about for bounding-box queries.

**Leaflet + markercluster in Next.js**  
`leaflet.markercluster` is a legacy UMD plugin that looks for `L` on `window`. The Map component sets `window.L = L` before importing the plugin, then reads `markerClusterGroup` back from `window.L` (where the plugin attaches it). React StrictMode's double effect invocation is handled by explicitly deleting `_leaflet_id` from the container DOM node before re-initializing the map.

---

## License

MIT
