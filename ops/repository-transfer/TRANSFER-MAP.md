# Repository Transfer Map

Active One Time operations now use `shloimie-beep/onetimev2`.

| Reference type | Previous value | Current value |
| --- | --- | --- |
| Repository slug | `webcraft-media/onetimev2` | `shloimie-beep/onetimev2` |
| HTTPS remote | `https://github.com/webcraft-media/onetimev2.git` | `https://github.com/shloimie-beep/onetimev2.git` |
| GitHub URL prefix | `https://github.com/webcraft-media/onetimev2` | `https://github.com/shloimie-beep/onetimev2` |
| GitHub API prefix | `https://api.github.com/repos/webcraft-media/onetimev2` | `https://api.github.com/repos/shloimie-beep/onetimev2` |

## Policy

- Active scripts, runbooks, release templates, director records, and preview handoff records must use `shloimie-beep/onetimev2`.
- Historical evidence, original prompts, old run ledgers, GitHub Actions logs, and captured API payloads may keep `webcraft-media/onetimev2` when the old owner is part of the source evidence.
- When an active document must cite a historical artifact that still contains the old owner, cite this transfer map instead of rewriting the historical record.
- New automation must query `shloimie-beep/onetimev2` directly and must not depend on GitHub redirects from the previous owner.
- Production deployment is not part of this transfer repair.

## Local Remote Repair

The active One Time checkout at `C:/Users/User/onetimev2` already used the canonical origin.
The local bare mirror at `C:/Users/User/onetimev2.git` had the previous origin and was repaired to:

```text
https://github.com/shloimie-beep/onetimev2.git
```

## Release Line

The current release line remains PR #92:

```text
https://github.com/shloimie-beep/onetimev2/pull/92
codex/one-time-finish-now-20260719
5ddd7b604c01744dd562050ae9b51124f7732594
```
