# One Time Mishnayos — Current FX Snapshot and Reporting Amendment

**Research date:** 2026-08-13  
**Status:** Current supplement to `2026-08-13-launch-marketing-source-of-truth-v3.md`

## Current available official reference

The official Bank of Israel public exchange-rate API returned:

- currency: USD;
- representative rate: **3.0060 ILS per USD**;
- last update in the API response: **2026-08-07**.

The daily reference row is recorded in:

`ops/marketing/content-registry/fx-rates.csv`

The Bank of Israel representative rate is an indicator and is not necessarily the rate used by a bank, card issuer, transfer provider, or private transaction.

## Current planning conversions

At 3.0060 ILS per USD:

- $300 ≈ ₪901.80;
- $500 ≈ ₪1,503.00;
- $1,000 ≈ ₪3,006.00;
- $1,500 ≈ ₪4,509.00;
- $5,000 ≈ ₪15,030.00;
- $67 monthly revenue ≈ ₪201.40;
- $200 paid CAC ≈ ₪601.20.

These are management examples only.

## Operating rule

- Keep Meta/customer unit economics in USD when the ad account, payment source, and customer price are USD.
- Add a date-stamped ILS reference for Israeli management reporting.
- If dollars are actually converted or a card settles in ILS, preserve the statement’s actual ILS amount, rate, fee, and spread.
- Do not replace historical rows when the rate changes.
- Do not use the ILS display value to judge ad quality; use registration CPA, activation CPA, paid CAC, contribution LTV, and payback in the primary USD ledger.

## Supersession

This file replaces the illustrative 3.073 USD/ILS examples in the initial v3 document. The structural policy in v3 remains unchanged.
