# W12-08 Packet Validation

Validated on 2026-07-17 before product edits.

## Archive

- ZIP: `C:\Users\User\Downloads\W12-NEXT-PARALLEL-WAVE-2026-07-17.zip`
- ZIP count in Downloads: `1`
- ZIP SHA-256: `d26bf78fb3887f1b7d705cede101acb0ae3f611c2c86f73c850fcc9ab213fd3b`
- Entries: `23`
- Total compressed bytes: `27254`
- Total uncompressed bytes: `53281`

## Safety Checks

- No rooted, drive-qualified, or UNC paths.
- No `..` traversal segments.
- No symlink entries detected.
- No control characters in entry names.
- No suspicious entry size or compression ratio.
- Extracted only after the safety scan passed.

## Hash Verification

`SHA256SUMS.txt` contained `19` file entries. Every listed file matched its expected SHA-256 after extraction.

Key prompt hashes:

- `00-START-HERE.md`: `fdd3a0e0a166476a6ad9a43ff0c223e025832bc006d1db0fa653037a55e41fa6`
- `prompts/CODEX-W12-08-ADMIN-CLASSROOM-PRODUCTIZATION.md`: `224424075617818559155cf16d3aaedf83abf80bb0fc9dd8be2f475ce7b5d743`
- `MANIFEST.json`: `80d9b17c5d94e88c27ccd4d9f36915aa2c635b1e5af6512ba00687718e4c6f87`

## Source Selection

- Target repo: `webcraft-media/onetimev2`
- Selected source: `origin/release/ops10-full-staged-production-launch-20260717T050800Z`
- Selected source SHA: `c7d46066517d7a458d189f2c782cc06200f7861c`
- Reason: OPS-11 marked PR #61 `LIVE_LOGIN_READY`; PR #61 is open as the accepted release candidate and all listed checks are green.
