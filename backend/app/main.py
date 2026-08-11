from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.places import router as places_router
from app.api.routes.submissions import router as submissions_router

app = FastAPI(title="Pet Place API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost", "http://localhost:3000", "http://localhost:80", "http://127.0.0.1"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(places_router, prefix="/api")
app.include_router(submissions_router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}
