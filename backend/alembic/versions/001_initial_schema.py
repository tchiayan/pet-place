"""initial schema

Revision ID: 001
Revises:
Create Date: 2025-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
import geoalchemy2

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    op.execute("""
        CREATE TABLE IF NOT EXISTS places (
            id          SERIAL PRIMARY KEY,
            name        VARCHAR(255) NOT NULL,
            address     TEXT,
            postcode    VARCHAR(10),
            sub_area    VARCHAR(100),
            area        VARCHAR(100),
            state       VARCHAR(100),
            category    VARCHAR(100),
            seating     VARCHAR(100),
            remarks     TEXT,
            latitude    DOUBLE PRECISION,
            longitude   DOUBLE PRECISION,
            location    geography(Point, 4326),
            created_at  TIMESTAMP DEFAULT now(),
            updated_at  TIMESTAMP DEFAULT now()
        )
    """)

    op.create_index("idx_places_state", "places", ["state"], if_not_exists=True)
    op.create_index("idx_places_category", "places", ["category"], if_not_exists=True)
    op.create_index(
        "idx_places_location",
        "places",
        ["location"],
        postgresql_using="gist",
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index("idx_places_location", table_name="places")
    op.drop_index("idx_places_category", table_name="places")
    op.drop_index("idx_places_state", table_name="places")
    op.drop_table("places")
