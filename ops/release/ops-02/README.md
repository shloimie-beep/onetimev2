# OPS-02 Staging Activation Assets

These assets are reusable preparation tooling for isolated One Time staging.
They do not deploy, create Railway resources, mutate databases, change DNS,
send messages, charge cards, create real users, or copy production data.

Run the static checkpoint locally with:

```bash
node scripts/ops-02/validate-static.mjs
```

The top-level OPS-02 status remains `waiting_for_ot99_sha` until a future
accepted OT-99 exact SHA satisfies the resolver's eligibility conditions.
