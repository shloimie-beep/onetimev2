# Intent Change Receipt - SPEC-20260721-010

Fingerprint: df3cbccf409bfe09788297eec926817918c86fe3e326a98d915f02f308709f39

- CHG-20260721-010 | /tisha-bav > Canonical event schedule > Email catalog and workflow schedule > 2026-07-23T15:00:00-04:00 | behavior | The event remains Thursday, July 23, 2026 at 3:00 PM Eastern / 10:00 PM Israel. Every dated email and the one-hour and ten-minute workflow waits must derive from the same canonical event start and fail validation when they diverge.
- CHG-20260721-011 | /tisha-bav > Warm invitation > HighLevel email template > Reserve My Place | add | Preserve the operator's From, Reply-To, subject, preview, body, merge token, line order, and CTA label exactly; map the CTA to /tisha-bav.
- CHG-20260721-012 | /tisha-bav > Registration confirmation > HighLevel email template and bounded fallback > View Event Details | add | Preserve the exact confirmation subject, body, merge token, line order, and CTA label; map the CTA to /tisha-bav and queue it immediately after registration.
- CHG-20260721-013 | /tisha-bav/live > One-hour reminder > HighLevel email template and workflow wait > Open the Live Event Page | add | Preserve the exact subject, body, merge token, line order, and CTA label; map the CTA to /tisha-bav/live and schedule it exactly 60 minutes before the canonical event start.
- CHG-20260721-014 | /tisha-bav/live > Ten-minute reminder > HighLevel email template and workflow wait > Join the Live Program | add | Preserve the exact subject, body, merge token, line order, and CTA label; map the CTA to /tisha-bav/live and schedule it exactly 10 minutes before the canonical event start.
