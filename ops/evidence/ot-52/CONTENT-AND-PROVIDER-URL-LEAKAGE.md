# OT-52P Content And Provider URL Leakage

## Invariants

- Class/content adapters may return protected descriptors only.
- Service rejects descriptor `href` values that do not start with `/`.
- Service rejects descriptor token references that contain raw HTTP URLs.
- UI tests and browser harness scan rendered portal text for raw provider URL/provider words.

## Scan Notes

The scoped leakage scan found only expected items:

- Contract field name `launch_token_ref`.
- Regex/test assertions for `http`, provider, Zoom, and Meet.
- Deliberate negative test fixture with `https://provider.example.test/private-room`.
- Localhost router test URL.
- GitHub remote URLs in baseline evidence.

Production portal code contains no raw class/provider URL literal.
