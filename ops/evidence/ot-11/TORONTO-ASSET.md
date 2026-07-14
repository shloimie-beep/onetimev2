# OT-11 Toronto Asset Evidence

## Source

- Operator-supplied source path: `C:\Users\User\Downloads\Toronto.jpg`
- Source SHA-256: `6D7A89319AF05032D300680B7CB39206079BE9DBB92061958B15FC8088C89157`
- Source dimensions read by Windows imaging: `1488x924`

## Generated Web Asset

- Output path: `apps/web/public/assets/outcomes/accomplishment-toronto-class.jpg`
- Output dimensions: `1200x745`
- Output format: JPEG, quality 84
- Output SHA-256: `17239865937B2B112272C2E57C43BC61A64B5CE38611CCF7DC90472970109C76`
- Assignment: Accomplishment card only
- Crop/focal rule: `object-position: 50% 48%`

## Verification

- Pre-edit checkpoint: `npm run verify` passed at HEAD `9d8b5b0`.
- Focused post-edit checks:
  - `npm run unit` passed.
  - `npm run e2e` passed with the Toronto crop test at `360x800`,
    `390x844`, `768x1024`, and `1440x1000`.
- Full post-edit gate: `npm run verify` passed.
- Built public landing output contains
  `/assets/outcomes/accomplishment-toronto-class.jpg`.
- Built public landing output does not contain the visible
  `Toronto.jpg pending` blocker.
- Built public landing/signup output and public bundle check found no
  `app-crm`, `operations`, `bna`, `BNA`, or `Operations` references in the
  public critical path inspected.

## Boundaries

- No substitute asset was used.
- No production service, production database, custom domain, external delivery,
  or BNA runtime was touched for this asset change.
