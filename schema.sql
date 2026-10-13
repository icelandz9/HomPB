-- ENUM ---------------------------------------------------------------
create type app_role as ENUM (
    "admin",
    "warehouse",
    "shipping",
    "sales",
    "accounting",
    "customer"
)