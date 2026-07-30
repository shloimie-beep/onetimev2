# P20 Acceptance Matrix

Implementation evidence is local and provider-free. Production-operator/provider
canaries remain outside P20's `external_authority: none`; the corresponding
migration, runtime, registration, and pinned-dependency work is recorded in
`STEWARD-REQUESTS.yaml`.

| Acceptance case                             | Task-owned evidence                                                                                                                                                                                                                                               | Result               |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `OTV2-CONTENT-084-AC01`                     | `content-processing.acceptance.test.ts` proves Admin begin/end selection, a single contiguous retained range, and exact `-ss`/`-t` argv.                                                                                                                          | implementation ready |
| `OTV2-CONTENT-085-AC01`                     | The domain test proves checksum-addressed bounded segments, complete ordered/non-overlapping English transcript segments, and traceable caption cues.                                                                                                             | implementation ready |
| `OTV2-CONTENT-086-AC01`                     | The domain test proves review, worksheet, and future knowledge drafts plus immutable Admin-edited revisions that return to draft review.                                                                                                                          | implementation ready |
| `OTV2-CONTENT-191-AC01`                     | The domain/script tests prove the 5 GiB limit, 4 MiB maximum stream chunk, incremental SHA-256, no whole-file buffer, no-upscale/capped output, and exact derivative readback rejection.                                                                          | implementation ready |
| `OTV2-CONTENT-193-AC01`                     | The domain/worker tests prove all seven output kinds persist as drafts and only an exact-version scoped Admin privacy review can approve them. No publish operation exists in this slice.                                                                         | implementation ready |
| `OTV2-CONTENT-233-OBS-CAPTURE`              | The domain test proves OBS-only capture, Zoom cloud off, controlled encrypted device, versioned consent/participant snapshot, visible/verbal notice, upload within 24 hours, and deletion eligibility only after exact readback/linkage.                          | implementation ready |
| `OTV2-CONTENT-233-STORAGE-MODELS-TRANSCODE` | The contract/domain/worker tests prove private versioned `eu-central-1` S3/SSE-KMS policy, `OT-VIDEO-1`, `gpt-4o-transcribe`, dated `gpt-4.1-mini-2025-04-14`, strict registered schema, no tools/carry-over, source-version binding, and draft-only disposition. | implementation ready |

Focused verification: 4 files, 15 tests, all passed. Typecheck, focused ESLint,
focused Prettier, secret scan, and diff hygiene passed. External effects:
attempted 0, succeeded 0, reconciled 0.
