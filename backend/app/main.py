from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
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
    # create_all does not add columns to an existing database.
    if "ShipmentCountryBasis" not in {c["name"] for c in inspect(engine).get_columns("tblOrganisations")}:
        with engine.begin() as connection:
            connection.execute(text(
                'ALTER TABLE "tblOrganisations" ADD COLUMN "ShipmentCountryBasis" VARCHAR(20)'
            ))
            connection.execute(text(
                '''UPDATE "tblOrganisations" SET "ShipmentCountryBasis" = 'ORIGIN' WHERE "GetShipmentData" = true'''
            ))
    # Preserve mappings created under either of the earlier, narrowly named tables.
    existing_tables = set(inspect(engine).get_table_names())
    with engine.begin() as connection:
        if "tblLocationCountryMapping" in existing_tables:
            connection.execute(text('''
                INSERT INTO "tblCountryCodeMapping" ("LocationName", "CountryCode")
                SELECT old."LocationName", old."CountryCode"
                FROM "tblLocationCountryMapping" old
                WHERE NOT EXISTS (
                    SELECT 1 FROM "tblCountryCodeMapping" current
                    WHERE lower(current."LocationName") = lower(old."LocationName")
                )
            '''))
        if "tblOriginCountryMapping" in existing_tables:
            connection.execute(text('''
                INSERT INTO "tblCountryCodeMapping" ("LocationName", "CountryCode")
                SELECT old."Origin", old."CountryCode"
                FROM "tblOriginCountryMapping" old
                WHERE NOT EXISTS (
                    SELECT 1 FROM "tblCountryCodeMapping" current
                    WHERE lower(current."LocationName") = lower(old."Origin")
                )
            '''))
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
