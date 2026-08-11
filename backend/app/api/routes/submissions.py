from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.submission import Submission
from app.schemas.submission import SubmissionCreate, SubmissionOut

router = APIRouter(prefix="/submissions", tags=["submissions"])


@router.post("", response_model=SubmissionOut, status_code=201)
def create_submission(body: SubmissionCreate, db: Session = Depends(get_db)):
    sub = Submission(**body.model_dump())
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


@router.get("", response_model=list[SubmissionOut])
def list_submissions(
    status: str = "pending",
    db: Session = Depends(get_db),
):
    rows = db.scalars(
        select(Submission)
        .where(Submission.status == status)
        .order_by(Submission.created_at.desc())
    ).all()
    return list(rows)


@router.patch("/{submission_id}/approve", response_model=SubmissionOut)
def approve_submission(submission_id: int, db: Session = Depends(get_db)):
    sub = db.get(Submission, submission_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    sub.status = "approved"
    db.commit()
    db.refresh(sub)
    return sub


@router.patch("/{submission_id}/reject", response_model=SubmissionOut)
def reject_submission(submission_id: int, db: Session = Depends(get_db)):
    sub = db.get(Submission, submission_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    sub.status = "rejected"
    db.commit()
    db.refresh(sub)
    return sub
