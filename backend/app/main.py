import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select, text
import redis as redis_lib

from app.api.routes.admin import router as admin_router
from app.api.routes.places import router as places_router
from app.api.routes.submissions import router as submissions_router
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.user import User

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
app.include_router(admin_router, prefix="/api")


@app.on_event("startup")
def seed_superadmin() -> None:
    if not settings.superadmin_clerk_id:
        return
    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(User.clerk_user_id == settings.superadmin_clerk_id))
        if not user:
            db.add(User(clerk_user_id=settings.superadmin_clerk_id, role="superadmin"))
            db.commit()
        elif user.role != "superadmin":
            user.role = "superadmin"
            db.commit()
    finally:
        db.close()


@app.get("/api/geoip")
async def geoip(request: Request):
    client_ip = request.headers.get("X-Real-IP") or (request.client.host if request.client else "")
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"http://ip-api.com/json/{client_ip}?fields=status,lat,lon")
            data = r.json()
            if data.get("status") == "success":
                return {"status": "success", "lat": data["lat"], "lon": data["lon"]}
    except Exception:
        pass
    return {"status": "fail"}


@app.get("/health")
def health():
    checks: dict[str, str] = {}

    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        checks["database"] = "ok"
    except Exception as exc:
        checks["database"] = f"error: {exc}"

    try:
        r = redis_lib.from_url(settings.redis_url, socket_connect_timeout=2)
        r.ping()
        checks["redis"] = "ok"
    except Exception as exc:
        checks["redis"] = f"error: {exc}"

    all_ok = all(v == "ok" for v in checks.values())
    status_code = 200 if all_ok else 503
    return JSONResponse(
        status_code=status_code,
        content={"status": "ok" if all_ok else "degraded", "checks": checks},
    )
