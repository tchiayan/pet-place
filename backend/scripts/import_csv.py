"""
One-time script: geocode addresses in the CSV and seed the database.

Usage (inside the backend container or with venv active):
    DATABASE_URL=... GOOGLE_GEOCODING_API_KEY=... python scripts/import_csv.py

Set DRY_RUN=1 to print rows without writing to DB.
Set SKIP_GEOCODING=1 to import without lat/lon (useful for testing the import itself).
"""

import csv
import os
import sys
import time

import httpx
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

# Allow running from repo root or scripts/ directory
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.models.place import Place  # noqa: E402

CSV_PATH = os.getenv("CSV_PATH", "/data/pet_friendly_place_data.csv")
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://petplace:CHANGE_ME@localhost:5432/petplace_db")
GOOGLE_GEOCODING_API_KEY = os.getenv("GOOGLE_GEOCODING_API_KEY", "")
DRY_RUN = os.getenv("DRY_RUN", "0") == "1"
SKIP_GEOCODING = os.getenv("SKIP_GEOCODING", "0") == "1"

GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
GEOCODE_DELAY = 0.05  # seconds between requests to stay within rate limits


def geocode(address: str, client: httpx.Client) -> tuple[float, float] | None:
    if not GOOGLE_GEOCODING_API_KEY:
        return None
    try:
        resp = client.get(
            GEOCODE_URL,
            params={"address": address, "key": GOOGLE_GEOCODING_API_KEY},
            timeout=10,
        )
        data = resp.json()
        if data.get("status") == "OK" and data["results"]:
            loc = data["results"][0]["geometry"]["location"]
            return loc["lat"], loc["lng"]
    except Exception as e:
        print(f"  [geocode error] {address}: {e}")
    return None


def build_location_wkt(lat: float, lng: float) -> str:
    return f"SRID=4326;POINT({lng} {lat})"


def clean(value: str) -> str | None:
    v = value.strip()
    return v if v and v.lower() != "none" else None


def run() -> None:
    engine = create_engine(DATABASE_URL)

    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        conn.commit()

    with open(CSV_PATH, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"Found {len(rows)} rows in CSV.")
    if DRY_RUN:
        print("DRY RUN — nothing will be written.")

    inserted = skipped = errors = 0

    with httpx.Client() as http_client, Session(engine) as db:
        # Clear existing data so the import is idempotent
        if not DRY_RUN:
            db.execute(text("TRUNCATE places RESTART IDENTITY"))
            db.commit()

        for i, row in enumerate(rows, start=1):
            name = clean(row.get("Outlet", ""))
            if not name:
                skipped += 1
                continue

            address = clean(row.get("Address", ""))
            postcode = clean(row.get("Postcode", ""))
            sub_area = clean(row.get("Sub area", ""))
            area = clean(row.get("Area", ""))
            state = clean(row.get("State", ""))
            category = clean(row.get("Location category", ""))
            seating = clean(row.get("Location description", ""))
            remarks = clean(row.get("Other remarks", ""))

            lat = lng = None
            location_wkt = None

            if not SKIP_GEOCODING and address:
                coords = geocode(address, http_client)
                if coords:
                    lat, lng = coords
                    location_wkt = build_location_wkt(lat, lng)
                    print(f"[{i}/{len(rows)}] OK  {name} → {lat:.5f}, {lng:.5f}")
                else:
                    print(f"[{i}/{len(rows)}] --  {name} (no coords)")
                time.sleep(GEOCODE_DELAY)
            else:
                print(f"[{i}/{len(rows)}] +   {name} (geocoding skipped)")

            if DRY_RUN:
                inserted += 1
                continue

            try:
                place = Place(
                    name=name,
                    address=address,
                    postcode=postcode,
                    sub_area=sub_area,
                    area=area,
                    state=state,
                    category=category,
                    seating=seating,
                    remarks=remarks,
                    latitude=lat,
                    longitude=lng,
                    location=location_wkt,
                )
                db.add(place)
                if i % 50 == 0:
                    db.commit()
                inserted += 1
            except Exception as e:
                db.rollback()
                print(f"  [db error] {name}: {e}")
                errors += 1

        if not DRY_RUN:
            db.commit()

    print(f"\nDone. inserted={inserted}  skipped={skipped}  errors={errors}")


if __name__ == "__main__":
    run()
