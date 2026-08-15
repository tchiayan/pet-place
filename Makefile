.PHONY: up down build migrate import import-no-geocode shell-backend shell-db logs \
        prod-up prod-down prod-pull prod-migrate prod-import prod-import-no-geocode ssl-init ssl-renew

# Start all services
up:
	docker compose up --build

# Start all services in background
up-d:
	docker compose up -d --build

# Stop all services
down:
	docker compose down

# Rebuild images (after dependency changes)
build:
	docker compose build

# Run Alembic migrations (after containers are up)
migrate:
	docker compose exec backend alembic upgrade head

# Geocode + import CSV into database (key is read from .env via env_file in compose)
import:
	docker compose exec backend python scripts/import_csv.py

# Import without geocoding (fast seed for local dev)
import-no-geocode:
	docker compose exec -e SKIP_GEOCODING=1 backend python scripts/import_csv.py

# Open a shell in the backend container
shell-backend:
	docker compose exec backend bash

# Open psql in the database container
shell-db:
	docker compose exec db psql -U $(POSTGRES_USER) -d $(POSTGRES_DB)

# Follow logs
logs:
	docker compose logs -f

# ── Production ────────────────────────────────────────────────
prod-up:
	docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

prod-down:
	docker compose -f docker-compose.prod.yml --env-file .env.prod down

# Pull latest images from GHCR, apply migrations, and restart changed containers
prod-pull:
	docker compose -f docker-compose.prod.yml --env-file .env.prod pull
	docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm backend alembic upgrade head
	docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --no-build --remove-orphans
	docker compose -f docker-compose.prod.yml --env-file .env.prod restart nginx
	docker image prune -f

prod-migrate:
	docker compose -f docker-compose.prod.yml --env-file .env.prod exec backend alembic upgrade head

prod-import:
	docker compose -f docker-compose.prod.yml --env-file .env.prod \
		exec backend python scripts/import_csv.py

prod-import-no-geocode:
	docker compose -f docker-compose.prod.yml --env-file .env.prod \
		exec -e SKIP_GEOCODING=1 backend python scripts/import_csv.py

# ── SSL — Cloudflare DNS-01 wildcard cert for *.snowfall.my ──────────────────
#
# Prerequisites:
#   1. cloudflare.ini exists in the project root (see cloudflare.ini.example)
#   2. EMAIL is set: make ssl-init EMAIL=you@example.com
#
# Issue wildcard cert — can run BEFORE prod-up (no port 80 required)
ssl-init:
	@test -f cloudflare.ini || (echo "ERROR: cloudflare.ini not found — copy cloudflare.ini.example and fill in your API token." && exit 1)
	@test -n "$(EMAIL)" || (echo "ERROR: EMAIL not set — run: make ssl-init EMAIL=you@example.com" && exit 1)
	@chmod 600 cloudflare.ini
	docker compose -f docker-compose.prod.yml --env-file .env.prod \
		run --rm certbot certonly \
		--dns-cloudflare \
		--dns-cloudflare-credentials /cloudflare.ini \
		--dns-cloudflare-propagation-seconds 120 \
		-d "*.snowfall.my" \
		-d "snowfall.my" \
		--email $(EMAIL) --agree-tos --no-eff-email
	@echo ""
	@echo "Certificate issued at /etc/letsencrypt/live/snowfall.my/"
	@echo "Now run: make prod-up"

# Renew cert — run while prod stack is up; reloads nginx after renewal
ssl-renew:
	@test -f cloudflare.ini || (echo "ERROR: cloudflare.ini not found." && exit 1)
	@chmod 600 cloudflare.ini
	docker compose -f docker-compose.prod.yml --env-file .env.prod \
		run --rm certbot renew \
		--dns-cloudflare \
		--dns-cloudflare-credentials /cloudflare.ini \
		--dns-cloudflare-propagation-seconds 120
	docker compose -f docker-compose.prod.yml --env-file .env.prod exec nginx nginx -s reload
	@echo "Certificate renewed and nginx reloaded."
