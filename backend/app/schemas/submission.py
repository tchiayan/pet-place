from datetime import datetime
from pydantic import BaseModel, ConfigDict, HttpUrl, field_validator


class SubmissionCreate(BaseModel):
    name: str
    address: str
    state: str = ""
    category: str = ""
    seating: str = ""
    remarks: str = ""
    google_maps_url: str = ""

    @field_validator("name", "address")
    @classmethod
    def must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("This field is required")
        return v.strip()


class SubmissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    address: str
    state: str | None
    category: str | None
    seating: str | None
    remarks: str | None
    google_maps_url: str | None
    status: str
    submitted_by: str | None
    reviewed_by: str | None
    created_at: datetime
