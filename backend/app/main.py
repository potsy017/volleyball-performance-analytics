from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.routers import athletes, dashboard, gymaware, catapult, vald, whoop, access_requests

app = FastAPI(
    title="Volleyball Performance Analytics API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(athletes.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(gymaware.router, prefix="/api")
app.include_router(catapult.router, prefix="/api")
app.include_router(vald.router, prefix="/api")
app.include_router(whoop.router, prefix="/api")
app.include_router(access_requests.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "VPA API"}
