.PHONY: up down build migrate import import-no-geocode shell-backend shell-db logs \
        prod-up prod-down prod-pull prod-migrate ssl-init ssl-renew

# Start all services
up:
	docker compose up

# Start all services in background
up-d:
	docker compose up -d

# Stop all services
down:
	docker compose down

# Rebuild images (after dependency changes)
build:
	docker compose build

# Run Alembic migrations (after containers are up)
migrate:
	docker compose exec backend alembic upgrade head

# Geocode + import CSV into database
# Set SKIP_GEOCODING=1 to skip geocoding (for testing)
import:
	docker compose exec -e GOOGLE_GEOCODING_API_KEY=$(GOOGLE_GEOCODING_API_KEY) \
		backend python scripts/import_csv.py

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
	docker compose -f docker-compose.prod.yml down

# Pull latest images from GHCR and restart changed containers
prod-pull:
	docker compose -f docker-compose.prod.yml --env-file .env.prod pull
	docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --no-build --remove-orphans
	docker image prune -f

prod-migrate:
	docker compose -f docker-compose.prod.yml --env-file .env.prod exec backend alembic upgrade head

# Issue SSL cert — run ONCE before prod-up, while port 80 is free.
# Certbot opens port 80 itself (standalone mode); no nginx required.
# Usage: make ssl-init DOMAIN=your-domain.com EMAIL=you@example.com
ssl-init:
	docker compose -f docker-compose.prod.yml --env-file .env.prod \
		run --rm -p 80:80 certbot certonly \
		--standalone \
		-d $(DOMAIN) --email $(EMAIL) --agree-tos --no-eff-email
	@echo "Certificate issued. Now run: make prod-up"

# Renew SSL cert — run while the full prod stack is up (nginx serves the challenge).
# Usage: make ssl-renew DOMAIN=your-domain.com EMAIL=you@example.com
ssl-renew:
	docker compose -f docker-compose.prod.yml --env-file .env.prod \
		run --rm certbot certonly \
		--webroot --webroot-path /var/www/certbot \
		-d $(DOMAIN) --email $(EMAIL) --agree-tos --no-eff-email --force-renewal
	docker compose -f docker-compose.prod.yml --env-file .env.prod exec nginx nginx -s reload
