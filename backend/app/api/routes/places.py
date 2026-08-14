from fastapi import APIRouter, Depends, HTTPException, Query
from geoalchemy2.functions import ST_DWithin, ST_GeogFromText
from sqlalchemy import distinct, func, select
from sqlalchemy.orm import Session

from app.core.auth import require_admin
from app.db.session import get_db
from app.models.place import Place
from app.models.user import User
from app.schemas.place import AreaOut, PlaceListOut, PlaceOut, PlaceUpdate

router = APIRouter(prefix="/places", tags=["places"])


@router.get("", response_model=PlaceListOut)
def list_places(
    state: str | None = None,
    area: str | None = None,
    category: str | None = None,
    seating: str | None = None,
    # Bounding box for viewport-based loading
    north: float | None = Query(None),
    south: float | None = Query(None),
    east: float | None = Query(None),
    west: float | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=2000),
    db: Session = Depends(get_db),
):
    from geoalchemy2.functions import ST_Within, ST_MakeEnvelope
    stmt = select(Place)
    if state:
        stmt = stmt.where(Place.state.ilike(f"%{state}%"))
    if area:
        stmt = stmt.where(Place.area.ilike(f"%{area}%"))
    if category:
        stmt = stmt.where(Place.category.ilike(f"%{category}%"))
    if seating:
        stmt = stmt.where(Place.seating.ilike(f"%{seating}%"))
    if all(v is not None for v in [north, south, east, west]):
        stmt = stmt.where(
            Place.latitude.between(south, north),
            Place.longitude.between(west, east),
        )

    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    items = db.scalars(stmt.offset(skip).limit(limit)).all()
    return PlaceListOut(total=total or 0, items=list(items))


@router.get("/nearby", response_model=PlaceListOut)
def nearby_places(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
    radius_km: float = Query(5.0, ge=0.1, le=50),
    category: str | None = None,
    limit: int = Query(100, ge=1, le=2000),
    db: Session = Depends(get_db),
):
    point = ST_GeogFromText(f"POINT({lng} {lat})")
    stmt = select(Place).where(
        Place.location.isnot(None),
        ST_DWithin(Place.location, point, radius_km * 1000),
    )
    if category:
        stmt = stmt.where(Place.category.ilike(f"%{category}%"))

    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    items = db.scalars(stmt.limit(limit)).all()
    return PlaceListOut(total=total or 0, items=list(items))


@router.get("/search", response_model=PlaceListOut)
def search_places(
    q: str = Query("", description="Search by name or area"),
    state: str | None = None,
    category: str | None = None,
    limit: int = Query(200, ge=1, le=2000),
    db: Session = Depends(get_db),
):
    stmt = select(Place)
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(
            Place.name.ilike(pattern)
            | Place.area.ilike(pattern)
            | Place.sub_area.ilike(pattern)
            | Place.address.ilike(pattern)
        )
    if state:
        stmt = stmt.where(Place.state.ilike(f"%{state}%"))
    if category:
        stmt = stmt.where(Place.category.ilike(f"%{category}%"))

    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    items = db.scalars(stmt.limit(limit)).all()
    return PlaceListOut(total=total or 0, items=list(items))


@router.get("/states", response_model=list[str])
def list_states(db: Session = Depends(get_db)):
    rows = db.scalars(
        select(distinct(Place.state)).where(Place.state.isnot(None)).order_by(Place.state)
    ).all()
    return list(rows)


@router.get("/areas", response_model=list[AreaOut])
def list_areas(state: str | None = None, db: Session = Depends(get_db)):
    stmt = (
        select(Place.area, Place.sub_area)
        .where(Place.area.isnot(None))
        .distinct()
        .order_by(Place.area, Place.sub_area)
    )
    if state:
        stmt = stmt.where(Place.state.ilike(f"%{state}%"))

    rows = db.execute(stmt).all()
    grouped: dict[str, list[str]] = {}
    for area, sub_area in rows:
        grouped.setdefault(area, [])
        if sub_area and sub_area not in grouped[area]:
            grouped[area].append(sub_area)

    return [AreaOut(area=a, sub_areas=s) for a, s in grouped.items()]


@router.get("/{place_id}", response_model=PlaceOut)
def get_place(place_id: int, db: Session = Depends(get_db)):
    place = db.get(Place, place_id)
    if not place:
        raise HTTPException(status_code=404, detail="Place not found")
    return place


@router.put("/{place_id}", response_model=PlaceOut)
def update_place(
    place_id: int,
    body: PlaceUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    place = db.get(Place, place_id)
    if not place:
        raise HTTPException(status_code=404, detail="Place not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(place, field, value)
    db.commit()
    db.refresh(place)
    return place


@router.delete("/{place_id}", status_code=204)
def delete_place(
    place_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    place = db.get(Place, place_id)
    if not place:
        raise HTTPException(status_code=404, detail="Place not found")
    db.delete(place)
    db.commit()
