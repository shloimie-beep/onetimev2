# P23 Next Prompt

STOP pending C00 reconciliation of the exact pushed P23 residual-correction
claim on `codex/v21-p23-student-notifications`.

Verify its sole parent is rejected final
`87da1f244ea8e19838c2695678089d1bcbe9687a`, its delta contains exactly
`TASK-STATE.yaml`, `HANDOFF.md`, and `NEXT-PROMPT.md` under the P23 runtime,
and it binds:

- authorization `a95a1406200b139b4acd501c7b96821e6f74070a`;
- sole acquisition parent `6b3bb0619f3af04cb5a20a4f8650cc8ec6b042d4`;
- claim `f7e3fb0e-a8d4-416b-8c79-786a696e2dc4`;
- lease `f7b63d5e-489c-40aa-a793-9a7210f91bca`;
- READY digest
  `976b5c80e4bc3f437301603982168f3b4c7d3247fc8a26831006933d70432204`;
- external effects `none / 0 / 0 / 0`.

Do not implement route, route-admission, tab-keyboard, test, or request changes
until C00 explicitly reconciles this claim and grants bounded continuation.
