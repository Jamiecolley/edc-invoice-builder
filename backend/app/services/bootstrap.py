from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.security import hash_password
from app.models.user import User
from app.models.invoice import ChargeMetric, ChargePlan, ChargePlanRate


def bootstrap_defaults(db: Session):
    if db.query(User).count() == 0:
        db.add(User(
            email_address=settings.initial_admin_email.lower(),
            password_hash=hash_password(settings.initial_admin_password),
            full_name=settings.initial_admin_name,
            role_code="ADMIN",
            is_active=True,
        ))

    if db.query(ChargeMetric).count() == 0:
        db.add_all([
            ChargeMetric(metric_code="SHIPMENT", metric_name="Shipment Count", source_table="tblScmUsage/tblShipmentData", source_field="ShipmentCount/row_count"),
            ChargeMetric(metric_code="ORDER", metric_name="Order Count", source_table="tblScmUsage", source_field="OrderCount"),
            ChargeMetric(metric_code="BOOKING", metric_name="Booking Count", source_table="tblScmUsage", source_field="BookingCount"),
            ChargeMetric(metric_code="ORDER_EDI", metric_name="Order EDI Count", source_table="tblScmUsage", source_field="OrderEDICount"),
            ChargeMetric(metric_code="SHIPMENT_EDI", metric_name="Shipment EDI Count", source_table="tblScmUsage", source_field="ShipmentEDICount"),
        ])

    if db.query(ChargePlan).filter(ChargePlan.charge_plan_code == "DEFAULT_2026").first() is None:
        db.add(ChargePlan(charge_plan_code="DEFAULT_2026", charge_plan_name="Default 2026 eDC Charges", currency_code="EUR"))
        db.add_all([
            ChargePlanRate(charge_plan_code="DEFAULT_2026", metric_code="SHIPMENT", from_quantity=1, to_quantity=10000, unit_price=2.5),
            ChargePlanRate(charge_plan_code="DEFAULT_2026", metric_code="SHIPMENT", from_quantity=10001, to_quantity=None, unit_price=1.0),
        ])

    db.commit()
