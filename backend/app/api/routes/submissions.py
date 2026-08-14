from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth import require_member
from app.db.session import get_db
from app.models.submission import Submission
from app.models.user import User
from app.schemas.submission import SubmissionCreate, SubmissionOut

router = APIRouter(prefix="/submissions", tags=["submissions"])


@router.post("", response_model=SubmissionOut, status_code=201)
def create_submission(
    body: SubmissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_member),
):
    sub = Submission(**body.model_dump(), submitted_by=current_user.clerk_user_id)
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub
