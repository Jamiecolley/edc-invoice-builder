from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import Base, SessionLocal, engine
from app.models import user, invoice
from app.services.bootstrap import bootstrap_defaults
from app.api.auth import router as auth_router
from app.api.invoice import router as invoice_router
from app.api.admin import router as admin_router

app = FastAPI(title="eDC Invoice Builder", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        bootstrap_defaults(db)
    finally:
        db.close()


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(auth_router)
app.include_router(invoice_router)
app.include_router(admin_router)
