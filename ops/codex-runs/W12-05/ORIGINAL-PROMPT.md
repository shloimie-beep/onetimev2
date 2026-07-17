# W12-05 Original Prompt

## Operator Request

```text
## W12-05

Find exactly one ZIP named W12-NEXT-PARALLEL-WAVE-2026-07-17.zip in my Downloads folder. Validate archive safety and hashes. Read 00-START-HERE.md, then execute prompts/CODEX-W12-05-TELEGRAM-OPERATIONS.md completely in a clean isolated worktree. Never ask me to paste a bot token into chat or Git. Preserve state, push, and open a draft PR. Do not register or mutate a production webhook.
```

## Validated Packet

- ZIP path: `C:\Users\User\Downloads\W12-NEXT-PARALLEL-WAVE-2026-07-17.zip`
- ZIP SHA-256: `D26BF78FB3887F1B7D705CEDE101ACB0AE3F611C2C86F73C850FCC9AB213FD3B`
- Extracted packet path: `C:\Users\User\AppData\Local\Temp\BNA-W12-05-packet-20260717T103000Z\W12-NEXT-PARALLEL-WAVE-2026-07-17`
- `SHA256SUMS.txt` verification: 19 files verified, 0 failures.
- `00-START-HERE.md` SHA-256: `FDD3A0E0A166476A6AD9A43FF0C223E025832BC006D1DB0FA653037A55E41FA6`
- `prompts/CODEX-W12-05-TELEGRAM-OPERATIONS.md` SHA-256: `ABE0426A68B291CD92221FED42D91867E4418DFBDD3141B2FF4F26DB9E024F1C`
- `MANIFEST.json` SHA-256: `80D9B17C5D94E88C27CCD4D9F36915AA2C635B1E5AF6512BA00687718E4C6F87`

## W12-05 Prompt Summary

The W12-05 lane completes a separate One Time Rabbi/admin Telegram operations bot for the Rabbi owner and Shloimie administrator. It must use the same application services as the web app, server-side Telegram identity mapping, deny-by-default authorization, fixed One Time account/product scope, redacted logs/results, replay-safe inbox/worker handling, and separate operation from the BNA/Academy bot.

Required V1 capabilities:

- today's class and upcoming schedule;
- safe app links for class, contact, content, and support pages;
- find a contact with a redacted result;
- communication/delivery status;
- Vimeo/content processing status and approved retry request;
- create, update, and view tasks;
- retry only approved retryable failed delivery;
- subscriber support-ticket status;
- help and capability discovery.

Mutation guardrails:

- explicit confirmation;
- idempotency;
- role/capability authorization;
- audit event;
- safe result;
- no arbitrary SQL, shell, code change, deploy, prompt editing, secret access, bulk send, payment, or production configuration action.

Runtime and safety guardrails:

- one token, one webhook/polling consumer, lease/deduplication, replay-safe inbox/worker;
- owner/admin mapped identities;
- unknown users receive no private data;
- webhook secret, request limits, constant-time validation, redacted logs, health/readiness;
- protected Railway variables for token, secret, and user mappings;
- never ask the user to paste a token into chat or store it in Git/evidence;
- provide runbook for protected token entry, webhook registration, duplicate consumer detection, token rotation, bounded canary, and rollback;
- no production webhook registration, real Telegram send, token mutation, deploy, or BNA mutation in this lane.

