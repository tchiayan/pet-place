from pydantic import BaseModel, ConfigDict


class PlaceBase(BaseModel):
    name: str
    address: str | None = None
    postcode: str | None = None
    sub_area: str | None = None
    area: str | None = None
    state: str | None = None
    category: str | None = None
    seating: str | None = None
    remarks: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class PlaceUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    postcode: str | None = None
    sub_area: str | None = None
    area: str | None = None
    state: str | None = None
    category: str | None = None
    seating: str | None = None
    remarks: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class PlaceOut(PlaceBase):
    model_config = ConfigDict(from_attributes=True)

    id: int


class PlaceListOut(BaseModel):
    total: int
    items: list[PlaceOut]


class StateOut(BaseModel):
    state: str


class AreaOut(BaseModel):
    area: str
    sub_areas: list[str]
