"""add users table and submission audit columns

Revision ID: 003
Revises: 002
Create Date: 2025-01-03 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id              SERIAL PRIMARY KEY,
            clerk_user_id   VARCHAR(255) NOT NULL UNIQUE,
            role            VARCHAR(20)  NOT NULL DEFAULT 'member',
            created_at      TIMESTAMP DEFAULT now()
        )
    """)
    op.create_index("idx_users_clerk_user_id", "users", ["clerk_user_id"], if_not_exists=True)

    op.add_column("submissions", sa.Column("submitted_by", sa.String(255), nullable=True))
    op.add_column("submissions", sa.Column("reviewed_by", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("submissions", "reviewed_by")
    op.drop_column("submissions", "submitted_by")
    op.drop_index("idx_users_clerk_user_id", table_name="users")
    op.drop_table("users")
