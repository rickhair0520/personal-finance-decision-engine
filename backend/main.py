from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db.database import engine, Base
from app import models  # noqa: F401 — registers ORM models
from app.routers import auth, profile, dashboard, scenarios, retirement

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Personal Finance Decision Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(profile.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(scenarios.router, prefix="/api/v1")
app.include_router(retirement.router, prefix="/api/v1")


@app.get("/health")
def health():
    return {"status": "ok"}
