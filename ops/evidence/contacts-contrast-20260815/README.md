# Contacts contrast acceptance

Exact base: `0ed5c3955892450d8985765d622d5fb7809b5c95`

Route and scope: mounted Admin `/app/contacts` list and detail, using the isolated in-memory
test server. The authenticated shell currently exposes one dark theme. No provider, production,
GHL, billing, or persistent database effect was exercised. The product copy and request log both
preserve adult-account-only CRM scope and zero Student GHL contacts.

## Result

| Phase  | Viewports                         | Surfaces | Minimum computed ratio | Axe violations | Contrast failures | Overflow |
| ------ | --------------------------------- | -------- | ---------------------- | -------------- | ----------------- | -------- |
| Before | 390x844, 768x1024, 1440x1000     | 6        | 3.84:1                 | 0              | 3                 | none     |
| After  | 390x844, 768x1024, 1440x1000     | 6        | 13.36:1                | 0              | 0                 | none     |

The baseline Contact names were white, but the Search placeholder inherited Chromium's faded
`rgb(117, 117, 117)` default and measured only 3.84:1 against the input surface. Axe did not report
that pseudo-element, which is why the focused computed-color gate is retained. Secondary Contact
copy was also tied to a muted literal and the list/detail palette relied on route-level hex values.
The candidate gives normal Contacts copy and placeholders explicit primary/secondary semantic
roles, raises the weakest mounted result to 13.36:1, and binds surfaces, borders, and focus
treatment to shared brand tokens.

The `before` phase deterministically restores the exact-base secondary value and inherited browser
placeholder style inside the isolated page. It does not modify repository source or any external
system.

`before/contrast-report.json` and `after/contrast-report.json` contain every measured text sample,
computed foreground/background pair, ratio, Axe count, and responsive overflow result. Each phase
also contains list and detail screenshots for all three required viewports.

Reproduce the candidate proof after `npm run build`:

```powershell
$env:CONTACTS_CONTRAST_EVIDENCE_PHASE='after'
npx playwright test tests/accessibility/contacts-contrast.spec.ts --project=chromium
```
