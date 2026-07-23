# Iteration Log

## v0.1.0 - MVP Project Build

### Added

- Docker Compose structure.
- Python FastAPI backend.
- React frontend.
- PostgreSQL database.
- Login page with email address and password.
- JWT authentication.
- Initial admin user created from `.env`.
- eDC `OrganizationUsage_Read` integration.
- eDC `Shipments_Read` integration.
- Pagination using `PageSize = 100`.
- `tblInvoiceProcess`.
- `tblUsers`.
- `tblOrganisations`.
- `tblScmUsage`.
- `tblShipmentData`.
- `tblChargeMetric`.
- `tblChargePlan`.
- `tblChargePlanRate`.
- `tblCountryResolutionRules`.
- `tblUNLOCODE`.
- `tblLocationCountryMapping`.
- `tblInvoiceException`.
- `tblFinalInvoiceLine`.
- Basic admin settings screen.
- Configurable shipment rate tiers.
- Discrepancy warning between Usage API ShipmentCount and Shipment API rows.
- Excel generation.

### Invoice rules

- Normal organisations use `OrganizationUsage_Read.ShipmentCount`.
- Organisations with `GetShipmentData = true` use row count from `Shipments_Read`.
- Usage API ShipmentCount is still used as a warning check for `GetShipmentData = true` customers.

### Known limitations

- User management admin screen is not yet added.
- Admin CRUD is basic.
- Order and booking charging are not yet active.
- Custom percentage split logic is not yet built.
- Excel formatting is basic.
