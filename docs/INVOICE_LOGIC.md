# Invoice Logic

## Standard customers

Where `GetShipmentData = false`:

```text
Quantity = OrganizationUsage_Read.ShipmentCount
```

## Shipment-data customers

Where `GetShipmentData = true`:

```text
Quantity = count of Shipments_Read rows
```

The app compares this count against `OrganizationUsage_Read.ShipmentCount`.

If there is a difference, a warning is created in `tblInvoiceException`.

## Charging

Charging is controlled by:

- `tblChargeMetric`
- `tblChargePlan`
- `tblChargePlanRate`

Current default rule:

```text
Shipment 1 to 10,000 = 2.50 EUR
Shipment 10,001+ = 1.00 EUR
```

This can be changed in the admin area.
