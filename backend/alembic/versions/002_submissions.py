"""add submissions table

Revision ID: 002
Revises: 001
Create Date: 2025-01-02 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS submissions (
            id              SERIAL PRIMARY KEY,
            name            VARCHAR(255) NOT NULL,
            address         TEXT NOT NULL,
            state           VARCHAR(100),
            category        VARCHAR(100),
            seating         VARCHAR(100),
            remarks         TEXT,
            google_maps_url TEXT,
            status          VARCHAR(20) NOT NULL DEFAULT 'pending',
            created_at      TIMESTAMP DEFAULT now()
        )
    """)
    op.create_index("idx_submissions_status", "submissions", ["status"], if_not_exists=True)


def downgrade() -> None:
    op.drop_index("idx_submissions_status", table_name="submissions")
    op.drop_table("submissions")
