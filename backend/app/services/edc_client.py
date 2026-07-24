import math
from datetime import date, datetime, time
from typing import Any, Dict, List
import httpx
from app.core.config import settings
import json

REQUIRED_SHIPMENT_COLUMNS = [
    "ID", "BookingNumber", "Booking.BookingNumber", "Booking.Type", "BookingID", "Incoterm",
    "UniqueConsignRef", "DateCreated", "TransportMode", "ConsignorName",
    "ConsignorAddress.Country", "ConsignorAddress.CountryCode", "PickupName",
    "PickupFromCountry", "PickupFromCountryCode", "OriginPort", "FirstLoad",
    "ConsigneeName", "ConsigneeAddress.Country", "ConsigneeAddress.CountryCode",
    "DeliveryName", "DeliveryToCountry", "DeliveryToCountryCode", "DestinationPort",
    "DischargePort", "LastDischarge"
]


def _iso_utc_start(d: date) -> str:
    return datetime.combine(d, time.min).isoformat(timespec="milliseconds") + "Z"


def _iso_utc_end(d: date) -> str:
    return datetime.combine(d, time.max).isoformat(timespec="milliseconds")[:-3] + "Z"


def _iso_local_start(d: date) -> str:
    return datetime.combine(d, time.min).isoformat(timespec="seconds") + "+01:00"


def _iso_local_end(d: date) -> str:
    return datetime.combine(d, time(23, 59, 59)).isoformat(timespec="seconds") + "+01:00"


async def post_edc(path: str, body: Dict[str, Any], headers: Dict[str, str] | None = None) -> Dict[str, Any]:
    if not settings.edc_username or not settings.edc_password:
        raise RuntimeError("EDC_USERNAME and EDC_PASSWORD must be set in .env")
    url = f"{settings.edc_base_url.rstrip('/')}/{path.lstrip('/')}"
    async with httpx.AsyncClient(timeout=settings.edc_timeout_seconds) as client:
        response = await client.post(
            url,
            json=body,
            headers=headers or {},
            auth=(settings.edc_username, settings.edc_password),
        )
        response.raise_for_status()
        data = response.json()
        if data.get("Errors"):
            raise RuntimeError(f"eDC API returned errors: {data.get('Errors')}")
        return data


async def read_usage(from_date: date, to_date: date, page_size: int = 100) -> List[Dict[str, Any]]:
    page = 1
    all_rows: List[Dict[str, Any]] = []
    while True:
        body = {
            "Filter": "",
            "dateFrom": _iso_utc_start(from_date),
            "dateTo": _iso_utc_end(to_date),
            "Page": page,
            "PageSize": page_size,
        }
        data = await post_edc("/Admin/OrganizationUsage_Read?ngsw-bypass=true", body)
        rows = data.get("Data", []) or []
        total = data.get("Total")
        all_rows.extend(rows)
        if total is not None:
            if page >= math.ceil(int(total) / page_size):
                break
        elif len(rows) < page_size:
            break
        page += 1
    return all_rows


async def read_shipments(org_code: str, from_date: date, to_date: date, page_size: int = 100) -> List[Dict[str, Any]]:
    page = 1
    all_rows: List[Dict[str, Any]] = []

    while True:
        body = {
            "Sort": "",
            "Page": page,
            "Filter": "",
            "requiredColumns": REQUIRED_SHIPMENT_COLUMNS,
            "cardFilters": None,
            "SearchRuleItems": [{
                "SearchItemName": "CreatedTime",
                "Color": "0",
                "RuleControlInfo": {
                    "Type": 8,
                    "Code": "DateTime Range",
                    "StartDate": _iso_local_start(from_date),
                    "EndDate": _iso_local_end(to_date),
                    "FromYear": None,
                    "FromWeekNumber": None,
                    "ToYear": None,
                    "ToWeekNumber": None,
                    "TimezoneOffset": -60,
                }
            }],
            "UniqueName": "ShipmentSearchPanel",
            "PageSize": page_size,
        }

        print("Shipments_Read org:", org_code)
        print("Shipments_Read page:", page)
        print("Shipments_Read body:")
        print(json.dumps(body, indent=2, default=str))

        data = await post_edc(
            "/Shipment/Shipments_Read",
            body,
            headers={"OrganizationCode": org_code}
        )

        print("Shipments_Read total:", data.get("Total"))
        print("Shipments_Read returned rows:", len(data.get("Data", []) or []))

        sample_rows = (data.get("Data", []) or [])[:5]
        for row in sample_rows:
            print("Sample shipment:", {
                "ID": row.get("ID"),
                "ShipmentNumber": row.get("ShipmentNumber"),
                "CreatedTime": row.get("CreatedTime"),
                "DateCreated": row.get("DateCreated"),
            })

        rows = data.get("Data", []) or []
        total = data.get("Total")
        all_rows.extend(rows)

        if total is not None:
            if page >= math.ceil(int(total) / page_size):
                break
        elif len(rows) < page_size:
            break

        page += 1

    return all_rows
