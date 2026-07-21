# GHL Event Workflow Handoff

Status: ready for Agent Mode configuration once the HighLevel event workflow is created or selected.

Location:

- `pBSnOK2nkdxp6gf9Rg3o`

Visible sender:

- `Rabbi Eli Scheller | One Time Mishnayos`

From and Reply-To:

- `info@onetimeonetime.com`

Required tags:

- `OT | Event | Tisha B'Av 2026 | Invited`
- `OT | Event | Tisha B'Av 2026 | Registered`
- `OT | Event | Tisha B'Av 2026 | Attended`
- `OT | Event | Tisha B'Av 2026 | No Show`
- `OT | Event | Tisha B'Av 2026 | Replay Sent`
- `OT | Source | Tisha B'Av 2026`

Registration sync behavior:

- Upsert one adult contact by normalized email.
- Preserve unrelated tags by only adding event tags.
- Set custom field `One Time Signup Source` to `Tisha B'Av 2026 Landing`.
- Add `OT | Weekly Newsletter` only when explicit newsletter consent is true.
- Request the event confirmation/reminder workflow idempotently.

Workflow copy requirement:

- Use the exact operator copy captured in `EMAIL-COPY-RAW.md`; the parsed implementation packet is `EMAIL-COPY-SPEC.json`.
- Confirmation and reminders must not include a raw Zoom URL until the protected meeting mapping is ready.
- Confirmation copy must say the private access details will be emailed before the program, not that they already were delivered.
