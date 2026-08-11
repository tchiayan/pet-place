from datetime import datetime

from geoalchemy2 import Geography
from sqlalchemy import DateTime, Double, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Place(Base):
    __tablename__ = "places"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[str | None] = mapped_column(Text)
    postcode: Mapped[str | None] = mapped_column(String(10))
    sub_area: Mapped[str | None] = mapped_column(String(100))
    area: Mapped[str | None] = mapped_column(String(100))
    state: Mapped[str | None] = mapped_column(String(100))
    category: Mapped[str | None] = mapped_column(String(100))
    seating: Mapped[str | None] = mapped_column(String(100))
    remarks: Mapped[str | None] = mapped_column(Text)
    latitude: Mapped[float | None] = mapped_column(Double)
    longitude: Mapped[float | None] = mapped_column(Double)
    location: Mapped[object | None] = mapped_column(
        Geography(geometry_type="POINT", srid=4326), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        Index("idx_places_location", "location", postgresql_using="gist"),
        Index("idx_places_state", "state"),
        Index("idx_places_category", "category"),
    )
