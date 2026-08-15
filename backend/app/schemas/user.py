from datetime import datetime
from pydantic import BaseModel, ConfigDict


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    clerk_user_id: str
    role: str
    name: str | None = None
    email: str | None = None
    created_at: datetime


class UserSync(BaseModel):
    name: str | None = None
    email: str | None = None


class UserListResponse(BaseModel):
    items: list[UserOut]
    total: int


class RoleUpdate(BaseModel):
    role: str
