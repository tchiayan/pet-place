from datetime import datetime
from pydantic import BaseModel, ConfigDict


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    clerk_user_id: str
    role: str
    created_at: datetime


class RoleUpdate(BaseModel):
    role: str
