from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user, require_admin
from app.models.user import User
from app.models.invoice import Organisation, ChargePlan, ChargePlanRate, CountryResolutionRule, UNLOCODE, CountryCodeMapping, OrganisationCountrySplit

router = APIRouter(prefix="/admin", tags=["admin"])


class OrgPayload(BaseModel):
    org_code: str
    org_full_name: Optional[str] = None
    country_code: Optional[str] = None
    division: Optional[str] = None
    org_managed_by: Optional[str] = None
    charge_plan_code: Optional[str] = "DEFAULT_2026"
    is_custom_invoicing: bool = False
    get_shipment_data: bool = False
    shipment_country_basis: Optional[str] = None
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
    "org_managed_by": r.org_managed_by,
    "charge_plan_code": r.charge_plan_code,
    "is_custom_invoicing": r.is_custom_invoicing,
    "get_shipment_data": r.get_shipment_data,
    "shipment_country_basis": r.shipment_country_basis,
    "is_freight_manager": r.is_freight_manager,
    "finalised": r.finalised,
    "excluded": r.excluded,
    "country_multi": r.country_multi
} for r in rows]


@router.post("/organisations")
def create_org(payload: OrgPayload, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    payload_data = payload.model_dump()
    payload_data["shipment_country_basis"] = _validate_shipment_country_basis(
        payload.get_shipment_data, payload.shipment_country_basis
    )
    org = Organisation(**payload_data)
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
    payload_data["shipment_country_basis"] = _validate_shipment_country_basis(
        payload.get_shipment_data, payload.shipment_country_basis
    )

    # IsFreightManager is controlled by OrganizationUsage_Read only.
    # Admin UI can show it, but must not manually update it.
    payload_data.pop("is_freight_manager", None)

    for key, value in payload_data.items():
        setattr(org, key, value)

    if org.get_shipment_data:
        org.country_code = "Multi"

    db.commit()
    return {"status": "updated"}


def _validate_shipment_country_basis(get_shipment_data: bool, basis: Optional[str]):
    if not get_shipment_data:
        return None
    normalized = (basis or "ORIGIN").upper()
    if normalized not in {"ORIGIN", "DESTINATION"}:
        raise HTTPException(422, "Shipment country basis must be ORIGIN or DESTINATION")
    return normalized


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


def _validate_charge_rate(db: Session, payload: ChargeRatePayload, exclude_uid: Optional[int] = None):
    payload.charge_plan_code = payload.charge_plan_code.strip()
    payload.metric_code = payload.metric_code.strip().upper()

    if not payload.charge_plan_code:
        raise HTTPException(422, "Charge Plan is required")
    if payload.from_quantity < 1:
        raise HTTPException(422, "From Qty must be at least 1")
    if payload.to_quantity is not None and payload.to_quantity < payload.from_quantity:
        raise HTTPException(422, "To Qty must be greater than or equal to From Qty")
    if payload.unit_price < 0:
        raise HTTPException(422, "Unit Price cannot be negative")
    if not payload.is_active:
        return

    query = db.query(ChargePlanRate).filter(
        ChargePlanRate.charge_plan_code == payload.charge_plan_code,
        ChargePlanRate.metric_code == payload.metric_code,
        ChargePlanRate.is_active == True,
    )
    if exclude_uid is not None:
        query = query.filter(ChargePlanRate.uid != exclude_uid)

    new_end = payload.to_quantity if payload.to_quantity is not None else float("inf")
    for rate in query.all():
        existing_end = rate.to_quantity if rate.to_quantity is not None else float("inf")
        if payload.from_quantity <= existing_end and rate.from_quantity <= new_end:
            raise HTTPException(422, f"Quantity range overlaps an existing tier in {payload.charge_plan_code}")


@router.get("/charge-plan-rates")
def rates(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(ChargePlanRate).order_by(ChargePlanRate.charge_plan_code, ChargePlanRate.from_quantity).all()


@router.post("/charge-plan-rates")
def create_rate(payload: ChargeRatePayload, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    _validate_charge_rate(db, payload)
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

    _validate_charge_rate(db, payload, exclude_uid=uid)
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
    return db.query(CountryCodeMapping).limit(2000).all()


@router.post("/location-mapping")
def create_location(payload: LocationPayload, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    rec = CountryCodeMapping(location_name=payload.location_name, country_code=payload.country_code.upper())
    db.add(rec); db.commit(); return {"uid": rec.uid}


class CountryCodeMappingPayload(BaseModel):
    location_name: str
    country_code: str


@router.get("/country-code-mappings")
def country_code_mappings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(CountryCodeMapping).order_by(CountryCodeMapping.location_name).all()


@router.post("/country-code-mappings")
def create_country_code_mapping(payload: CountryCodeMappingPayload, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    rec = CountryCodeMapping(location_name=payload.location_name.strip(), country_code=payload.country_code.strip().upper())
    db.add(rec); db.commit(); db.refresh(rec)
    return {"uid": rec.uid}


@router.put("/country-code-mappings/{uid}")
def update_country_code_mapping(uid: int, payload: CountryCodeMappingPayload, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    rec = db.query(CountryCodeMapping).filter(CountryCodeMapping.uid == uid).first()
    if not rec:
        raise HTTPException(404, "Country code mapping not found")
    rec.location_name = payload.location_name.strip()
    rec.country_code = payload.country_code.strip().upper()
    db.commit()
    return {"status": "updated"}


@router.delete("/country-code-mappings/{uid}")
def delete_country_code_mapping(uid: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    rec = db.query(CountryCodeMapping).filter(CountryCodeMapping.uid == uid).first()
    if not rec:
        raise HTTPException(404, "Country code mapping not found")
    db.delete(rec); db.commit()
    return {"status": "deleted"}

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
