# OT-46 Billing Principal And RBAC

## Principal Model

`BillingPrincipalRef` is opaque and local:

- `principal_key`
- `principal_type`
- `account_key`
- `product_key`

The browser may submit only a local principal key, offer key, idempotency key, and version. Browser payloads cannot choose account, product, provider account, mode, provider IDs, metadata, URLs, price, customer, subscription, or entitlement.

## Authorization

Services require an injected `BillingAuthorizationAdapter`. The adapter is authoritative for:

- active session
- account/product scope
- principal mapping
- capability
- archived mapping rejection

The OT-46 service denies anonymous, inactive, wrong-principal, and insufficient-capability access. The feature does not invent parent/household roles.

## Access Boundary

Entitlement output is a billing projection only. It never grants class, portal, media, or member access, and `grants_access` is always false.
