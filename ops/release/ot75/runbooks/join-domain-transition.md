# OT-75 Transitional Join Domain Plan

OT-75 keeps `join.onetimeonetime.com` as the transitional public domain. Root
domain cutover is out of scope and remains forbidden until a later explicit
packet.

## Allowed In OT-75

- Document staging and production domain variable names.
- Prepare source SHA and readiness readback contracts.
- Prepare a staging canary plan for the join subdomain.

## Forbidden In OT-75

- DNS changes.
- Root-domain cutover.
- Redirecting production traffic.
- Provider or payment configuration mutation.

## OT-80 Promotion Check

OT-80 must verify that the staging domain, transitional join domain, source SHA
readback, readiness, and rollback plan are all green before any deployment
promotion is considered.
