# Pet Place Malaysia

A mobile-friendly web app for discovering pet-friendly places in Malaysia. Data is crowd-sourced and imported from a CSV dataset. Users can browse places on an interactive map, search by name or area, filter by state and category, share their GPS location to find nearby spots, and submit new places for review.

---

## Features

- **Interactive map** — OpenStreetMap tiles with marker clustering; loads only the places visible in the current viewport
- **Search & filter** — Search by name, area, or address; filter by state, category, and seating type
- **Nearby search** — Uses the browser Geolocation API + PostGIS radius query to find places within a configurable radius
- **Submit a place** — Signed-in members can submit new places via a form; submissions land in a moderation queue
- **RBAC** — Four roles (public, member, admin, superadmin) enforced on both frontend and backend via Clerk + JWT
- **Admin panel** — Admins can approve/reject submissions (approval auto-publishes the place), manage user roles at `/admin`
- **PWA** — Installable on Android/iOS; OSM tiles are cached by the service worker for offline browsing
- **Production-ready** — Nginx reverse proxy, rate limiting, SSL via Let's Encrypt, Redis, Docker Compose

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), Tailwind CSS, Leaflet + markercluster |
| Backend | FastAPI, SQLAlchemy 2, GeoAlchemy2, Alembic, Pydantic v2 |
| Auth | Clerk (identity) + PyJWT / JWKS (backend token verification) |
| Database | PostgreSQL 16 + PostGIS |
| Cache | Redis 7 |
| Proxy | Nginx |
| Infra | Docker Compose (dev + prod) |

---

## Roles & Permissions

| Action | Public | Member | Admin | Superadmin |
|---|---|---|---|---|
| View places | ✓ | ✓ | ✓ | ✓ |
| Submit a place for review | — | ✓ | ✓ | ✓ |
| Approve / reject submissions | — | — | ✓ | ✓ |
| Edit / delete places | — | — | ✓ | ✓ |
| Promote member → admin | — | — | ✓ | ✓ |
| Demote / promote admins | — | — | — | ✓ |
| Assign / revoke superadmin | — | — | — | ✓ |

- **Public** — anyone browsing without an account
- **Member** — anyone who signs up via Clerk (auto-assigned on first login)
- **Admin** — promoted by a superadmin; can manage all content and promote members
- **Superadmin** — seeded via env var on startup; full control including role management for all tiers

---

## Project Structure

```
pet_place/
├── backend/
│   ├── app/
│   │   ├── api/routes/
│   │   │   ├── places.py        # GET (public) + PUT/DELETE (admin)
│   │   │   ├── submissions.py   # POST (member only)
│   │   │   └── admin.py         # Submission queue + user role management
│   │   ├── models/
│   │   │   ├── place.py
│   │   │   ├── submission.py    # + submitted_by, reviewed_by columns
│   │   │   └── user.py          # clerk_user_id, role
│   │   ├── schemas/             # Pydantic request/response schemas
│   │   ├── core/
│   │   │   ├── config.py        # Settings (+ CLERK_JWKS_URL, SUPERADMIN_CLERK_ID)
│   │   │   └── auth.py          # JWT verification, lazy user creation, role deps
│   │   ├── db/                  # SQLAlchemy session
│   │   └── main.py              # FastAPI app + superadmin startup seeding
│   ├── alembic/                 # Database migrations
│   ├── scripts/
│   │   └── import_csv.py        # One-time CSV import with optional geocoding
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx       # Wrapped with <ClerkProvider>
│   │   │   ├── page.tsx         # Map page (auth-aware UI)
│   │   │   └── admin/page.tsx   # Protected admin panel
│   │   ├── components/          # Map, SearchBar, FilterPanel, PlaceCard, SubmitModal
│   │   ├── lib/api.ts           # API client with optional auth token support
│   │   ├── middleware.ts        # Clerk middleware (protects /admin)
│   │   └── types/               # TypeScript types
│   └── public/
│       ├── manifest.json        # PWA manifest
│       └── sw.js                # Service worker
├── nginx/
│   ├── nginx.conf               # Dev reverse proxy
│   └── nginx.prod.conf          # Prod: SSL, rate limiting, security headers
├── data/
│   └── pet_friendly_place_data.csv
├── docker-compose.yml           # Development
├── docker-compose.prod.yml      # Production
├── Makefile
└── .env.prod.example
```

---

## Getting Started (Development)

### Prerequisites

- Docker & Docker Compose
- GNU Make
- A [Clerk](https://clerk.com) account (free tier is sufficient)
- A Google Maps Geocoding API key (optional — needed only for geocoding during CSV import)

### 1. Create a Clerk application

1. Go to [dashboard.clerk.com](https://dashboard.clerk.com) and create a new application
2. Under **API Keys**, copy your **Publishable Key** and **Secret Key**
3. Find your JWKS URL — it follows the pattern `https://<your-frontend-api>/.well-known/jwks.json` (shown under **JWT Templates** in the dashboard)
4. After signing in for the first time, find your **Clerk user ID** under **Users** (format: `user_xxxxxxxx`)

### 2. Configure environment

```bash
cp .env.prod.example .env
```

Edit `.env` and fill in:

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

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_JWKS_URL=https://your-app.clerk.accounts.dev/.well-known/jwks.json
SUPERADMIN_CLERK_ID=user_...   # your own Clerk user ID
```

### 3. Start containers

```bash
make up-d
```

Services started:
- `http://localhost` — the app (via Nginx)
- `http://localhost:3000` — Next.js dev server (direct)
- `http://localhost:8000` — FastAPI (direct)

### 4. Run migrations

```bash
make migrate
```

### 5. Import place data

**With geocoding** (requires `GOOGLE_GEOCODING_API_KEY`):
```bash
make import
```

**Without geocoding** (fast, uses lat/lon from CSV where available):
```bash
make import-no-geocode
```

### 6. Become superadmin

The backend seeds your superadmin row automatically at startup (from `SUPERADMIN_CLERK_ID`). Sign in to the app, then visit `http://localhost/admin` — you should have full access immediately.

Open `http://localhost` — you should see the map populated with markers.

---

## API Reference

Base URL: `/api`  
Interactive docs: `http://localhost:8000/docs`

All authenticated endpoints require an `Authorization: Bearer <clerk_jwt>` header.

### Places

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/places` | — | List places; supports `state`, `area`, `category`, `seating`, bbox params, `skip`, `limit` |
| `GET` | `/api/places/nearby` | — | Places within radius; requires `lat`, `lng`; optional `radius_km`, `category`, `limit` |
| `GET` | `/api/places/search` | — | Full-text search across name, area, sub_area, address |
| `GET` | `/api/places/states` | — | List of distinct states |
| `GET` | `/api/places/areas` | — | List of areas (optionally filtered by `state`) |
| `GET` | `/api/places/{id}` | — | Single place by ID |
| `PUT` | `/api/places/{id}` | admin | Update place fields |
| `DELETE` | `/api/places/{id}` | admin | Delete a place |

### Submissions

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/submissions` | member | Submit a new place for review |

### Admin

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/admin/submissions` | admin | List submissions filtered by `status` (`pending`/`approved`/`rejected`) |
| `PATCH` | `/api/admin/submissions/{id}/approve` | admin | Approve submission and auto-create `Place` |
| `PATCH` | `/api/admin/submissions/{id}/reject` | admin | Reject submission |
| `GET` | `/api/admin/users` | admin | List all users with roles |
| `GET` | `/api/admin/users/me` | member | Get current user's role |
| `PATCH` | `/api/admin/users/{clerk_user_id}/role` | admin | Update a user's role |

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
# Fill in all values — strong passwords, real Clerk keys, your domain
```

Update the domain placeholder in `nginx/nginx.prod.conf`:
```
CHANGE_ME_YOUR_DOMAIN → your-actual-domain.com
```

Use your Clerk **production** instance keys (`pk_live_…` / `sk_live_…`) for production.

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

**Auth flow**  
Clerk issues a short-lived JWT on the frontend. The backend verifies it via Clerk's JWKS endpoint (cached in-process). On the first authenticated request, the backend lazy-creates a `users` row with `role = "member"`. The superadmin row is seeded from `SUPERADMIN_CLERK_ID` at startup. Roles are stored in the app's own PostgreSQL database, not in Clerk metadata, so they can be joined against submission audit columns (`submitted_by`, `reviewed_by`).

**Why relative API URLs?**  
The frontend uses `""` as the base URL in the browser, so all `/api/…` requests go to the same origin and are proxied by Nginx to the backend. This avoids CORS entirely. For SSR (server components), the internal Docker URL `http://backend:8000` is used instead.

**Why plain `lat/lon BETWEEN` instead of PostGIS `ST_Within`?**  
GeoAlchemy2's `ST_Within` + `ST_MakeEnvelope` triggers a SQLAlchemy `_static_cache_key` incompatibility at runtime. Plain column comparisons work correctly, perform well with the GIST index supplemented by a btree index on the float columns, and are simpler to reason about for bounding-box queries.

**Leaflet + markercluster in Next.js**  
`leaflet.markercluster` is a legacy UMD plugin that looks for `L` on `window`. The Map component sets `window.L = L` before importing the plugin, then reads `markerClusterGroup` back from `window.L` (where the plugin attaches it). React StrictMode's double effect invocation is handled by explicitly deleting `_leaflet_id` from the container DOM node before re-initializing the map.

---

## License

MIT
