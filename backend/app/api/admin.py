from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user, require_admin
from app.models.user import User
from app.models.invoice import Organisation, ChargePlan, ChargePlanRate, CountryResolutionRule, UNLOCODE, LocationCountryMapping, OrganisationCountrySplit

router = APIRouter(prefix="/admin", tags=["admin"])


class OrgPayload(BaseModel):
    org_code: str
    org_full_name: Optional[str] = None
    country_code: Optional[str] = None
    division: Optional[str] = None
    charge_plan_code: Optional[str] = "DEFAULT_2026"
    is_custom_invoicing: bool = False
    get_shipment_data: bool = False
    finalised: bool = False
    excluded: bool = False
    is_freight_manager: bool = False
    country_multi: bool = False


@router.get("/organisations")
def list_orgs(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.query(Organisation).order_by(Organisation.org_code).all()
    return [{
    "uid": r.uid,
    "org_code": r.org_code,
    "org_full_name": r.org_full_name,
    "country_code": r.country_code,
    "division": r.division,
    "charge_plan_code": r.charge_plan_code,
    "is_custom_invoicing": r.is_custom_invoicing,
    "get_shipment_data": r.get_shipment_data,
    "is_freight_manager": r.is_freight_manager,
    "finalised": r.finalised,
    "excluded": r.excluded,
    "country_multi": r.country_multi
} for r in rows]


@router.post("/organisations")
def create_org(payload: OrgPayload, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    org = Organisation(**payload.model_dump())
    if org.get_shipment_data:
        org.country_code = "Multi"
    db.add(org); db.commit(); db.refresh(org)
    return {"uid": org.uid}


@router.put("/organisations/{uid}")
def update_org(uid: int, payload: OrgPayload, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    org = db.query(Organisation).filter(Organisation.uid == uid).first()

    if not org:
        raise HTTPException(404, "Organisation not found")

    payload_data = payload.model_dump()

    # IsFreightManager is controlled by OrganizationUsage_Read only.
    # Admin UI can show it, but must not manually update it.
    payload_data.pop("is_freight_manager", None)

    for key, value in payload_data.items():
        setattr(org, key, value)

    if org.get_shipment_data:
        org.country_code = "Multi"

    db.commit()
    return {"status": "updated"}


@router.delete("/organisations/{uid}")
def delete_org(uid: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    db.query(Organisation).filter(Organisation.uid == uid).delete(); db.commit()
    return {"status": "deleted"}


class ChargePlanPayload(BaseModel):
    charge_plan_code: str
    charge_plan_name: str
    currency_code: str = "EUR"
    is_active: bool = True


@router.get("/charge-plans")
def charge_plans(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(ChargePlan).all()


@router.post("/charge-plans")
def create_charge_plan(payload: ChargePlanPayload, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    rec = ChargePlan(**payload.model_dump()); db.add(rec); db.commit(); return {"uid": rec.uid}


class ChargeRatePayload(BaseModel):
    charge_plan_code: str
    metric_code: str = "SHIPMENT"
    from_quantity: int
    to_quantity: Optional[int] = None
    unit_price: float
    is_active: bool = True


@router.get("/charge-plan-rates")
def rates(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(ChargePlanRate).order_by(ChargePlanRate.charge_plan_code, ChargePlanRate.from_quantity).all()


@router.post("/charge-plan-rates")
def create_rate(payload: ChargeRatePayload, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    rec = ChargePlanRate(**payload.model_dump())
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return {"uid": rec.uid}


@router.put("/charge-plan-rates/{uid}")
def update_rate(uid: int, payload: ChargeRatePayload, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    rec = db.query(ChargePlanRate).filter(ChargePlanRate.uid == uid).first()

    if not rec:
        raise HTTPException(404, "Charge rate not found")

    for key, value in payload.model_dump().items():
        setattr(rec, key, value)

    db.commit()
    return {"status": "updated"}


@router.delete("/charge-plan-rates/{uid}")
def delete_rate(uid: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    rec = db.query(ChargePlanRate).filter(ChargePlanRate.uid == uid).first()

    if not rec:
        raise HTTPException(404, "Charge rate not found")

    db.delete(rec)
    db.commit()
    return {"status": "deleted"}


class CountryRulePayload(BaseModel):
    org_code: str
    priority_order: int
    source_field: str
    lookup_type: str = "DIRECT"


@router.get("/country-rules")
def country_rules(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(CountryResolutionRule).order_by(CountryResolutionRule.org_code, CountryResolutionRule.priority_order).all()


@router.post("/country-rules")
def create_country_rule(payload: CountryRulePayload, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    rec = CountryResolutionRule(**payload.model_dump()); db.add(rec); db.commit(); return {"uid": rec.uid}


class UnlocodePayload(BaseModel):
    city: Optional[str] = None
    country_code: str
    unlocode: str


@router.get("/unlocodes")
def unlocodes(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(UNLOCODE).limit(2000).all()


@router.post("/unlocodes")
def create_unlocode(payload: UnlocodePayload, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    rec = UNLOCODE(city=payload.city, country_code=payload.country_code.upper(), unlocode=payload.unlocode.upper())
    db.add(rec); db.commit(); return {"uid": rec.uid}


class LocationPayload(BaseModel):
    location_name: str
    country_code: str


@router.get("/location-mapping")
def locations(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(LocationCountryMapping).limit(2000).all()


@router.post("/location-mapping")
def create_location(payload: LocationPayload, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    rec = LocationCountryMapping(location_name=payload.location_name, country_code=payload.country_code.upper())
    db.add(rec); db.commit(); return {"uid": rec.uid}

class CountrySplitPayload(BaseModel):
    org_code: str
    country_code: str
    percentage: float
    is_active: bool = True


@router.get("/country-splits/{org_code}")
def list_country_splits(org_code: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.query(OrganisationCountrySplit).filter(
        OrganisationCountrySplit.org_code == org_code
    ).order_by(OrganisationCountrySplit.country_code).all()

    return [{
        "uid": r.uid,
        "org_code": r.org_code,
        "country_code": r.country_code,
        "percentage": float(r.percentage),
        "is_active": r.is_active
    } for r in rows]


@router.post("/country-splits")
def create_country_split(payload: CountrySplitPayload, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    rec = OrganisationCountrySplit(
        org_code=payload.org_code,
        country_code=payload.country_code.upper(),
        percentage=payload.percentage,
        is_active=payload.is_active
    )

    db.add(rec)
    db.commit()
    db.refresh(rec)

    return {"uid": rec.uid}


@router.put("/country-splits/{uid}")
def update_country_split(uid: int, payload: CountrySplitPayload, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    rec = db.query(OrganisationCountrySplit).filter(
        OrganisationCountrySplit.uid == uid
    ).first()

    if not rec:
        raise HTTPException(404, "Country split row not found")

    rec.org_code = payload.org_code
    rec.country_code = payload.country_code.upper()
    rec.percentage = payload.percentage
    rec.is_active = payload.is_active
    rec.updated_at = datetime.utcnow()

    db.commit()

    return {"status": "updated"}


@router.delete("/country-splits/{uid}")
def delete_country_split(uid: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    rec = db.query(OrganisationCountrySplit).filter(
        OrganisationCountrySplit.uid == uid
    ).first()

    if not rec:
        raise HTTPException(404, "Country split row not found")

    db.delete(rec)
    db.commit()

    return {"status": "deleted"}