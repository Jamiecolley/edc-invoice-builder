from datetime import date
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.invoice import FinalInvoiceLine, InvoiceException, InvoiceProcess, ScmUsage, ShipmentData, Organisation
from app.services.invoice_service import collect_invoice_data, create_final_invoice, generate_excel

router = APIRouter(prefix="/invoice-process", tags=["invoice"])


class StartInvoiceRequest(BaseModel):
    from_date: date
    to_date: date


def serialize_final_lines(db: Session, lines):
    org_codes = {line.org_code for line in lines}
    organisations = db.query(Organisation).filter(Organisation.org_code.in_(org_codes)).all() if org_codes else []
    charge_plans = {org.org_code: org.charge_plan_code or "DEFAULT_2026" for org in organisations}

    return [{
        "org_code": line.org_code,
        "org_full_name": line.org_full_name,
        "country_code": line.country_code,
        "division": line.division,
        "org_managed_by": line.org_managed_by,
        "charge_plan_code": charge_plans.get(line.org_code, "DEFAULT_2026"),
        "quantity": line.quantity,
        "unit_price": float(line.unit_price),
        "total_cost": float(line.total_cost),
        "currency_code": line.currency_code,
        "source": line.source
    } for line in lines]


@router.post("/start")
async def start_invoice_process(payload: StartInvoiceRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        process = await collect_invoice_data(db, payload.from_date, payload.to_date)
        return {
            "process_number": process.process_number,
            "status": process.status
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("")
def list_processes(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.query(InvoiceProcess).order_by(InvoiceProcess.process_number.desc()).limit(50).all()
    return [{"process_number": r.process_number, "from_date": r.from_date, "to_date": r.to_date, "status": r.status, "started_at": r.started_at, "completed_at": r.completed_at, "error_message": r.error_message} for r in rows]


@router.get("/{process_number}/status")
def process_status(process_number: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    p = db.query(InvoiceProcess).filter(InvoiceProcess.process_number == process_number).first()
    if not p:
        raise HTTPException(404, "Process not found")
    return {"process_number": p.process_number, "status": p.status, "error_message": p.error_message}


@router.get("/{process_number}/usage")
def usage(process_number: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.query(ScmUsage).filter(ScmUsage.process_number == process_number).limit(1000).all()
    return [{"uid": r.uid, "org_code": r.org_code, "org_full_name": r.org_full_name, "shipment_count": r.shipment_count, "order_count": r.order_count, "booking_count": r.booking_count, "year_month": r.year_month} for r in rows]


@router.get("/{process_number}/shipments")
def shipments(process_number: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.query(ShipmentData).filter(ShipmentData.process_number == process_number).limit(1000).all()
    return [{"uid": r.uid, "org_code": r.org_code, "unique_consign_ref": r.unique_consign_ref, "date_created": r.date_created, "transport_mode": r.transport_mode, "resolved_country_code": r.resolved_country_code, "resolved_country_source": r.resolved_country_source} for r in rows]


@router.get("/{process_number}/exceptions")
def exceptions(process_number: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.query(InvoiceException).filter(
        InvoiceException.process_number == process_number
    ).all()

    result = []

    for r in rows:
        org = db.query(Organisation).filter(
            Organisation.org_code == r.org_code
        ).first()

        usage_rows = db.query(ScmUsage).filter(
            ScmUsage.process_number == process_number,
            ScmUsage.org_code == r.org_code
        ).all()

        organisation_usage_total = sum(u.shipment_count or 0 for u in usage_rows)

        shipments_read_total = db.query(ShipmentData).filter(
            ShipmentData.process_number == process_number,
            ShipmentData.org_code == r.org_code
        ).count()

        result.append({
            "org_code": r.org_code,
            "org_full_name": org.org_full_name if org else None,
            "get_shipment_data": org.get_shipment_data if org else None,
            "organization_usage_total": organisation_usage_total,
            "shipments_read_total": shipments_read_total,
            "difference": shipments_read_total - organisation_usage_total,
            "severity": r.severity,
            "message": r.message,
            "is_resolved": r.is_resolved
        })

    return result

@router.post("/{process_number}/create-final-invoice")
def final_invoice(process_number: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lines = create_final_invoice(db, process_number)
    return serialize_final_lines(db, lines)


@router.get("/{process_number}/final-lines")
def final_lines(process_number: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.query(FinalInvoiceLine).filter(FinalInvoiceLine.process_number == process_number).all()
    return serialize_final_lines(db, rows)


@router.get("/{process_number}/download-excel")
def download_excel(process_number: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    path = generate_excel(db, process_number)
    if not Path(path).exists():
        raise HTTPException(404, "Excel file not found")
    return FileResponse(path, filename=Path(path).name, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
