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

Each shipment-data customer has a `ShipmentCountryBasis`, selected in Admin as
Origin or Destination. Existing shipment-data customers default to Origin.

Origin resolution uses the first available result:

1. `PickupFromCountryCode`
2. First two characters of `FirstLoad`
3. `Origin` (or the legacy `OriginPort` value) looked up in
   `tblCountryCodeMapping`

Destination resolution uses the first available result:

1. `ConsigneeAddress.CountryCode`
2. First two characters of `LastDischarge`
3. First two characters of `DischargePort`
4. `Destination` looked up in `tblCountryCodeMapping`

If no step resolves a country, the shipment is grouped under `Unknown`.
When the unresolved shipment has an Origin or Destination value, that location
is added once to `tblCountryCodeMapping` with a blank country code so an admin
can complete it. Existing mappings are not duplicated (matching is
case-insensitive).
Generic country code mappings can be added, edited, and deleted under Admin
Settings. The same mapping table can support additional shipment location fields
in future.

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
