# W13-104 — Inputs that determine which external lanes can finish

The prompt can run immediately. To guarantee that login links arrive in an inbox, the One Time Railway project must privately contain a transactional email API credential, verified sender/domain, from/reply-to identities, webhook signing secret, and an operator-controlled canary address. No prompt can create a provider credential or verify domain ownership by itself.

The conductor will create/check three private authorization manifests under `C:\Users\User\.onetime-w13-104-private\`: `EMAIL-INPUTS.private.json`, `CANARY-AUTHORIZATION.private.json`, and `CRM-IMPORT-AUTHORIZATION.private.json`. It will not treat a saved credential, phone number, spreadsheet, or file hash as permission by itself.

Other provider lanes require their own protected credentials/accounts:

- approved Rabbi recipient authorization for an owner activation;
- accepted CRM files/hashes plus explicit source ownership, column/dedupe mapping, tag rules, and `apply_to_production=true` authorization;
- WhatsApp provider/webhook and allowlisted canary number;
- Telegram bot token/webhook and mapped operator/Rabbi chats;
- Zoom server-to-server/SDK/webhook configuration;
- Vimeo token/account/webhook and one owned private item;
- OpenAI API configuration and one approved Rabbi content item;
- BNA v2 receiver/HMAC configuration;
- Stripe TEST credentials/product/price/portal/webhook configuration;
- Buffer account/token/destination, if draft support is desired.

Keep every value in Railway protected variables or `C:\Users\User\.onetime-w13-104-private\`. Never paste secrets into ChatGPT, Codex prompts, Git, PRs, screenshots, or reports.

Run only one W13-104 window. No other window may deploy, migrate, import CRM data, provision identities, enable providers, modify Railway, or merge PR #91 concurrently.
