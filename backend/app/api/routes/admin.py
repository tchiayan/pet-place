from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import require_admin, require_member
from app.db.session import get_db
from app.models.place import Place
from app.models.submission import Submission
from app.models.user import User
from app.schemas.submission import SubmissionOut
from app.schemas.user import RoleUpdate, UserOut

router = APIRouter(prefix="/admin", tags=["admin"])

VALID_ROLES = ("member", "admin", "superadmin")


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


# ── Users ────────────────────────────────────────────────────────────────────

@router.get("/users", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return list(db.scalars(select(User).order_by(User.created_at.desc())).all())


@router.get("/users/me", response_model=UserOut)
def get_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_member),
):
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

    # Admins can only manage members and other admins, not superadmins
    if current_user.role == "admin":
        if target.role == "superadmin":
            raise HTTPException(status_code=403, detail="Admins cannot modify superadmin accounts")
        if body.role == "superadmin":
            raise HTTPException(status_code=403, detail="Admins cannot assign superadmin role")

    target.role = body.role
    db.commit()
    db.refresh(target)
    return target
