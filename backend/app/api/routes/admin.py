import logging
import threading
import time

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from geoalchemy2 import WKTElement
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.auth import require_admin, require_member
from app.core.geocoding import geocode_address
from app.db.session import SessionLocal, get_db
from app.models.place import Place
from app.models.submission import Submission
from app.models.user import User
from app.schemas.submission import SubmissionOut
from app.schemas.user import RoleUpdate, UserListResponse, UserOut, UserSync

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])

VALID_ROLES = ("member", "admin", "superadmin")

_geocoding_lock = threading.Lock()
_geocoding_running = False


# ── Submissions ──────────────────────────────────────────────────────────────

@router.get("/submissions", response_model=list[SubmissionOut])
def list_submissions(
    status: str = "pending",
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    rows = db.scalars(
        select(Submission)
        .where(Submission.status == status)
        .order_by(Submission.created_at.desc())
    ).all()
    return list(rows)


@router.patch("/submissions/{submission_id}/approve", response_model=SubmissionOut)
def approve_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    sub = db.get(Submission, submission_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    sub.status = "approved"
    sub.reviewed_by = current_user.clerk_user_id

    place = Place(
        name=sub.name,
        address=sub.address,
        state=sub.state,
        category=sub.category,
        seating=sub.seating,
        remarks=sub.remarks,
    )

    if sub.address:
        coords = geocode_address(sub.address)
        if coords:
            lat, lng = coords
            place.latitude = lat
            place.longitude = lng
            place.location = WKTElement(f"POINT({lng} {lat})", srid=4326)
        else:
            logger.warning("Could not geocode submission %s address: %r", sub.id, sub.address)

    db.add(place)
    db.commit()
    db.refresh(sub)
    return sub


@router.patch("/submissions/{submission_id}/reject", response_model=SubmissionOut)
def reject_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    sub = db.get(Submission, submission_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    sub.status = "rejected"
    sub.reviewed_by = current_user.clerk_user_id
    db.commit()
    db.refresh(sub)
    return sub


# ── Places ───────────────────────────────────────────────────────────────────

@router.get("/places/geocode-missing/status")
def geocode_missing_status(_: User = Depends(require_admin)):
    return {"running": _geocoding_running}


@router.post("/places/geocode-missing")
def geocode_missing(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    global _geocoding_running
    with _geocoding_lock:
        if _geocoding_running:
            raise HTTPException(status_code=409, detail="Geocoding job already running")
        _geocoding_running = True

    count = db.scalar(
        select(func.count(Place.id)).where(Place.latitude.is_(None))
    )
    background_tasks.add_task(_run_geocode_missing)
    return {"queued": count or 0}


def _run_geocode_missing() -> None:
    global _geocoding_running
    db = SessionLocal()
    try:
        places = db.scalars(
            select(Place).where(Place.latitude.is_(None), Place.address.isnot(None))
        ).all()
        for place in places:
            try:
                coords = geocode_address(place.address)
                if coords:
                    lat, lng = coords
                    place.latitude = lat
                    place.longitude = lng
                    place.location = WKTElement(f"POINT({lng} {lat})", srid=4326)
                    db.commit()
            except Exception as exc:
                logger.error("Failed to geocode/commit place %s: %s", place.id, exc)
                db.rollback()
            time.sleep(0.1)
    except Exception as exc:
        logger.error("Geocode missing job failed: %s", exc)
    finally:
        db.close()
        with _geocoding_lock:
            _geocoding_running = False


# ── Users ────────────────────────────────────────────────────────────────────

@router.get("/users", response_model=UserListResponse)
def list_users(
    q: str = "",
    skip: int = 0,
    limit: int = 10,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    base = select(User)
    count_base = select(func.count(User.id))
    if q:
        pattern = f"%{q}%"
        f = or_(User.name.ilike(pattern), User.email.ilike(pattern), User.clerk_user_id.ilike(pattern))
        base = base.where(f)
        count_base = count_base.where(f)
    total = db.scalar(count_base) or 0
    items = list(db.scalars(base.order_by(User.created_at.desc()).offset(skip).limit(limit)).all())
    return UserListResponse(items=items, total=total)


@router.get("/users/me", response_model=UserOut)
def get_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_member),
):
    return current_user


@router.patch("/users/me", response_model=UserOut)
def sync_me(
    body: UserSync,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_member),
):
    if body.name is not None:
        current_user.name = body.name
    if body.email is not None:
        current_user.email = body.email
    db.commit()
    db.refresh(current_user)
    return current_user


@router.patch("/users/{clerk_user_id}/role", response_model=UserOut)
def set_user_role(
    clerk_user_id: str,
    body: RoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if body.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}")

    target = db.scalar(select(User).where(User.clerk_user_id == clerk_user_id))
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if current_user.role == "admin":
        if target.role == "superadmin":
            raise HTTPException(status_code=403, detail="Admins cannot modify superadmin accounts")
        if body.role == "superadmin":
            raise HTTPException(status_code=403, detail="Admins cannot assign superadmin role")

    target.role = body.role
    db.commit()
    db.refresh(target)
    return target
