# OT-LIVE-001.03 landing asset provenance

## Authentic Rabbi Scheller hero photograph

- Repository path: `apps/web/public/assets/rabbi/rabbi-eli-holding-book.jpg`
- SHA-256: `bac24630186e190f11848d3177040553445310b50b91e42cea2c42bca328ac16`
- Dimensions: `1600 × 1067`
- Repository provenance: present in the standalone One Time repository from commit `610b585f` (`chore: initialize standalone One Time foundation`, 2026-07-14).
- Repair treatment: the original file is referenced directly by the landing-page `<img>`. No generated pixels, restoration, retouching, face or eye changes, filters, AI upscaling, or derived image file were applied. Responsive CSS may crop the displayed frame through ordinary `object-fit` positioning without changing the source bytes.

## Operator-supplied How It Works overview

- Operator source path: `C:\Users\User\Downloads\ChatGPT Image Aug 3, 2026, 04_17_28 PM.png`
- Repository path: `apps/web/public/assets/how-it-works/family-learning-overview.png`
- SHA-256: `52185ec4c7b7987cef5a003b3694d33af3916e8f178ccf3270c6c5a33477a171`
- Dimensions: `1122 × 1402`
- Provenance: exact byte-for-byte copy of the most recently supplied Downloads image; no image edit was applied during import.

## Sanitized protected-flow screenshots

All three screenshots are 1265 × 712 browser captures from the locally running application with the repository's isolated, synthetic `example.test` fixtures. They contain no real customer data, credentials, tokens, raw internal identifiers, or provider URLs.

- `apps/web/public/assets/how-it-works/parent-manages-students.png`
  - SHA-256: `271e008be5fe195787fa86f4a1fc4e0b19e2bdeb4fdd734d6ec8e338219bd3ba`
  - Working route: `/app/parent/students`, after synthetic Parent authentication; the learner-management workspace and protected Student-access controls rendered.
- `apps/web/public/assets/how-it-works/student-opens-live-class.png`
  - SHA-256: `53a6ad45d7b047fe1e128ac5bf2e7f920781de9ae099d544c4f991f6b23a1cbf`
  - Working route: `/app/student`, during the isolated join window; the `Join class` control was exercised and opened `/classroom/launch`, whose browser state read `Classroom is ready`, before the launch-surface screenshot was retained.
- `apps/web/public/assets/how-it-works/student-opens-library.png`
  - SHA-256: `9dd7fe344020576df10130f9666b395613d6b16a6533b96f7acd593984e78d9f`
  - Working route: `/app/student/library`, after synthetic Student authentication; the entitled recording and review sheet rendered without a provider URL.
