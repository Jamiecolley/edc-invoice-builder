# API Design

## eDC APIs used

### OrganizationUsage_Read

```text
POST /Admin/OrganizationUsage_Read?ngsw-bypass=true
```

Used to collect organisation-level usage data.

The app sends:

```json
{
  "Filter": "",
  "dateFrom": "2026-05-01T00:00:00.000Z",
  "dateTo": "2026-05-31T23:59:59.999Z",
  "Page": 1,
  "PageSize": 100
}
```

### Shipments_Read

```text
POST /Shipment/Shipments_Read
```

Used to collect shipment-level data for organisations where `GetShipmentData = true`.

Header:

```text
OrganizationCode: Adidas
```

The app sends `PageSize = 100` and loops pages until all records are collected.
