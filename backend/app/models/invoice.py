from sqlalchemy import Boolean, Column, Date, DateTime, Integer, Numeric, String, Text, JSON, func, UniqueConstraint
from app.core.database import Base


class InvoiceProcess(Base):
    __tablename__ = "tblInvoiceProcess"

    process_number = Column("ProcessNumber", Integer, primary_key=True, index=True)
    from_date = Column("FromDate", Date, nullable=False)
    to_date = Column("ToDate", Date, nullable=False)
    status = Column("Status", String(30), nullable=False, default="Running")
    started_at = Column("StartedAt", DateTime, nullable=False, server_default=func.now())
    completed_at = Column("CompletedAt", DateTime, nullable=True)
    error_message = Column("ErrorMessage", Text, nullable=True)
    excel_file_path = Column("ExcelFilePath", Text, nullable=True)


class Organisation(Base):
    __tablename__ = "tblOrganisations"

    uid = Column("UID", Integer, primary_key=True)
    org_code = Column("OrgCode", String(50), nullable=False, unique=True, index=True)
    org_full_name = Column("OrgFullName", Text, nullable=True)
    country_code = Column("CountryCode", String(10), nullable=True)
    division = Column("Division", String(100), nullable=True)
    charge_plan_code = Column("ChargePlanCode", String(50), nullable=True, default="DEFAULT_2026")
    is_custom_invoicing = Column("isCustomInvoicing", Boolean, nullable=False, default=False)
    get_shipment_data = Column("GetShipmentData", Boolean, nullable=False, default=False)
    shipment_country_basis = Column("ShipmentCountryBasis", String(20), nullable=True)
    finalised = Column("Finalised", Boolean, nullable=False, default=False)
    excluded = Column("Excluded", Boolean, nullable=False, default=False)
    created_at = Column("CreatedAt", DateTime, nullable=False, server_default=func.now())
    updated_at = Column("UpdatedAt", DateTime, nullable=True)
    is_freight_manager = Column("IsFreightManager", Boolean, nullable=False, default=False)
    country_multi = Column("CountryMulti", Boolean, nullable=False, default=False)
    org_managed_by = Column("OrgManagedBy", String(100), nullable=True)

class OrganisationCountrySplit(Base):
    __tablename__ = "tblOrganisationCountrySplit"

    uid = Column("UID", Integer, primary_key=True)
    org_code = Column("OrgCode", String(50), nullable=False, index=True)
    country_code = Column("CountryCode", String(10), nullable=False)
    percentage = Column("Percentage", Numeric(8, 4), nullable=False, default=0)
    is_active = Column("IsActive", Boolean, nullable=False, default=True)
    created_at = Column("CreatedAt", DateTime, nullable=False, server_default=func.now())
    updated_at = Column("UpdatedAt", DateTime, nullable=True)

class ScmUsage(Base):
    __tablename__ = "tblScmUsage"

    uid = Column("UID", Integer, primary_key=True)
    process_number = Column("ProcessNumber", Integer, nullable=False, index=True)
    org_code = Column("OrgCode", String(50), nullable=False, index=True)
    org_full_name = Column("OrgFullName", Text, nullable=True)
    year_month = Column("YearMonth", String(20), nullable=True)
    shipment_count = Column("ShipmentCount", Integer, default=0)
    order_count = Column("OrderCount", Integer, default=0)
    pos = Column("POs", Integer, default=0)
    stos = Column("STOs", Integer, default=0)
    sos = Column("SOs", Integer, default=0)
    clos = Column("CLOs", Integer, default=0)
    order_edi_count = Column("OrderEDICount", Integer, default=0)
    order_from_shipment_edi_count = Column("OrderFromShipmentEDICount", Integer, default=0)
    order_api_count = Column("OrderAPICount", Integer, default=0)
    shipment_edi_count = Column("ShipmentEDICount", Integer, default=0)
    invoice_count = Column("InvoiceCount", Integer, default=0)
    booking_count = Column("BookingCount", Integer, default=0)
    orders_shipped = Column("OrdersShipped", Integer, default=0)
    shipment_event_edi_count = Column("ShipmentEventEDICount", Integer, default=0)
    first_order_date = Column("FirstOrderDate", DateTime, nullable=True)
    last_order_date = Column("LastOrderDate", DateTime, nullable=True)
    first_shipment_date = Column("FirstShipmentDate", DateTime, nullable=True)
    last_shipment_date = Column("LastShipmentDate", DateTime, nullable=True)
    org_date_created = Column("OrgDateCreated", DateTime, nullable=True)
    org_managed_by = Column("OrgManagedBy", Text, nullable=True)
    org_active = Column("OrgActive", Boolean, nullable=True)
    is_road_provider = Column("IsRoadProvider", Boolean, nullable=True)
    is_air_sea_provider = Column("IsAirSeaProvider", Boolean, nullable=True)
    is_solutions_provider = Column("IsSolutionsProvider", Boolean, nullable=True)
    is_sales_order_client = Column("IsSalesOrderClient", Boolean, nullable=True)
    is_stock_transfer_order_client = Column("IsStockTransferOrderClient", Boolean, nullable=True)
    is_llp = Column("IsLLP", Boolean, nullable=True)
    is_edc_lite_client = Column("IsEdcLiteClient", Boolean, nullable=True)
    is_freight_manager = Column("IsFreightManager", Boolean, nullable=True)
    is_multi_lsppom = Column("IsMultiLSPPOM", Boolean, nullable=True)
    is_po_carrier_allocation_manager = Column("IsPOCarrierAllocationManager", Boolean, nullable=True)
    is_po_control_client = Column("IsPOControlClient", Boolean, nullable=True)
    is_purchase_order_client = Column("IsPurchaseOrderClient", Boolean, nullable=True)
    is_po_visibility_client = Column("IsPOVisibilityClient", Boolean, nullable=True)
    is_po_manager_client = Column("IsPOManagerClient", Boolean, nullable=True)
    is_supply_chain_manager = Column("IsSupplyChainManager", Boolean, nullable=True)
    is_supply_chain_optimizer = Column("IsSupplyChainOptimizer", Boolean, nullable=True)
    is_freight_order_client = Column("IsFreightOrderClient", Boolean, nullable=True)
    enterprise_vertical = Column("EnterpriseVertical", String(100), nullable=True)
    control_tower = Column("ControlTower", String(100), nullable=True)
    sales_source = Column("SalesSource", String(100), nullable=True)
    connectivity = Column("Connectivity", String(100), nullable=True)
    customer_segmentation = Column("CustomerSegmentation", String(100), nullable=True)
    pulled_at = Column("PulledAt", DateTime, nullable=False, server_default=func.now())
    raw_json = Column("RawJson", JSON, nullable=False)


class ShipmentData(Base):
    __tablename__ = "tblShipmentData"

    uid = Column("UID", Integer, primary_key=True)
    process_number = Column("ProcessNumber", Integer, nullable=False, index=True)
    org_code = Column("OrgCode", String(50), nullable=False, index=True)
    shipment_id = Column("ShipmentID", String(50), nullable=True)
    booking_number = Column("BookingNumber", String(100), nullable=True)
    booking_type = Column("BookingType", Integer, nullable=True)
    booking_type_name = Column("BookingTypeName", String(100), nullable=True)
    booking_id = Column("BookingID", String(50), nullable=True)
    incoterm = Column("Incoterm", String(20), nullable=True)
    unique_consign_ref = Column("UniqueConsignRef", String(100), nullable=True)
    date_created = Column("DateCreated", DateTime, nullable=True)
    transport_mode = Column("TransportMode", String(50), nullable=True)
    consignor_name = Column("ConsignorName", Text, nullable=True)
    consignor_country = Column("ConsignorCountry", String(100), nullable=True)
    consignor_country_code = Column("ConsignorCountryCode", String(10), nullable=True)
    pickup_name = Column("PickupName", Text, nullable=True)
    pickup_from_country = Column("PickupFromCountry", String(100), nullable=True)
    pickup_from_country_code = Column("PickupFromCountryCode", String(10), nullable=True)
    pickup_from_city = Column("PickupFromCity", String(100), nullable=True)
    origin_port = Column("OriginPort", String(150), nullable=True)
    first_load = Column("FirstLoad", String(20), nullable=True)
    consignee_name = Column("ConsigneeName", Text, nullable=True)
    consignee_country = Column("ConsigneeCountry", String(100), nullable=True)
    consignee_country_code = Column("ConsigneeCountryCode", String(10), nullable=True)
    delivery_name = Column("DeliveryName", Text, nullable=True)
    delivery_to_country = Column("DeliveryToCountry", String(100), nullable=True)
    delivery_to_country_code = Column("DeliveryToCountryCode", String(10), nullable=True)
    delivery_to_city = Column("DeliveryToCity", String(100), nullable=True)
    destination_port = Column("DestinationPort", String(150), nullable=True)
    discharge_port = Column("DischargePort", String(20), nullable=True)
    last_discharge = Column("LastDischarge", String(20), nullable=True)
    style_template = Column("StyleTemplate", Text, nullable=True)
    resolved_country_code = Column("ResolvedCountryCode", String(10), nullable=True)
    resolved_country_source = Column("ResolvedCountrySource", String(100), nullable=True)
    pulled_at = Column("PulledAt", DateTime, nullable=False, server_default=func.now())
    raw_json = Column("RawJson", JSON, nullable=False)


class ChargeMetric(Base):
    __tablename__ = "tblChargeMetric"
    uid = Column("UID", Integer, primary_key=True)
    metric_code = Column("MetricCode", String(50), unique=True, nullable=False)
    metric_name = Column("MetricName", String(100), nullable=False)
    source_table = Column("SourceTable", String(100), nullable=False)
    source_field = Column("SourceField", String(100), nullable=False)
    is_active = Column("IsActive", Boolean, nullable=False, default=True)


class ChargePlan(Base):
    __tablename__ = "tblChargePlan"
    uid = Column("UID", Integer, primary_key=True)
    charge_plan_code = Column("ChargePlanCode", String(50), unique=True, nullable=False)
    charge_plan_name = Column("ChargePlanName", String(150), nullable=False)
    currency_code = Column("CurrencyCode", String(10), nullable=False, default="EUR")
    is_active = Column("IsActive", Boolean, nullable=False, default=True)
    created_at = Column("CreatedAt", DateTime, nullable=False, server_default=func.now())
    updated_at = Column("UpdatedAt", DateTime, nullable=True)


class ChargePlanRate(Base):
    __tablename__ = "tblChargePlanRate"
    uid = Column("UID", Integer, primary_key=True)
    charge_plan_code = Column("ChargePlanCode", String(50), nullable=False)
    metric_code = Column("MetricCode", String(50), nullable=False)
    from_quantity = Column("FromQuantity", Integer, nullable=False)
    to_quantity = Column("ToQuantity", Integer, nullable=True)
    unit_price = Column("UnitPrice", Numeric(12, 4), nullable=False)
    is_active = Column("IsActive", Boolean, nullable=False, default=True)


class CountryResolutionRule(Base):
    __tablename__ = "tblCountryResolutionRules"
    uid = Column("UID", Integer, primary_key=True)
    org_code = Column("OrgCode", String(50), nullable=False)
    priority_order = Column("PriorityOrder", Integer, nullable=False)
    source_field = Column("SourceField", String(100), nullable=False)
    lookup_type = Column("LookupType", String(50), nullable=False, default="DIRECT")


class UNLOCODE(Base):
    __tablename__ = "tblUNLOCODE"
    uid = Column("UID", Integer, primary_key=True)
    city = Column("City", String(150), nullable=True)
    country_code = Column("CountryCode", String(10), nullable=False)
    unlocode = Column("UNLOCODE", String(20), unique=True, nullable=False)


class CountryCodeMapping(Base):
    __tablename__ = "tblCountryCodeMapping"
    uid = Column("UID", Integer, primary_key=True)
    location_name = Column("LocationName", String(150), unique=True, nullable=False)
    country_code = Column("CountryCode", String(10), nullable=False)


class InvoiceException(Base):
    __tablename__ = "tblInvoiceException"
    uid = Column("UID", Integer, primary_key=True)
    process_number = Column("ProcessNumber", Integer, nullable=False, index=True)
    org_code = Column("OrgCode", String(50), nullable=False)
    exception_type = Column("ExceptionType", String(100), nullable=False)
    severity = Column("Severity", String(30), nullable=False, default="Warning")
    message = Column("Message", Text, nullable=False)
    is_resolved = Column("IsResolved", Boolean, nullable=False, default=False)
    created_at = Column("CreatedAt", DateTime, nullable=False, server_default=func.now())


class FinalInvoiceLine(Base):
    __tablename__ = "tblFinalInvoiceLine"
    uid = Column("UID", Integer, primary_key=True)
    process_number = Column("ProcessNumber", Integer, nullable=False, index=True)
    org_code = Column("OrgCode", String(50), nullable=False)
    org_full_name = Column("OrgFullName", Text, nullable=True)
    country_code = Column("CountryCode", String(10), nullable=True)
    division = Column("Division", String(100), nullable=True)
    org_managed_by = Column("OrgManagedBy", String(100), nullable=True)
    metric_code = Column("MetricCode", String(50), nullable=False, default="SHIPMENT")
    quantity = Column("Quantity", Integer, nullable=False, default=0)
    unit_price = Column("UnitPrice", Numeric(12, 4), nullable=False, default=0)
    total_cost = Column("TotalCost", Numeric(12, 4), nullable=False, default=0)
    currency_code = Column("CurrencyCode", String(10), nullable=False, default="EUR")
    source = Column("Source", String(50), nullable=False)
