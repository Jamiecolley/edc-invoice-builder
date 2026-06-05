from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.core.security import get_current_user, require_admin
from app.models.user import User
from app.models.invoice import Organisation, ChargePlan, ChargePlanRate, CountryResolutionRule, UNLOCODE, LocationCountryMapping

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


@router.get("/organisations")
def list_orgs(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.query(Organisation).order_by(Organisation.org_code).all()
    return [{"uid": r.uid, "org_code": r.org_code, "org_full_name": r.org_full_name, "country_code": r.country_code, "division": r.division, "charge_plan_code": r.charge_plan_code, "is_custom_invoicing": r.is_custom_invoicing, "get_shipment_data": r.get_shipment_data, "finalised": r.finalised, "excluded": r.excluded} for r in rows]


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
    for key, value in payload.model_dump().items():
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
    rec = ChargePlanRate(**payload.model_dump()); db.add(rec); db.commit(); return {"uid": rec.uid}


@router.delete("/charge-plan-rates/{uid}")
def delete_rate(uid: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    db.query(ChargePlanRate).filter(ChargePlanRate.uid == uid).delete(); db.commit(); return {"status": "deleted"}


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
