MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Continue One Time v2.1 task C00 from its remote checkpoint.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-control
Authoritative control ref: origin/codex/v21-control
Task packet: ops/v2.1-execution/tasks/C00.yaml
Task context: ops/v2.1-execution/contexts/C00-CONTEXT.md
Task state: ops/v2.1-execution/runtime/C00/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/C00/HANDOFF.md

Fetch remote refs and require the exact remote control head. Read
`CONTROL-STATE.yaml` and resume its first incomplete bootstrap phase. Verify
`LOCKED-SHA256SUMS.txt`, the current control/runtime digests, and the active
C00 lease. Reject any live foreign lease or non-fast-forward collision.

Bootstrap is operational and autonomous native-subagent orchestration is
enabled. The root C00 agent alone dispatches workers; child workers never spawn
product writers or edit control state. F01's interface is integrated at
`80c281b7ae5826ed2c6abe95ba68a033ffa52174`; F01 acknowledged both I36
rejection results at `dc991ef901617cc6d7e4fe780c53b4833172a0a2` and waits
for F03's remaining auth-steward result. F07 remains independently verified
and `ready_for_review`. P31 is ancestry-integrated at merge commit
`42b09dc598e0dfc17ada53b441e4cd487e126573`, with I36's final metadata
checkpoint at exact integration head
`eefca0644e57dca48609682cbc3e1b01992d286d`.

F02's corrected exact checkpoint is
`e4673ff1c2e621e26ac93034be245b280c4da4fa`, backed by implementation
`191dac288ea1721bdc0252bd012060ca974d2242`, interface digest
`c03e01d7e16bdc252b9964f1acfc60d40e772de98776023c20f7589e467b5ccd`,
and migration-2234 checksum
`d1352c5e46ae56ca549c9939ef739923109b4a0ab04f0d4df00c04dca71ccb22`.
C00 independently verified and admitted it. I36 ancestry-merged F02 at
`e6b49dff79911f3f11b6d2c0ce6a9a52d50bf7f4` and published exact final
integration head `d8b35b2aaa0dc4b687b6e88192c7eac6222ecdec`; typecheck,
focused transition proof, native PostgreSQL migration proof, ancestry, exact
scope, and zero effects passed. P35 completed `ready_for_review` at
`a85aecc22b013d583589a67cf0cc9dfad6745aba`, implementation head
`6b92adbf893c45f4a767b8036ec41b52744cce4e`, state/handoff digest
`e524a2756fecb4ab6816e972211d858a729872f349459b0863754f3a72d01475`,
with three immutable steward requests assigned to later I36 checkpoints.

F03, F04, and F05 are independently verified and `ready_for_review`. Their
exact admitted interface sources are F03
`7c638131a0cab757657e95c4d2229a1573e4cde1`, F04
`4cc95c29c6012174595ba1821e0554aca8572e08`, and F05
`0656380bcfc50cc464dcea7588448dc724049599`. F04 deliberately uses the
interface-era checkpoint, excluding its later repository-only hardening from
this wave. F03's applied `F01-retired-auth-001` result is recorded at digest
`f557eacfce20aace5ea74ec926e09c949f7d80e660ac44021b445476d5f53f6e`.
F04/F05 migration and registration requests are assigned but unapplied.

I36 integrated F03/F04/F05 in exact order and published final integration
head `9782a4164662b8059a557c0969de9c35f54d0cf7`; all sources are ancestral,
typecheck and 49 focused tests pass, and zero steward/external effects were
performed. F01 acknowledged the applied F03 result and is `ready_for_review`
at `b5344992a43a735a9c66047fecd83f951651de27`. P15 is `ready_for_review`
at `c96b8c55c07e5283e762537934a6bf948833700e`, with implementation
`ab71afb032b8e004cc655e3e5f5a6b8286aec380`, exact interface digest
`2ebe108d2aa39a90908889bf9cf8f96cffb93d296e7ee9614e0d1bb5b351c3eb`,
state/handoff `cb8551031e184df2f727f1df5f54733ab02b1226fb1f00f11ed17b65e0c6f4ce`,
two assigned but unapplied steward requests, and zero effects.

P15 is ancestry-integrated at final head `01cdb992`. I36, P16, and P32
atomically claimed at `98f5689b`, `45649e52`, and `a174a5e7`; exact scopes,
bindings, and zero effects passed. I36 completed the ordered F06/P14 ancestry
wave at merge heads `f1ba79a9` and `41954f00`, with final integration metadata
`d35166838267711a514cf73822cd2ca49a3f3ded`; all checks and zero-effect
verification passed. P32 completed `ready_for_review` at `f4ae1c03`, with
interface source `6a33944a`, implementation `888af549`, exact contract digest
`76d0858798dbb7a14c93666ab9f0c647107d380464ec2d6b582657865eecf217`,
state/handoff `215a3e38...`, 21 focused tests, typecheck, and zero effects.
Its exact interface is queued for an atomic-claim-only I36 merge, and its three
steward requests are assigned but unapplied. P27 safely refused stale authority
after the C00 acquisition and is rebound to the same integration parent. Dispatch
the P27 and I36 atomic claims while P16 continues. Both claims are now exact:
P27 `4b55f314f86a0532387d5b6e0a6ace486858f7f1` and I36
`ffd63f4e3cdaa671f0c84645cf4b82edf8d95ac8`, each with only three task-local
runtime files and zero effects. The ready queue is consumed and the P32 merge
target CAS is rebound to `ffd63f4e`. Resume P27 implementation and I36's
P32-only ancestry merge. P16 stopped at unchanged head `45649e52` before any
further writes; its implementation remains only as a P16-owned dirty draft.
P16 consumed its renewal at exact head `f865439f9b37eba1a6dd0fcddc80f67b19c283a8`
with only three runtime files, preserving its owned draft unstaged. I36 merged
P32 at `7a176159` and published final integration head
`c4d042e94b3f7e779fd6bfd41127dd9576854805`; all checks passed with zero
effects and no steward action. P27 completed `ready_for_review` at `e1933d64`,
with interface `e706587b`, implementation `7d5edd68`, contract `788e150f...`,
interface state/handoff `d911136b...`, 10 focused tests, typecheck, and zero
effects. Its two steward requests are assigned but unapplied. The exact P27
interface is queued for atomic-claim-only I36 integration while P16 continues.
I36 consumed that atomic authorization at exact integration head
`8d90ca47c5396002a04ed0de53249ce8eac7ca52`. C00 rebound P27 merge item
`26b826f0-b0b1-4c03-8bf5-06af4ad5e7ce` to that target with canonical digest
`462a693c41463fc8cb3b7db2252c9e6c6ccf2c0061ec582d37b4640acc9edfe2`.
P16 completed `ready_for_review` at `72fca16b3a9cd82c666e293f8bfd7d84c30722a1`,
with interface `418ffcc5`, implementation `46b5c39a`, semantic contract
`95c177d5...`, 17 focused tests, typecheck, and zero effects. Its two steward
requests are assigned but unapplied. Resume I36 to merge only P27; authorize
P16 in a separate later integration transaction.
I36 merged P27 at exact two-parent head `91522295c4b6f7f3871cdd7085d16d7d3620e1ea`
and published final metadata `972fa43507d6d4391a86dd130a1c38a05820b2ce`.
The P27 source is ancestral, its exact scope/checks passed, P16 is absent, no
steward request was applied, and effects remain zero. C00 retired P27's merge
item and queued only P16 for fresh I36 atomic claim
`ff8bf935-3e65-4ed9-aa52-4032cfb5f7e6` from `972fa435`. Stop after that claim
so C00 can rebind the P16 optimistic target CAS before the merge.
I36 published that atomic claim at `47166ef026bb34842ec306cf7c2d2fc363773ad7`
with sole parent `972fa435` and exactly its three runtime files. P16 remains
absent. C00 rebound only merge item `cbf396c5-6b57-4ce6-b343-9a8c8fb3ae95`
to `47166ef0`; canonical payload is `e58c0de4886e2d9f40355848a6d3e3bdeb2db47ee6594d6f9d3ca7c931dc99c2`.
Resume I36 to merge only P16 and apply no steward request.
I36 merged P16 at exact two-parent head `387ca78ee33af7d2d4fd19d45a1b01981afaaad3`
and published final metadata `9ba92b070eedfa3756eff4f78fd328de72507a96`.
All scope, artifact, contract, typecheck, 17-test, lint, formatting, ancestry,
and zero-effect checks passed; no steward request was applied. The merge queue
is empty. C00 selected the three dependency-valid capacity lanes with the
largest immediate critical-path value: P18 embedded classroom, P19 content
ingest (unlocks P20), and P28 communication foundation (unlocks P29/P30).
Dispatch their exact ready entries from `9ba92b07`.
All three atomic claims are exact and remotely verified: P18 `9b37f4a0`,
P19 `5529d398`, and P28 `09082e99`, each with sole parent `9ba92b07`, only its
three task-local runtime files, correct containing authorization `e847dd79`,
and zero effects. The ready queue is consumed; monitor their independent
implementation/interface checkpoints.
P19 completed `ready_for_review` at `306c26cf`, with implementation `308a0291`,
interface `e420eb83`, exact contract `44952e92`, 25-path scope, 21 tests,
typecheck, and zero effects. Its three canonical steward requests are assigned
but unapplied. C00 queued only this interface for I36 atomic claim
`391d7764-3f93-43c8-86dc-07df6f59d0b1` from `9ba92b07`. P18 is also complete
at `0a384577` pending admission; P28 interface `aaedc3f2` awaits its final.
P18 and P28 are now admitted at finals `0a384577` and `f891f16e`; their exact
canonical steward requests are assigned but unapplied. I36 consumed the P19
atomic claim at `7aac6f05`; C00 rebound only item `d3acb266` to that target
with canonical digest `45eb7d395582ee4509dde7e26ad6a1099c46c476628b8e40dc9933b4b2a55aa6`.
Resume I36 to merge only P19. P28 interface remains separate and unqueued.
Before every later control mutation, acquire a
fresh serialized C00 lease against the exact fetched remote control head;
release it before waiting for workers.
Update C00 state, handoff, and this prompt at every phase; commit and normal-push
each checkpoint. Never implement product code, grant provider authority, or
force-push.

P19 is integrated at final I36 head `ebf88c8e`. Dispatch I36 claim
`9b1ad11d-f16c-40e7-aec9-e07172c90034` for P28-only integration and P20 claim
`1cd7bf99-21a7-4231-8418-b9cdfaf958c4` for the new media-processing branch.
Each worker must stop after its exact three-file atomic claim. Acquire a fresh
C00 lease, consume the claims, and rebind only P28 merge item
`58c0a26a-cb58-4dfb-a4a8-082ae171537e` before I36 merges it. P20 may then
continue independently under its unchanged owned scope and lease.

The atomic claims are verified and consumed. Resume I36 at `85cfc9f2` to merge
only P28 item `58c0a26a-cb58-4dfb-a4a8-082ae171537e`, canonical rebound digest
`ece27747cee4dbad47e53eb34f8d8548cf36753624d2d256d3a0991c172342e1`,
source `aaedc3f2`, base `9ba92b07`, exact 36 paths, and no steward action.
Resume P20 at `6f894038` for normal implementation. Reconcile both final
checkpoints under a fresh serialized C00 lease.

P28 integration is complete at `49431959`. Dispatch P29 claim
`6b96052a-b3f4-429f-9aab-3cbc8ec78e7e` with ready digest `193b50e8...` and
P30 claim `9c4e04b6-485c-4d91-aed4-40e2b8be9aab` with ready digest
`2b0b3f11...`, both from exact start `49431959`. Each stops after the exact
three runtime files. Reconcile claims under a fresh C00 lease, then resume
both implementations while continuing to monitor P20.

The P29/P30 claims are verified and consumed. Resume P29 at `704435bd` and
P30 at `c42eb2b9` for full task implementation, verification, structured
steward requests where required, ready_for_review publication, and lease
release. Continue P20 at `6f894038`. Reconcile finals under a fresh C00 lease.

P20 is admitted at final `3d75b57e`. Dispatch P17 claim
`863e3375-64af-4763-8efd-80d424da2ed9`, ready digest `7c6eda01...`, from exact
start `49431959` on `codex/v21-p17-zoom-preparation`. Stop after its exact
three runtime files, reconcile under a fresh C00 lease, then resume full P17
implementation while continuing P29/P30.

The P17 claim is verified and consumed. Resume P17 at `25614df1` for full task
implementation, verification, structured steward requests where required,
ready_for_review publication, and task-local lease release. Continue monitoring
the independently active P29 and P30 finals.

P29/P30 admission is rejected pending corrections. Dispatch claim-only resume
checkpoints from exact heads `15dc7c87` and `337baba3` using claims
`22467835-84ad-4d38-8187-a3b64d88d132` and
`cea57710-2506-4983-a821-4e23733d0766`, ready digests `4b5b332d...` and
`f7d3413b...`. Each atomic checkpoint may modify only its three runtime files.
Reconcile both claims, then resume the bounded audit findings while P17 runs.

Both correction claims are verified and consumed. Resume P29 at `d5c779ca`
and P30 at `2f2aa5c9` for only the recorded audit repairs, add negative
regression coverage, rerun full verification, refresh all material digests and
runtime proofs, release each task-local lease, and publish corrected
ready_for_review finals. Continue P17 independently.

P17 admission is rejected pending bounded binding and operation-set repairs.
Dispatch a claim-only resume checkpoint from exact head `0e6119a4` using claim
`0c6d8f9d-c1d7-4b0e-a3da-ddab1ff3292b`, ready digest `f6ad4c57...`, and
ZOOM_PREPARATION lease `bbf96443-a927-4198-bd2a-85e40b7162cd`. The atomic
checkpoint may modify only P17's three runtime memory files. Reconcile it before
product repair while P29/P30 continue.

Discard the superseded P17/P29/P30 claim bindings whose recorded parent SHA
only matched the short prefix. Dispatch new claim-only resume checkpoints from
P17 `0e6119a4`, P29 `d5c779ca`, and P30 `f6d074e9`, all bound to exact actual
control parent `e54ea923a743caf760ef47638a2c8d8a875faf34`. Claims are
`ad77a398-b287-4a51-b7cc-25dd147f33de`,
`308031d1-15e8-4ff5-aca0-6560e9a8c93d`, and
`87608f7e-3d2b-448b-8376-da025b05d1b7`; ready digests are `81174a93...`,
`634d4c80...`, and `380e1f3d...`. Reconcile before any product continuation.

All corrected claims are reconciled under exact C00 acquisition
`5b0356cc30baf4062e50664f9749ebcf97f9d7f4`. Resume P17 at `a72f1a0b`,
P29 at `56fcfcee`, and P30 at `8e9583a9`. P29 must restore only its named
preserved repair stash. P30 must verify and finalize the controller-adopted
repair implementation already below its claim. Each worker is limited to the
recorded audit repair, negative regression coverage, full checks, refreshed
material digests/runtime proofs, lease release, and a new ready_for_review
final. Keep all external/provider effect counts at zero.

P17, P29, and P30 corrected finals are admitted. Dispatch claim-only starts
for P08 on `codex/v21-p08-family-signup` with claim `798ccc6e...` and digest
`d52ad4ce...`, P10 on `codex/v21-p10-admin-directory` with claim
`f7e5889d...` and digest `91d515fb...`, and P33 on
`codex/v21-p33-runtime-operations` with claim `e0ba9363...` and digest
`05f3889c...`. Each new branch must have sole parent exact integration head
`49431959f58f284bdc13ca931acf09f980fc483a`, must first change only its three
task-local runtime files, and must stop for C00 reconciliation before product
work. All entries bind exact acquisition `de271a6cab5fc74e8c77b5defc302094fe9a22fc`.

The three claims are verified and consumed under exact acquisition
`629577e2ea6da2fdeca7754a6f314b6b254e952e`. Resume P08 at `a22ab6d8`,
P10 at `42602096`, and P33 at `e7a2760c` for full task-owned implementation,
required interface checkpoints for P08/P33, focused and repository-relevant
verification, refreshed runtime proof, and lease release. No provider effects,
shared-path edits, migrations, manifest/lockfile changes, or fake fallbacks are
authorized.

Exact P18 final `3be7bf4930a02ea5559db057ceedd6bb11a1b543` and P21 final
`83d906221a0f2882cf99a75459e7288a3e30f629` are accepted and queued in that
order from exact integration `99fd8c33ea023e838d8ee9c993b5de52f4763e7f`.
C00 is the direct integration writer under I36 claim
`1f77c6ea-f888-4f47-a16c-3b30f8549e6c` and RELEASE_INTEGRATOR lease
`6abdf7d4-e6fb-4cce-8e06-2dbd5064dde3` through
`2026-07-30T13:09:12Z`.

Perform only the two ordered source merges, preserve both source heads as
ancestors, run the focused P21 five-file test set and exact scope/ancestry
checks, update the I36 runtime triplet once with terminal release evidence,
release the lease, and push normally. Do not add a claim-only integration
commit. Do not apply migrations or shared registrations, freeze a candidate,
inspect or mutate a provider, deploy, send, enroll, charge, change DNS, or
perform any external effect.

P08 interface `b7601c002d2c37d0ef7760c328015f9a8d590893` and P33
interface `8c8dee4e1c8ab95ddab31d10cf17741a6cce6966` have passed independent
lineage, scope, artifact-hash, canonical-digest, verification, and zero-effect
checks. Dispatch I36 resume claim `a2ae8e13-f123-4190-badc-58269ced4219`
from exact integration head `49431959f58f284bdc13ca931acf09f980fc483a`
for a claim-only checkpoint, reconcile it, rebind the P08 merge target CAS,
and integrate P08. Then queue P33 against the exact resulting integration
head. In parallel, audit P08 final `59b43a601225d6f86a929621c89402d06ada39e4`
and continue monitoring P10/P33. No provider effects are authorized.

I36 atomic claim `2e3093987ae9a8094777224f7f308a56e92c6a50` is reconciled,
but P08 interface `b7601c002d2c37d0ef7760c328015f9a8d590893` is withdrawn
because its caller-controlled idempotency contract must change. I36 must
publish only a metadata release checkpoint with no source admission. P08 final
`59b43a60` is rejected: before product
correction it must publish claim-only resume checkpoint
`e9148002-e9ff-4b7c-ab6e-63080c66bd00` from that exact head, with only its
three runtime files and zero effects. After reconciliation, correct existing
local-account proof, inactive-household dedupe, and scope-bound strong
idempotency with negative tests. Separately audit P10 `92212a7b` and P33
`122608b5`; use only P33 superseding interface `0e674da7`/`9ac5c08a`.

I36 release `87e3ba67c6433d249a29be9eac99f780ffc99683` and P08
correction claim `53e1ef74fc988aab22d12d6716f30cb841130fde` are independently
verified and reconciled under exact acquisition
`382ea5193b1de8fc8cd2844dde362106a8a0f57f`. Resume P08 from that exact
claim head for only the three recorded semantic repairs and their negative
regression coverage. Recompute any changed interface/artifact/state digests,
release the FAMILY_SIGNUP lease, publish a new ready_for_review final, and keep
external effects at zero. P09 stays locked. Continue independent admission
review of P10 final `92212a7b` and P33 superseding final `122608b5`.

P10 `92212a7b` and P33 `122608b5` are rejected pending bounded corrections.
Dispatch claim-only P10 resume `0f061200-ff84-449d-aaa7-b0ebd7cd9c02`
with ADMIN_DIRECTORY lease `c3ee876e-793d-4c19-9a4c-40de4f27e758`,
ready digest `526ce8d0d61a88d2def1cf58d9d8d8e8375e03760e7c00db3dec5fab70168467`;
and P33 resume `9f112031-01ef-4117-986d-27465a06d19e` with
OPERATIONS_RUNTIME lease `76b4bb8b-af8b-4fcf-9ed7-4054ed8fe57a`,
ready digest `639b020e9df4dd07e1394aa40a3053d9e7d7cdd6471a7923ef57701d2c009ad6`.
Both entries are based on exact acquisition
`c743420931244135bcd61578ea1f322851b325a8`, expire at
`2026-07-29T02:39:10Z`, and authorize only three task-local runtime files for
the atomic claim. Reconcile both exact heads before any product correction.
P08 continues independently from its already reconciled correction claim.

P10 claim head `0b34fdf6b43cc3cdd7b003234a89f119b7e4a5c7` and P33 claim
head `a956c9dd1c9d072a54e640fc004684f2e037c033` are independently verified
and reconciled under acquisition
`34d3cea8cf05d2de7b2d9c74eb0fc04f61274df4`. Resume both from those exact
heads under their unchanged leases for only the recorded audit repairs and
negative regression tests. Refresh every changed artifact/interface/state and
steward-request digest, release each lease, and publish new ready_for_review
finals. Keep effects at zero; do not integrate either prior rejected interface.

P08 final `605c659afe488e32114bae57b3751c044301bdca` is mechanically
clean but semantically rejected after exact comparison with PS-006.2,
ACT-PUBLIC, UI-010.2, and UI-010.3. Publish only atomic task-runtime claim
`a456f914-02cb-4c08-9717-af9709f1948a` from that exact head, then stop for
C00 reconciliation. After reconciliation, correct server IANA validation and
editable/searchable timezone form metadata; exact password confirmation and
separate optional general-marketing/Parent-newsletter choices without inferred
consent; remove P09-owned School command/form details while preserving the
mutually exclusive branch seam; and block post-expiry Checkout while GHL
identity is `identity_review`. Republish the superseding interface and all
digests with negative tests, a released lease, and zero effects.

Do not use invalid P08 claim `a456f914` or its ready digest. Its controller
entry referenced a nonexistent long acquisition SHA. From exact runtime-only
head `615e124dd49030e3af5e01d94518aea76b6a733e`, publish only replacement
atomic claim `60986795-c22a-4861-9e98-a93de2c1d22e` using the corrected
ready entry based on exact acquisition
`ab5e5cc865be45ef0a71bcec7d71d7df1c787744` and its fresh FAMILY_SIGNUP
lease. Stop again for C00 reconciliation before product changes.

P08 replacement claim `c58b4a65dfbdab52f7be7dddf41875194c4b632c`
is reconciled and may proceed only with the already bounded exact-form
correction, negative tests, superseding interface/steward digests, released
lease, and zero effects.

For P10, publish only atomic claim
`cd15a4ba-db91-44ff-b522-f111fbcd9a0d` from exact rejected final
`551d483e9678336655546eef6002a7a7daf9d4da`, binding acquisition
`765ad933964ce0019895c2133ff10a491b7938a2`, lease
`f7660370-d954-4ee3-8513-4069bef54025`, and ready digest
`e7b8877ba11a9299d1421888420f4c7eac111275496ede7cc4a1e98469597f5b`.
Stop for C00 reconciliation before correcting relationship-authorized
acceptance, exact monotonic enrollment restore, or exhaustive locked
ownership-transfer revocation.

Independently audit P33 final
`38e8305e29f75714d8b3cc9c8198d1f0a47f5b4b` before admission.

P10 claim `6ec92d288e4ed511449e5061d21a2dfb49c1abae` is reconciled.
Implement only the bounded consent, enrollment-restore, and ownership-transfer
correction already recorded, then republish exact verification/digests with a
released lease and zero effects.

For P33, publish only atomic claim
`c37c6dea-d395-4a57-8068-f519dad03c89` from exact rejected final
`38e8305e29f75714d8b3cc9c8198d1f0a47f5b4b`, binding acquisition
`81f10c6535db733cc0505b43f37fe5a3e7887934`, OPERATIONS_RUNTIME lease
`646edca2-163d-467a-8cff-79d5efb29966`, and ready digest
`e8689215109abe08d4a54c5856ca89b5b457b7651e9e067ebc52267df38cc3a7`.
Stop for C00 reconciliation before product edits. After reconciliation,
correct immutable runtime identity build/migration fields; actual-time
heartbeat freshness; queue lease/fencing/retry/content-progress evidence;
runtime-tier/environment-bound alerts; and complete secret, PII, and all-seven
provider-link leakage scanning with exact negative tests.

P33 claim `0ecfd73c6f5e1a352d995269efbf1cf1a731ddf4` is reconciled.
Implement only the bounded correction already recorded, then republish exact
interface/steward digests, negative tests, released lease, and zero effects.

For I36, publish only atomic integration claim
`2b9e5c96-4e10-45a9-9f59-aa2d7110cdd3` from exact target
`87e3ba67c6433d249a29be9eac99f780ffc99683`, binding acquisition
`9184bcfdb7e983a4f03733624d2d5f98455c7ea3`, RELEASE_INTEGRATOR lease
`1975bc3e-446f-473a-9872-92dd927fdc48`, ready digest
`db8a42f5a7261e815384ac014c694b73400e7e309b6f0865519def5a5d483b78`,
and P08 merge item `6fc2b7ae-b59a-4344-9399-669a5d79212b` digest
`20642826a27d6e76d282420ad154ef53c398a33f6fb040a938dc2cc3e8298494`.
Stop for C00 reconciliation before merging P08.

I36 claim `931b6fe7b160a1b77e316b2212ad46f02d5698fc` is reconciled.
Merge only queued P08 source `e15a7af6cde557ff7f0fbbd55c12244780ca2321`
into that exact target under merge id
`6fc2b7ae-b59a-4344-9399-669a5d79212b` and rebound digest
`683cb0421dd30d87b36f2c36aa857088bd6b9c661714459cde7fff7cd29c64cf`.
Require the source to become an ancestor, require the exact fifteen allowed
paths, rerun the focused P08 checks and typecheck, then publish an I36
metadata-only release checkpoint with zero effects and stop for C00.

P10 final `5fccc34507ae9c5dbc609e234ab559576ab3a445` is admitted with
implementation `da5576d3f675b90a5db812d293801f9f5fa17d38`, digest
`07d90e33e041eed1e3cdfd02e2fbf8b31c13e5f8fa188e7edffcd57fbc581873`,
and steward digest
`0bb00ea1993634956d0bedba776b4eb2b20d32aec9f18b88edeb7e2823143aea`.
It waits behind P08; do not integrate it in the current I36 checkpoint.

P33 final `160299371e203f84a5af3f87bfd5c8e8115a5063` is rejected:
`street_address`, unmatched `retry_count: 9`, and a ten-minute active lease
still pass exact direct probes. Publish only atomic claim
`a3a5253b-019d-4600-aa04-1da9ff1eccea` from that exact final, binding
acquisition `7b1aae190d4bf6eb9b36fc2521345ac976c49ff8`,
OPERATIONS_RUNTIME lease `12ddddaa-2196-47ca-b63a-a20d9b3ad124`, and ready
digest `06ddf0377b93d940b8f0e1a2e44cb4cb29a43232387f1d86ba99b2497344122c`.
Stop for C00 reconciliation before product edits. After reconciliation, close
only those three evidence gaps with exact negative tests and republish all
affected digests.

P08 is integrated at final I36 release
`1b338e66d10a31db790377be38eed3d1e325fb55`. Exact merge
`c389287c20e4813106cc9af67f01fd2a91a48f3b` has parents
`931b6fe7b160a1b77e316b2212ad46f02d5698fc` and
`e15a7af6cde557ff7f0fbbd55c12244780ca2321`; all ancestry, exact-scope,
17-test, typecheck, release, and zero-effect checks pass.

For I36, publish only atomic integration claim
`ba9b0d15-c3c4-4f68-89b9-f96eb9626e8d` from exact target
`1b338e66d10a31db790377be38eed3d1e325fb55`, binding acquisition
`acc5e60168f359e5957f2d6326a036d20a1009b3`, RELEASE_INTEGRATOR lease
`8f1bf970-a69c-463d-98d2-a97f3591fd10`, ready digest
`6a90c2c77969f931fd1b7de5c5a02ba6ddbb9cb5fc1e779e77828dfe15a30214`,
and P10 full merge `bbe563fe-d993-494b-b735-daa68bc48473` digest
`43af759e22481f5734579ac411996e30ce0a36c7f9b8476b771ccefe50c3f94e`.
Change only the three I36 runtime files, publish the claim, and stop for C00
reconciliation before merging P10.

P33 claim `02cc575a60c0b28e17a2202e6b0e64c144c3c499` is reconciled.
Implement only the exact `street_address` leakage coverage, unmatched
`retry_count: 9` evidence rejection, and ten-minute active-lease rejection.
Add direct negative regression tests, refresh affected interface, steward,
state, and handoff digests, release the OPERATIONS_RUNTIME lease, publish the
superseding final, and keep all external-effect counters at zero.

I36 claim `6cb169c4addd745183c10be605a6b9a0f58a2964` is reconciled.
Merge only queued P10 source
`5fccc34507ae9c5dbc609e234ab559576ab3a445` into that exact target under
merge id `bbe563fe-d993-494b-b735-daa68bc48473` and rebound digest
`49cd3b967be548ecab2a9f42effdf3018cd84aec5e945d0f4bbb1ad31ab29943`.
Require the source to become an ancestor, require the exact fourteen allowed
paths, rerun the three focused P10 files with all 20 tests plus typecheck,
then publish an I36 metadata-only release checkpoint, release lease
`8f1bf970-a69c-463d-98d2-a97f3591fd10`, keep effects at zero, and stop for
C00 reconciliation.

P10 is integrated at final I36 release
`f1cecb5343cd1461ecd5c866ce7a9ad4a78c7635`. Exact merge
`522fe505eca226ee7053e38bb67be5af78af79d6` has parents
`6cb169c4addd745183c10be605a6b9a0f58a2964` and
`5fccc34507ae9c5dbc609e234ab559576ab3a445`; ancestry, exact scope, 20
tests, typecheck, release, and zero-effect checks pass.

For I36, publish only atomic integration claim
`d824f937-9896-4110-8b0b-567929ede386` from exact target
`f1cecb5343cd1461ecd5c866ce7a9ad4a78c7635`, binding acquisition
`3c4130ae4d015471ce21e7d70a39d98dde113318`, RELEASE_INTEGRATOR lease
`7ceb45bf-dcaf-441b-bed4-08c6ba798055`, ready digest
`f61a8a4de3d00cced245d480068a55a84f88e537b51952bd8777997df9e88962`,
and P33 interface merge `0798f93b-9b95-4fbb-aebc-cd98a6414f66` digest
`482983af4c501283f291a154a2e3d07c38db63ca6a43a313e55bae03190f8f55`.
Change only the three I36 runtime files, publish the claim, and stop for C00
reconciliation before merging P33 or applying any steward request.

For P12, create branch `codex/v21-p12-parent-household` from exact
`f1cecb5343cd1461ecd5c866ce7a9ad4a78c7635` and publish only atomic claim
`776c6b8b-8729-49ea-a9ca-f505fbaf320c`, binding PARENT_HOUSEHOLD_UI lease
`992f62c1-faba-4709-bae6-6c201cc776b2` and ready digest
`9c85fefc71f18383c5bf674a35bce3c6026ebf6f844ed472376f77a866951c86`.
Change only the three P12 runtime files and stop before product work.

For P22, create branch `codex/v21-p22-learning-engagement` from exact
`f1cecb5343cd1461ecd5c866ce7a9ad4a78c7635` and publish only atomic claim
`eba236e0-164c-4b7d-a71e-20646f4ec5ab`, binding LEARNING_ENGAGEMENT lease
`93a7fddb-d025-475d-8d09-f9c9e7661515` and ready digest
`983929b18a1da521e9342e3398bdf5254ab821c1c38f688defbe3d75d7cb0471`.
Change only the three P22 runtime files and stop before product work.

I36 claim `76ab4719aba2016c1fb93a9301b0db56f062b3d8` is reconciled.
Merge only queued P33 source
`295c125ec6ed3ea41382e5ea44db6f6be1b98933` into that exact target under
merge id `0798f93b-9b95-4fbb-aebc-cd98a6414f66` and rebound digest
`b4a71eb8ac8f8f2460abf2ec4405abb251f1efce3f002bf29422d6c00af804c5`.
Require the source to become an ancestor and the exact twenty-five allowed
paths, rerun the exact four-file P33 suite with 68 tests plus typecheck, then
publish an I36 metadata-only release checkpoint, release lease `7ceb45bf`,
keep effects at zero, and stop for C00 reconciliation.

P12 claim `bd0c8122dcaccc077b9c4ef51983f9ed1321d467` is reconciled.
Implement only the locked P12 Parent household and Student-seat scope, publish
the required exact interface checkpoint before downstream P13, keep every
change inside P12-owned paths plus structured steward requests, run focused
tests and typecheck, release lease `992f62c1`, publish ready_for_review, and
keep effects at zero.

P22 claim `4acf752ddf6e173b3a41714e00bce28dab491dd0` is reconciled.
Implement only the locked P22 learning-engagement scope, keep every change
inside P22-owned paths plus structured steward requests, run focused tests and
typecheck, release lease `93a7fddb`, publish ready_for_review, and keep
effects at zero.

P33 is integrated at final I36 release
`d075dc1839660205845e7da039a182bbe44778d2`. Exact merge
`770696f88860d62f2cd7f9d30717b451ebdd77f7` has parents
`76ab4719aba2016c1fb93a9301b0db56f062b3d8` and
`295c125ec6ed3ea41382e5ea44db6f6be1b98933`; ancestry, exact twenty-five
paths, 68 focused tests, typecheck, lease release, and zero effects pass.

For P34, create branch `codex/v21-p34-operations-recovery` from exact
integrated head `d075dc1839660205845e7da039a182bbe44778d2` and publish only
atomic claim `d1959518-2cbc-49a8-9d39-ddd38a06564e`, binding acquisition
`b35a24ab56ca6a6b5dcc805a7498f80c99ad4da9`, OPERATIONS_RECOVERY lease
`b8e703f5-43a2-4a7d-9f25-9af6f32be4f0`, and ready digest
`5660172d6c2561383232dce4daab58a4cf82f79e519fd245a010d48e68a10e6f`.
Change only P34's three runtime memory files and stop for C00 reconciliation
before any product implementation. No external effect is authorized.

P34 claim `8499fdb5425f699f14ef8294b0945cd6dd2c1638` is reconciled.
Implement only provider-independent P34 mechanisms under its unchanged
OPERATIONS_RECOVERY lease. Do not fabricate or perform legal approval,
backup/restore proof, provider, deploy, canary, or other external effects.

For P12, publish only atomic correction claim
`eedf369a-f247-481b-bca6-7e48abdf1f26` from exact held final
`7c06fe62e8555aeafa917e855e34f9cc07e3ce3b`, binding acquisition
`36451ec88e05bb64be0b27b8bc148166b6fe9837`, PARENT_HOUSEHOLD_UI lease
`3f2cd863-1f04-40fa-875b-87c14469a454`, and ready digest
`a9df3b69b8177c1e0e589109de5aff4260bdb99471f12ff7de0a915166824e8b`.
Change only P12's three runtime files and stop for reconciliation before
correcting the hard three-seat cap and lifecycle same-state duplicate write.

For P22, publish only atomic correction claim
`e2ac53ae-128f-4d0c-b9a2-e74d05858f29` from exact held final
`cad7259304253eff531307fecfc9de298fac1a34`, binding acquisition
`36451ec88e05bb64be0b27b8bc148166b6fe9837`, LEARNING_ENGAGEMENT lease
`9fd6a3b7-decc-454a-9a2e-953aaaebfe63`, and ready digest
`40bb6fd8a17894f529f881d087427047427db54f573bc1cd5cfe36dc6000a2a0`.
Change only P22's three runtime files and stop for reconciliation before
correcting class-assignment authorization, sanitized published-class
projection, and approved/published-only leaderboard counting. No effect is
authorized.

P12 claim `e1cfcd590e8e359c6616cac523337c183f2bc43f` is reconciled.
Correct only the hard three-active-Student cap and archive/restore same-state
resubmit behavior. Add direct negative tests proving arbitrary stored allowance
cannot exceed three and same-state resubmits cause no duplicate write,
household revision, audit, or commit. Refresh exact implementation/interface
artifacts and digests as required, publish a final ready_for_review checkpoint,
release lease `3f2cd863-1f04-40fa-875b-87c14469a454`, and keep effects at zero.

P22 claim `0430569088aeb4f244e5540dddf778b72525bc64` is reconciled.
Correct only assigned-class authorization on Admin question and attendance
mutations, a sanitized class-member projection for published questions that
omits Student, household, and private moderation metadata, and leaderboard
counting limited to approved_for_class/published states. Preserve Curious
recognition on first answer/approval. Add direct negative tests, refresh exact
artifacts and digests, publish ready_for_review, release lease
`9fd6a3b7-decc-454a-9a2e-953aaaebfe63`, and keep effects at zero.

P22 corrected final `4d1b6dfc31d2b46f6cd530792816953d2a767fc2`
and P34 mechanism-only final `17f41c6b78bf6bedf1beb0803f855b2d4f01294a`
are independently admitted ready_for_review. P34's real R44 and external legal
gates remain explicitly unpassed. Do not resume either task without fresh C00
authority, and perform no external effect.

For P12, publish only atomic metadata-correction claim
`86e406be-cec6-493e-a2a8-4d0744168ed9` from exact held final
`2faa49871ae34fa39e6387f264580e246244075b`, binding acquisition
`76c1c2d9363bb20c9abd2e005ca0651fca73ceb8`, PARENT_HOUSEHOLD_UI lease
`79c5cf83-4438-4c68-ba4f-8e18b87de1f4`, and ready digest
`8bb0d6d8bcc996fe9a50ebafec45046d3a65bad9cf85f193d90c083fc6b1eb30`.
Change only P12's three runtime files and stop for reconciliation. After C00
resumes it, replace the incorrect literal-backslash-n semantic digest
`7ac6f5114de7f0344b2d8fa97891024c6e1304870057815914d0796c26acd373`
with the correct LF-separated digest
`ec615147fd6b7becf278c97aef35ee28c4bdfd8109d7ee7897701e3e25216e26`
everywhere in P12 metadata; product and export blobs must remain unchanged.

P12 claim `b8d43694b93b5f932c35d065e633c887761f67a1` is reconciled.
Replace the invalid literal-backslash-n semantic digest
`7ac6f5114de7f0344b2d8fa97891024c6e1304870057815914d0796c26acd373`
with documented UTF-8/LF/no-final-newline digest
`ec615147fd6b7becf278c97aef35ee28c4bdfd8109d7ee7897701e3e25216e26`
only in P12 `INTERFACE-CHECKPOINT.yaml` and runtime references. Reproduce the
unchanged export hashes and semantic preimage, verify exact scope and clean
remote state, publish `ready_for_review`, release lease
`79c5cf83-4438-4c68-ba4f-8e18b87de1f4`, and keep effects at `0/0/0`. Do not
change product, contract, test, steward, migration, shared, or effect files.

P12 final `4bc6f15c8beffb28dc845d976a62b9c4915a11dc` is admitted with corrected
interface checkpoint `e5f59e707f9b3a12c9b64b30aaa23e638c2d816f`, semantic digest
`ec615147fd6b7becf278c97aef35ee28c4bdfd8109d7ee7897701e3e25216e26`,
and state/handoff digest
`9bbd2384e49b61ad5e1e345693de7ff08ddc29ceca87afa866e6db899bc4b0bb`.

For I36, publish only atomic claim
`2fd3ab04-0ab1-4fa5-a4bb-1dc9dfa7bcfa` from exact integration head
`d075dc1839660205845e7da039a182bbe44778d2`, binding acquisition
`9d34bfde201251ac87766ae5d182421517bb1e73`, RELEASE_INTEGRATOR lease
`08ea5a46-06b1-466e-a6f2-b1947f4ed402`, and ready digest
`f7c20f2301d048a0674eb7af6eac965ce759a195e3d1309b40b1fa9242d754ec`.
Change only I36 `TASK-STATE.yaml`, `HANDOFF.md`, and `NEXT-PROMPT.md`, push,
remote-verify, and stop. Do not merge P12, P22, or P34 until C00 reconciles the
exact claim and rebinds all three optimistic target heads. No steward, provider,
deployment, registration, migration, legal-approval, or external effect action
is authorized.

I36 claim `c4ee7d967ad5ff85f538307ad196c63d35fb5ad2` is reconciled.
Merge only in this exact order from that claim head:

1. P12 full source `4bc6f15c8beffb28dc845d976a62b9c4915a11dc`,
   rebound digest `c0120296472ce4fc9c8bea2acb2439aeea617934052ebb4f1180cf28f7b8e71d`;
2. P22 full source `4d1b6dfc31d2b46f6cd530792816953d2a767fc2`,
   rebound digest `ed0b0a3850c23ea2fe4adef71280b7f5963218d3c749517091c2a17569de313c`;
3. P34 full mechanism source `17f41c6b78bf6bedf1beb0803f855b2d4f01294a`,
   rebound digest `e7fd5a401435b52edce651b56e973ffb5abb6fc2c335d96ec187d9d355d37f3a`.

Verify every source base, exact 16/14/15 path allowlist, source ancestry,
task/state/artifact digests, focused suites, workspace typecheck, formatting,
secret scan, and cumulative diff hygiene. Publish exact merge heads plus a
metadata-only release checkpoint, release lease
`08ea5a46-06b1-466e-a6f2-b1947f4ed402`, and keep effects at zero. Do not
apply steward requests or treat P34 real R44/legal gates as passed.

P25 and P26 may publish atomic claims only from exact settled start
`d075dc1839660205845e7da039a182bbe44778d2`.

P25 uses branch `codex/v21-p25-billing-commercial`, claim
`a4dcccb9-2058-44df-a72d-4b3e6f51bdd9`, BILLING_COMMERCIAL lease
`bf5b157c-d452-44a8-991f-bea035e1fd82`, and ready digest
`30aec96a3b09178b89f322ba285b6216c2851039f9eab971edad7e248ce4fb87`.

P26 uses branch `codex/v21-p26-billing-access`, claim
`1c659f83-31c3-4404-9488-c26ad4826922`, BILLING_ACCESS lease
`1bcd6b13-bf89-4000-a653-35a8afdcb9c3`, and ready digest
`ec58cc73ed98e8137cc652ad838f2300f0e498db536d21c39ad7837d82ca2ddb`.

Each first push must contain exactly task-local `TASK-STATE.yaml`, `HANDOFF.md`,
and `NEXT-PROMPT.md`, then stop for C00 reconciliation before any product or
provider work. No effect lock, migration, central registry, composer, route,
worker registration, steward application, Stripe mutation, or external action
is authorized.

The P12/P22/P34 ordered wave is complete at final integration release
`44fd536381e7af8885f31247d6bf91dd6266b195`; the merge queue is empty.
Do not re-merge those sources. P34 real R44, provider, backup/restore,
canary, legal-artifact, and approval gates remain explicitly unpassed.

P25 claim `3b322e3bf9f6206ea24e1cbea3451445f7e9ae1d` and P26 claim
`abb053f65ef7bb238e163bb36f576980d8fa0d61` are reconciled. Resume each
only for its locked owned-path billing implementation under its existing
writer lease. Preserve exact dependency bindings, add focused negative tests,
publish complete runtime/artifact digests, release the lease, and stop at
ready_for_review with external effects `0/0/0`. Do not apply migrations,
registrations, steward requests, shared composer changes, Stripe mutations,
provider actions, or any other external effect.

For P13, create branch `codex/v21-p13-parent-summary` from exact released
integration head `44fd536381e7af8885f31247d6bf91dd6266b195` and publish only
atomic claim `183a8dcb-d283-4e3e-b49b-790ca35e5f70`, binding acquisition
`f98ee8e79018e5875e9c2be3d5961954b3c5ce04`, PARENT_SUMMARY_UI lease
`cef8335b-8c6f-4111-9bc7-1f877c9cae15`, and ready digest
`3bcc2c707a0d6fdd26bc8f3a3bc42c0b7cacb6bd91c2e3f7b8de0106542ff709`.
Change only P13 `TASK-STATE.yaml`, `HANDOFF.md`, and `NEXT-PROMPT.md`, push,
remote-verify, and stop for C00 reconciliation before product work. No effect
lock or external action is authorized.

P13 claim `645c41feff7ffa02b09647697764bf726a3380e9` is reconciled.
Resume only the locked P13 Parent summary progress/schedule/updates
implementation from that exact head under unchanged lease
`cef8335b-8c6f-4111-9bc7-1f877c9cae15`. Keep changes inside P13-owned paths
plus task-local runtime and structured steward requests; parent/support,
migrations, central composers/registries, steward application, providers, and
effects are excluded. Run focused positive and negative tests plus typecheck,
refresh exact artifact/state/handoff/steward digests, release the lease,
publish ready_for_review, remote-verify, and stop with effects `0/0/0`.

P13 `a9d641e6da6a08c805f34d3f827816fcd8c6138a`, P25
`0979e151f80900cea75edecabe8967ce382d168d`, and P26
`5e33807200a24ec53be889234dbaafdda9717dcb` are admitted and queued for
ordered full-source integration. Do not apply P13's three assigned steward
requests in this wave.

For I36, publish only atomic integration claim
`d17f9dc5-0f97-44ea-bb44-600c6c3635a3` from exact target
`44fd536381e7af8885f31247d6bf91dd6266b195`, binding acquisition
`d7df4df6954fcb3cdd06704461f86894285b09f6`, RELEASE_INTEGRATOR lease
`6077f8e5-c498-405e-9cd8-754340775f53`, and ready digest
`080fac5c73a526228fc7a8b0c957389362942b7e094decedf1454066bff56862`.
Change only I36 `TASK-STATE.yaml`, `HANDOFF.md`, and `NEXT-PROMPT.md`, push,
remote-verify, and stop for C00 reconciliation before merging.

The queued order and initial canonical merge digests are P13
`bd4f6b09-a471-4673-b783-3235ad31adda` / `3c35d48d`, P25
`106dafb7-915d-4b6e-97b7-d7d97bf945cb` / `677c7638`, then P26
`34c0cb63-ec36-46c0-ac0e-ae8b3a85fe26` / `1692243e`. No source merge,
steward application, migration, central registration, provider action, or
external effect is authorized until the atomic claim is reconciled and all
three optimistic target heads are rebound.

I36 claim `4e17ad727b6f31f10985113fc24f187369a9e544` is reconciled.
Execute only this ordered wave from that exact claim head:

1. P13 full source `a9d641e6da6a08c805f34d3f827816fcd8c6138a`,
   merge `bd4f6b09-a471-4673-b783-3235ad31adda`, rebound digest
   `fee466d093216e2121a08ef8395f7bc70b1c3887d451da952cc831285a5c5238`;
2. P25 full source `0979e151f80900cea75edecabe8967ce382d168d`,
   merge `106dafb7-915d-4b6e-97b7-d7d97bf945cb`, rebound digest
   `0f10a07accdbfa2a80b2dc5fe47037c23895ae9f881f2c9c63228a4240d46ec2`;
3. P26 full source `5e33807200a24ec53be889234dbaafdda9717dcb`,
   merge `34c0cb63-ec36-46c0-ac0e-ae8b3a85fe26`, rebound digest
   `ae0c21d8ddf513f8e7f61e077c1306781cdf7bad628a1f11a2632d4b020d69f7`.

Preserve source ancestry and exact 19/15/20-path scopes. Re-run the 11, 13,
and 11 focused tests plus workspace typecheck, verify cumulative diff hygiene,
publish exact merge heads and one metadata-only release, release
`6077f8e5-c498-405e-9cd8-754340775f53`, and stop with effects `0/0/0`.
Do not apply P13's client-route, contract-barrel, or server-registration
requests; do not apply any migration or shared registration; and do not
perform provider work or any external effect.

The P13/P25/P26 wave is complete at exact settled integration release
`cecc1c0dc6ff57562e5d89dd731289d860086bf7`; do not re-merge it. P13
steward requests remain assigned but unapplied.

P11 and P23 may now publish atomic new-branch claims only:

- P11: create `codex/v21-p11-admin-operations` from exact `cecc1c0d`, bind
  claim `2a221efd-b827-4961-a293-0abb77998260`, ADMIN_OPERATIONS_UI lease
  `f5a27f61-8ec3-47ad-97c3-fea751a67d18`, and ready digest
  `ac1a4f87bb7ddb4b17e674b7bd05506931012e25aa76fd44b6c1719a820ddece`.
- P23: create `codex/v21-p23-student-notifications` from exact `cecc1c0d`,
  bind claim `88e6e954-c36e-41eb-9bc8-bb8a1f6bfeee`,
  STUDENT_NOTIFICATIONS lease `c6b519b7-a443-47b0-9cad-3de2458a3450`,
  and ready digest
  `8fd1383b67e06757ddec35fa3a512c3e080464c168fa4ace659ca8c977e0197c`.

Each must change only its own `TASK-STATE.yaml`, `HANDOFF.md`, and
`NEXT-PROMPT.md`, push, remote-verify, and stop for C00 reconciliation before
product work. No effect lock is granted. Do not edit migrations, central
composers or registrations, apply steward requests, call providers, send
notifications, or cause any external effect. P09, P21, and P24 remain planned.

Withdraw the prior P11/P23 READY digests `ac1a4f87` and `8fd1383b`; their F05
task-packet binding was malformed. The correct F05 digest ends `ec3`, not
`ec3e`.

For P11, resume exact existing head
`396bf74d855f294c744cf3eaa7d30c3f0e26e60a` only for a metadata correction
under claim `31da6bdb-f7ce-46f1-96a4-a6a78853d9eb`, lease
`0e828d7b-9ee3-4cd0-919d-da27022ba243`, acquisition `2dc1ffa0`, and ready
digest `1f887010e21ae02c218a043d8d1892307bbff7da16bf9b1b2f6f7ae1d049efb3`.
Change exactly the three P11 runtime files, replace the malformed F05 digest
with `807393d09cb614e05625677818976930cf4a14e07e65bb488f647cdcd3b63ec3`,
bind the fresh claim/lease/authorization, push, verify, and stop. No product
work is authorized.

For P23, create `codex/v21-p23-student-notifications` from exact `cecc1c0d`
under fresh claim `68340416-7e06-4986-a125-59d81b500a0b`, lease
`45041adc-a69f-4065-a179-b94473967c94`, acquisition `2dc1ffa0`, and ready
digest `b0598496f6d52eb63e801cb0ac7741344256ff2dd1481916ab00c41e2b9b694f`.
Use the corrected F05 digest, change exactly the three P23 runtime files,
push, verify, and stop. Effects remain `0/0/0`.

P11 corrected claim `c0fe1ec4fc16cc626e5b827f12e977851ede2bf1`
and P23 atomic claim `05ef606022d260d11d56d31985a051d7b9013010`
are reconciled. Resume each under its unchanged fresh claim and lease.

For P11, implement only:

- `apps/web/src/client/app/admin/dashboard/**`
- `apps/web/src/client/app/admin/search/**`
- `apps/web/src/server/features/admin/operations/**`
- `packages/contracts/src/admin/operations/**`
- `packages/domain/src/admin-search/**`
- P11 runtime files and structured steward requests.

Use real data and authorized search only; no fictional/demo fallback.

For P23, implement only:

- `apps/web/src/client/app/student/notifications/**`
- `apps/web/src/server/features/notifications/student/**`
- `packages/contracts/src/notifications/student/**`
- `packages/db/src/notifications/student/**` excluding migrations/central index
- `packages/domain/src/notifications/student/**`
- P23 runtime files and structured steward requests.

Implement exact lifecycle, unread/read behavior, safe action routing, optional
foreground audible cue, and focused accessibility/dedupe tests. Do not send a
notification or invoke a provider. Both tasks must run focused positive and
negative tests plus typecheck, reproduce committed artifact/state/handoff/
request digests, release their leases, push `ready_for_review`, remote-verify,
and stop with effects `0/0/0`. Migrations, central composers/registrations,
root barrels, package files, steward application, providers, and effects are
excluded.

Preserve source authority `ot-v21-production-source-grant-20260729` and its
grant digest
`94a39fe03e74bfc133206cbc3b0fecb632114a7ea877ea753b429530d4ce3ad1`.
It expires at release completion or `2026-08-05T07:13:45Z`, whichever occurs
first. It is candidate-pending and cannot itself reserve or perform an effect.
When an effect-bearing verification, operator, or release task is dependency-
ready and the candidate is frozen, derive a separate exact task-, candidate-,
provider-, identity-, fixture-, operation-, budget-, cleanup-, and stop-bound
authority record from this source. Confirm identities by canonical registry
and live readback; the exact GHL location is `pBSnOK2nkdxp6gf9Rg3o`. Acquire
the exclusive provider lock and fresh fencing token immediately before each
live effect, push the immutable reservation, recheck current control authority
and lock state, then require provider readback, reconciliation, and rollback
evidence. Never use guessed identities or expose an existing credential. The
grant does not lift any matrix budget or prohibition.

P23 final `39b050949a0874a1ea397c6c3f3420eb4fa19ccc` failed semantic
admission and must not be integrated. Resume that exact head only for an atomic
correction claim under claim `29e8b1d9-8769-479d-8a7a-df26137f185a`,
STUDENT_NOTIFICATIONS lease `489df25a-c3ed-4b34-8bb8-ddb6e8d88b99`,
ready parent `78626d9be8f42e3cd4ca1f0c2f8ea3e656122bb1`, and ready digest
`2f57bb42123e7879658d8a063ea6c14b256bbef8c2b26b72e1714e3c9cf7ed97`.
The first push changes exactly the three P23 runtime-memory files, binds this
fresh authorization/claim/lease and rejected source head, pushes normally,
remote-verifies, and stops for C00 reconciliation. Do not edit product code in
that push.

After C00 reconciliation only, correct every confirmed blocker within P23's
existing owned roots: canonical `/app/student/...` routes; cross-event
cancellation supersession; transactionally serialized different-version
delivery including cancellation-first and empty-row races; a 30-day retention
deadline for every superseded/expired notice; runtime allowlisting of every
student-safe status; immutable Rabbi Eli reminder copy; an actual opt-in
foreground sound consumer paired with the visual notice; Student/household
timezone timestamps with an unambiguous zone; write-idempotent mark-one; and
keyboard/focus/description/accessibility tests. Preserve current-authorization
checks, provider/private-copy rejection, default-off sound, exact dedupe, all
eight categories, and zero effects. Update any migration request needed for
the concurrency invariant but do not apply it. Re-run direct race/order/privacy
probes, focused tests, typecheck, lint/format, scope/digest verification, release
the lease, and publish a superseding final for independent re-audit.

P23 atomic correction claim
`b341ce5209909771647c2ca02167e077468fd597` is reconciled. Resume it
under unchanged claim `29e8b1d9-8769-479d-8a7a-df26137f185a` and lease
`489df25a-c3ed-4b34-8bb8-ddb6e8d88b99`. Implement the complete bounded P23
correction already enumerated above, add direct order/race/privacy/retention/
sound/timezone/idempotency/a11y proof, update but do not apply any needed
structured migration/registration request, publish a superseding final, release
the lease, and stop with effects `0/0/0`.

P11 partial correction checkpoint
`e807e26e5882c3b8ad8e06221db9f28b743369b7` is preserved and not yet
admitted. Resume it only for an atomic renewal claim under claim
`d6567fe9-bfd3-45c6-88c5-ff6cbdff225a`, ADMIN_OPERATIONS_UI lease
`fd135a96-bfc0-4ee7-b59a-94873b5e3100`, ready parent
`daa4555baa113fb0a2224bd8505e5e599ad0e476`, and ready digest
`727c1f24163de62242f481b3df804b7b68cc157a0be9c34894c4cb1db2799efd`.
Change exactly the three P11 runtime-memory files, bind the fresh identities and
checkpoint, push normally, remote-verify, and stop for C00 reconciliation.
Preserve the six partial correction files unchanged and do not run or claim
tests in this first renewal phase. No provider, registration, steward, or
external effect is authorized.

P11 renewal claim `b8c7643938e75bb2ea28b3ebd909f56b577d8b37` is
reconciled. Resume the preserved bounded correction under unchanged claim
`d6567fe9-bfd3-45c6-88c5-ff6cbdff225a` and lease
`fd135a96-bfc0-4ee7-b59a-94873b5e3100`. Complete the remaining code/tests,
strengthen but do not apply the registration request, validate all exact probes
and digests, publish a superseding final, release the lease, and stop with zero
effects.

P23 final `87da1f244ea8e19838c2695678089d1bcbe9687a` must not be
integrated. First resume it only for a three-runtime-file claim under claim
`f7e3fb0e-a8d4-416b-8c79-786a696e2dc4`, STUDENT_NOTIFICATIONS lease
`f7b63d5e-489c-40aa-a793-9a7210f91bca`, ready parent
`6b3bb0619f3af04cb5a20a4f8650cc8ec6b042d4`, and ready digest
`976b5c80e4bc3f437301603982168f3b4c7d3247fc8a26831006933d70432204`.
Change exactly the three P23 runtime files, bind the fresh identities/rejected
head, push, verify, and stop for C00 reconciliation. Only after reconciliation
may P23 replace schedule routes with canonical calendar, use a strict canonical
Student-route allowlist, add full Arrow/Home/End tab keyboard behavior with
focus movement, correct dependency ancestry evidence to the true interface/
integration heads, add direct tests, refresh digests, publish a superseding
final, release the lease, and stop. Apply no request/migration/registration and
perform no provider/send/external effect.

F02 Lease B atomic claim is authorized from exact branch head
`e156003b243221f97f938a0aca16164c1dd86d2d` under canonical READY digest
`fe2adafd933c848fa9e4b2efb4809f9edc733e42c8f43b71f30ec5b5b9a8df6b`,
claim `e2a7b9ff-ce58-495e-b164-84d9299250d0`, and shared
MIGRATION_AUTHORITY/SCHEMA_CONTRACT lease
`cad3d0dd-59a2-44dd-87fb-6597978daaaf`. The six exact planned allocations
are 2239 P16 classroom core, 2240 P32 privacy data rights, 2241 P10 admin
directory, 2242 P23 Student notifications, 2243 P24 support, and 2244 P27 GHL
identity.

The first push must change exactly F02 `TASK-STATE.yaml`, `HANDOFF.md`, and
`NEXT-PROMPT.md`, bind the containing control/acquisition, READY, claim, lease,
integration release, producer heads, request Git blobs/digests, ordinals,
filenames, collision proof, and zero effects, then stop for C00
reconciliation. Do not read requester content, edit
`MIGRATION-ALLOCATIONS-PROPOSAL.yaml`, write migration SQL, apply a
registration, inspect a provider, deploy, send, or perform an external effect
in that atomic push.

F02 Lease A is independently audited and reconciled at exact integration
release `1798f31b5f698c80ee2babbd6414e9934745a178`, with exact merge
`8d1405b4f6f5014364620bac0a2b5729c60aa2ac`, F02 source
`e156003b243221f97f938a0aca16164c1dd86d2d`, protected migrations 2235
through 2238, fresh 69/69 migration proof, cleared merge queue, four applied
migration steward results, and effects `0/0/0`. The next ordinal is 2239.

Prepare a read-only exact inventory for F02 Lease B:

- 2239 P16 `2239_v21_classroom_core.sql`
- 2240 P32 `2240_v21_privacy_data_rights.sql`
- 2241 P10 `2241_v21_admin_directory.sql`
- 2242 P23 `2242_v21_student_notifications.sql`
- 2243 P24 `2243_v21_support.sql`
- 2244 P27 `2244_v21_ghl_identity.sql`

Verify each immutable request ID, raw request digest, exact producer head and
Git blob, requesting-task metadata, filename/purpose binding, dependency and
integration ancestry, absence of ordinal/filename collisions, next ordinal
2239, and never-allocate 2231. Only after those checks pass, acquire a fresh
serialized C00 lease and publish an atomic-claim-only F02 READY entry with a
fresh task claim and exact MIGRATION_AUTHORITY/SCHEMA_FOUNDATION writer
leases. The first F02 push must change only its runtime triplet and stop for
C00 reconciliation. No SQL edit, registration, provider inspection,
deployment, send, or external effect is authorized before that reconciliation.

P11 integration is complete at release
`eeac03afdd7a5db493885ef507b7c09478b0454a`; do not repeat it and do
not apply `P11-registration-001` outside its steward checkpoint.

P09 final `33a21a45005271f1bbe09c8587df1e52fac1a95a` has passed
independent audit and is admitted. Resume I36 only from exact integration
head `eeac03afdd7a5db493885ef507b7c09478b0454a` under claim
`26d3ae42-c9c9-4913-9534-1d4c71b55f13`, RELEASE_INTEGRATOR lease
`495eba01-e9b3-4e71-9e53-4864c9d93bac`, acquisition
`7761608fef1c7eb7f6bd77ec87127f0bb4eb45d3`, and READY digest
`3be45d6892c86e6fb44fc74f7c99dfe4daa81604f6385a2f8e94b75b0a004037`.
Change exactly I36 `TASK-STATE.yaml`, `HANDOFF.md`, and `NEXT-PROMPT.md`,
push normally, remote-verify, and stop for C00 reconciliation. Do not merge
P09 or apply its migration/registration requests in this first push. No
provider action, send, or external effect is authorized.

I36 claim `e952671b1b214be51a01ef7f4abcaef6a50ce9da` is reconciled.
Resume it under unchanged claim `26d3ae42-c9c9-4913-9534-1d4c71b55f13`
and RELEASE_INTEGRATOR lease `495eba01-e9b3-4e71-9e53-4864c9d93bac`.
Verify rebound P09 item digest
`16559951b731a12e2a530b35a232c685eb8f6509e380e66dc111ee4d2942f3a5`,
then ancestry-merge only P09 final `33a21a45` with exact queued parents and
14 paths. Run 4 focused files / 16 tests and typecheck, publish the
metadata-only I36 release checkpoint, release the lease, and leave all P09
requests unapplied. Perform no provider/send/external effect.

P21 final `29d3b94b5efb98ed9d8dcefa2f438aa2e9f546af` is rejected and
must not be integrated. Resume it only for an exact three-runtime-file atomic
claim under claim `eba3bd79-7a63-46fe-89eb-edace22f1a1e`,
CONTENT_PUBLICATION lease `d4c8a72c-7beb-40e9-93d4-73d4f3c62668`,
acquisition `d633726e427e659adf55d71d009919ae4f6b4dde`, and READY digest
`f0875254206ba39499fe3d21ad147ec252551aa4e25dcfb0f3f4c162fd237528`.
Change exactly P21 `TASK-STATE.yaml`, `HANDOFF.md`, and `NEXT-PROMPT.md`,
bind the rejected head and fresh identities, push normally, remote-verify, and
stop for C00 reconciliation.

After reconciliation only, add a durable exact ProviderOperation/outbox
completion transition tied to the original operation and canonical request so
readback cannot leave the publish intent pending; require a repository-backed
canonical governed occurrence/product/version/series lookup before attaching
an idempotent constrained relation; and derive or validate publication
audience against transactionally current Student, enrollment, access,
service-account consent, privacy, and revocation eligibility before creating
any active assignment or Student/adult notice. Add direct pending-outbox,
invented-occurrence, and inactive/revoked-audience tests. Preserve all passing
approval, readback, grant, unpublish/archive, denial, search, resume, privacy,
and zero-effect behavior. Strengthen but do not apply the request; use local
ports/mocks only and perform no live provider or external effect.

P09 integration is complete at I36 release
`408b21afa4b9ac6f100b3ce33ea87984d18d4bf7`; do not replay merge
`38307b26f243597df79ef18c928c9a3e935cd5fc` or apply the assigned P09/P11
requests outside their exact steward checkpoints.

P21 claim `cc7e7439ba3567969cb12e3e4b7f0c01af276f93` is reconciled.
Resume that exact head under unchanged claim
`eba3bd79-7a63-46fe-89eb-edace22f1a1e` and CONTENT_PUBLICATION lease
`d4c8a72c-7beb-40e9-93d4-73d4f3c62668`. Implement only:

- durable exact completion/closure of the original ProviderOperation and
  pending outbox bound to the canonical publish request;
- repository-backed lookup of the canonical governed
  occurrence/product/version/series relation before idempotent attachment;
- transactionally current Student, enrollment, access, service-account
  consent, privacy, and revocation eligibility before any active assignment,
  library projection, Student notice, or adult notice; and
- direct pending-outbox, invented-occurrence, and inactive/revoked-audience
  regressions.

Preserve all earlier passing approval, readback, playback-grant, unpublish,
archive, denial, search, resume, privacy, and concurrency behavior. Use local
ports/mocks only, strengthen but do not apply the registration request, run
focused tests/typecheck/lint/format/scope/digest checks, release the lease,
publish a superseding final, and stop for independent re-audit with effects
`0/0/0`. Perform no provider/send/external effect.

Create P24 only from exact integration release
`408b21afa4b9ac6f100b3ce33ea87984d18d4bf7` on branch
`codex/v21-p24-support`, under claim
`ff79d0ab-10d4-481b-ae90-48bb8bd9631a`, SUPPORT lease
`4d0115d1-571f-4ca7-8b04-3fc79b43bcdf`, acquisition
`8bb4680887b2ea320f914cf046184655601fade9`, and READY digest
`57d6b0bb804527dfd218860202b9bec3f66ee24a424fb4815d6308816cab5b75`.
Verify the exact F03/F04/F05/F07 dependency bindings, create and push exactly:

- `ops/v2.1-execution/runtime/P24/TASK-STATE.yaml`
- `ops/v2.1-execution/runtime/P24/HANDOFF.md`
- `ops/v2.1-execution/runtime/P24/NEXT-PROMPT.md`

Then remote-verify and stop for C00 reconciliation. Do not edit product/test/
request files, inspect or mutate Telegram or another provider, send anything,
apply steward work, claim an effect lock, or perform an external effect in the
atomic-claim push.

Before candidate freeze, reconcile and disposition the independently
inventoried 16 ready-for-review producer heads that are not yet full integration
ancestors and the 55 assigned steward duties. Do not treat the current
queue-empty, candidate-free integration release as integration-complete.

P24 claim `2a3b36c98b9a8698536149d668f0c58552c7eea4` is reconciled.
Resume that exact branch head under unchanged claim
`ff79d0ab-10d4-481b-ae90-48bb8bd9631a` and SUPPORT lease
`4d0115d1-571f-4ca7-8b04-3fc79b43bcdf`. Implement only P24's normalized
support-owned roots plus immutable structured steward requests:
role-appropriate adult/Student technical-support lifecycles, separate private
Torah/class questions, exact authorized conversation access, Admin ticket
operations, and redacted bounded Telegram notification intents through local
ports/mocks. Preserve protected privacy and role separation. Run focused
positive/negative tests, workspace typecheck, focused lint/format, exact
scope/digest checks, release the lease, publish a ready-for-review final, and
stop for independent re-audit. Do not inspect/mutate Telegram or any live
provider, send, apply a steward request, claim an effect lock, or perform an
external effect.

P17 claim `7e05a1e38f605a9be3cb29d5d2e768e5d2dc348f` is reconciled.
Continue only under claim `f7c01bf5-d289-48fc-bf32-cec1c1c1d6a1` and
ZOOM_PREPARATION lease `0e53a171-263b-41d9-b957-80588027c194`, using only
the explicit P17 allowlist. Preserve P18's sole launch/bootstrap/live-session/
attendance ownership; replace `provider_operations` with canonical
`job_outbox` plus `provider_operation_binding`; limit the schema contract and
`P17-MIGRATION-002` to five preparation tables; publish only the two exact
`-002` successor requests; run focused/typecheck/lint/format/YAML/secret/scope
gates, release the lease, push, and stop for audit. Effects stay `0/0/0`.

P20 claim `0d58c8e4d6ca0263273d540bfd722586d8a1b5d3` is reconciled.
Continue only under claim `e8c768e8-f603-4d0c-a45b-34b5cd7ea92c` and
CONTENT_PROCESSING lease `24d0fa6f-30ac-4fc0-af2a-2b495d826063`, changing
only the five exact correction source paths plus its runtime triplet. Enforce
composite scope and exact source/seven-artifact/participant/Admin evidence
with fail-closed replay/conflict tests. Do not edit a migration, publish a new
P20 request, or touch P21. Run exact gates, release, push, and stop for audit.

P17 must first atomically renew from exact checkpoint
`7596a0f1701fb135a4f8d133d1381d0e5ad00af8` under READY
`4574e539ff97699ce610efd5f1062f79d359f3ee297db4ee40e1740c89d859eb`,
fresh claim `e85735a2-4a41-476b-bca2-d1dde009e69d`, and ZOOM_PREPARATION lease
`0d08dc64-fb12-4aa5-bf5d-10a3267e18f4`. Change only its runtime triplet,
preserve all partial/product/request bytes, push normally, verify remote
equality, and stop for C00 reconciliation before implementation resumes.

P23 residual claim `433cc88b34d99099ca75f64876713406c6e43053` is
reconciled. Resume it under unchanged claim
`f7e3fb0e-a8d4-416b-8c79-786a696e2dc4` and lease
`f7b63d5e-489c-40aa-a793-9a7210f91bca`. Change only the canonical route
allowlist/calendar actions, full tab keyboard/focus behavior, direct tests, and
truthful dependency ancestry evidence within P23-owned/runtime paths. Preserve
all already-passing notification fixes. Re-run focused tests/typecheck,
lint/format/scope/digests, publish a superseding final, release the lease, and
stop with effects `0/0/0`. Apply no migration/registration/steward request and
perform no provider/send action.

P11 final `81486a86a85a3d6ffee64eb58c66119686af049e` must not be
integrated. First resume it only for a three-runtime-file claim under claim
`6efc5db3-43b4-4dad-ae3f-59031adddbd5`, ADMIN_OPERATIONS_UI lease
`84e7a42a-d2a5-4c88-ba45-57b34ecc6de9`, ready parent
`f8154c67106ab032873fd923efa9979465f11fff`, and ready digest
`6f30eeea172d702e606c181329dc3b6e899a58ec0016ec2d6b84da7b0f5e9822`.
Change exactly the three P11 runtime files, bind the fresh identities and
rejected head, push normally, remote-verify, and stop for C00 reconciliation.
Do not edit product code in that first push.

Only after reconciliation may P11 correct the confirmed residuals inside its
existing owned roots: persist and filter exact provider runtime-tier and
verification-environment provenance instead of relabeling coarse environment
rows; clear the private query text together with every result/cursor/recent
value on sign-out, role revocation, credential-version change, and bfcache
restore; and expose one unique combobox-owned listbox identity or unique
grouped identities with valid ARIA relationships. Add direct provider-sandbox
versus persistent-staging, query-clearing, and duplicate-id/ARIA tests. Preserve
all already-passing P11 corrections, exact privacy and authorization checks,
no-store behavior, canonical destinations, and zero effects. Re-run focused
tests, typecheck, lint/format/scope/digests, release the lease, publish a
superseding final, and stop for independent re-audit. Do not apply the
registration request or perform provider/external actions.

P23 final `24ec3a4effc622f384915d892cbaad046e1ea5d1` remains read-only
pending its independent exact-source semantic verdict. Do not queue or
integrate it before PASS.

P11 residual claim `ce87a6c2808216214870d4b2343c82c0a36aaf36` is
reconciled. Resume it under unchanged claim
`6efc5db3-43b4-4dad-ae3f-59031adddbd5` and lease
`84e7a42a-d2a5-4c88-ba45-57b34ecc6de9`. Change only exact provider
runtime-tier/verification-environment persistence and filtering, private-query
clearing across all authorization/bfcache invalidations, unique valid
combobox/listbox ARIA relationships, and direct tests within P11-owned/runtime
paths. Preserve all earlier passing corrections. Re-run focused tests,
typecheck, lint/format/scope/digests, publish a superseding final, release the
lease, and stop with effects `0/0/0`. Apply no registration/steward request and
perform no provider action.

P23 final `24ec3a4effc622f384915d892cbaad046e1ea5d1` must not be
integrated. First resume it only for a three-runtime-file claim under claim
`096ffffc-1637-4602-a9a8-3084e03a50e1`, STUDENT_NOTIFICATIONS lease
`471de353-37c6-4e38-a6da-d2db92c4b207`, ready parent
`ca8eb4ab9957b6616664cfd5e944a73608596020`, and ready digest
`67ad844e050bc27b56b0f4de8c7388e60ebac33a14e497e482c409e104020d4b`.
Change exactly the three P23 runtime files, bind the fresh identities/rejected
head, push normally, remote-verify, and stop for C00 reconciliation. Do not
edit product, test, migration, registration, or request files in that push.

Only after reconciliation may P23 restore the exact locked **Open schedule**
visible action label for both `class_changed` and `class_canceled` while
retaining canonical route `/app/student/calendar`, and replace the raw
NUL-delimited persisted dedupe representation with an injective PostgreSQL-safe
encoding of the exact event-type/source-entity/recipient/source-version tuple.
Add exact-copy assertions and a PostgreSQL-boundary regression proving the
persisted key contains no NUL while same-tuple retries remain stable and
different tuples do not collide. Preserve every prior passing lifecycle,
privacy, race, retention, sound, timezone, idempotency, route, tab, and ancestry
correction. Re-run focused tests, typecheck, lint/format/scope/digests, release
the lease, publish a superseding final, and stop for independent re-audit. Do
not apply migration/registration/steward requests or perform provider/send
actions.

P23 copy/dedupe-persistence claim
`102c75c257dda033750d38e95b84ab05b8781507` is reconciled. Resume it
under unchanged claim `096ffffc-1637-4602-a9a8-3084e03a50e1` and lease
`471de353-37c6-4e38-a6da-d2db92c4b207`. Implement only the locked
**Open schedule** label/canonical calendar route pairing and an injective
PostgreSQL-safe exact-tuple dedupe representation with direct no-NUL,
same-tuple-stability, and collision-negative tests inside P23-owned/runtime
paths. Preserve every earlier passing correction. Re-run focused tests,
typecheck, lint/format/scope/digests, publish a superseding final, release the
lease, and stop with effects `0/0/0`. Apply no migration/registration/steward
request and perform no provider/send action.

P11 final `899ef6a7fad4f0946378721a0af7d7ed66c25c81` must not be
integrated. First resume it only for a three-runtime-file claim under claim
`d76c097a-d2df-4e8c-ae99-659deba00c64`, ADMIN_OPERATIONS_UI lease
`84cd0230-d35a-4149-845c-9cd4bcfb6ff5`, ready parent
`6cd1efc5fdba8c2c6369ce15877eb3f008149f2b`, and ready digest
`aeea25ddac610fb96f090609a9c17e3b67400aeff8209772b0b99e3efa85c456`.
Change exactly the three P11 runtime files, bind the fresh identities/rejected
head, push normally, remote-verify, and stop for C00 reconciliation. Do not
edit product, tests, requests, registration, or steward files in that push.

Only after reconciliation may P11 enforce a no-private-render state
synchronously whenever authorization is not current Admin, generation-guard
every in-flight search and resolver completion against the exact credential
version/authorization state before state update or navigation, replace lossy
option-ID sanitization with a deterministic injective DOM-safe encoding, and
redact/reject Bearer secrets separated by whitespace as well as `:`/`=`.
Add direct revoked-first-render, stale-promise completion, dotted/colon ID
collision, active-descendant uniqueness, and Bearer-space leakage tests.
Preserve all earlier passing corrections. Re-run focused tests, typecheck,
lint/format/scope/digests, release the lease, publish a superseding final, and
stop for independent re-audit. Do not apply registration/steward work or
perform provider/external actions.

P23 final `32f3a4649632c5768b46430c13b4cb2a3546cfc3` remains read-only
pending its independent exact-source semantic verdict. Do not queue or
integrate it before PASS.

P23 final `32f3a4649632c5768b46430c13b4cb2a3546cfc3` has now passed that
semantic verdict and is admitted. Resume I36 only from exact integration head
`cecc1c0dc6ff57562e5d89dd731289d860086bf7` under claim
`4f275da3-6bac-4149-8f0d-42206f5d238e`, RELEASE_INTEGRATOR lease
`5f617e0e-7f87-4eba-9dd0-1361227d272a`, and ready digest
`732033d08cdaf7ed841579fe63545e9150fb9ffd8abe3204b74e09e780ba25f7`.
Change exactly I36 `TASK-STATE.yaml`, `HANDOFF.md`, and `NEXT-PROMPT.md`,
push normally, remote-verify, and stop for C00 reconciliation. Do not merge
P23 or apply its migration/registration requests in this first push.

I36 claim `f75b0922c3b9db11a8ca4beacc9f45a285ac8f0e` is reconciled.
Resume that exact head under unchanged claim and lease. Verify merge payload
digest `7abbd657a3e4089ff5478f77fab356517c5fd090cb496a6ee53ea2cba5fae197`,
then ancestry-merge only P23 source
`32f3a4649632c5768b46430c13b4cb2a3546cfc3` with exact parents and the
19 queued paths. Preserve source ancestry, run the four focused files /
22 tests and workspace typecheck, then publish the I36 metadata-only release
checkpoint and release the lease. Leave P23 migration and registration
requests unapplied; perform no provider/send/external effect.

P23 integration is complete at I36 release
`088b40476bd5ceeb0af901b6f78a4cb8c556671b`; do not repeat it and do not
apply its assigned migration/registration requests outside their steward
checkpoints. Continue P11's already authorized atomic claim-only phase from
rejected final `899ef6a7` under ready digest `aeea25dd`, then reconcile that
claim before allowing any product correction. No provider or external effect
is authorized.

P11 claim `77c168d0a4a27b81ba1f7cddaa8d31821a8654f6` is reconciled.
Resume it under unchanged claim `d76c097a-d2df-4e8c-ae99-659deba00c64`
and ADMIN_OPERATIONS_UI lease `84cd0230-d35a-4149-845c-9cd4bcfb6ff5`.
Implement only the confirmed residuals: synchronous no-private state whenever
authorization is not current Admin; exact credential-generation/authorization
guards before every in-flight search or resolver state update/navigation;
deterministic injective DOM-safe option IDs; and Bearer-secret handling for
whitespace as well as `:`/`=`. Add direct revoked-first-render, stale-promise,
dotted/colon collision, active-descendant uniqueness, and Bearer-space tests.
Preserve earlier corrections, run focused verification and typecheck, release
the lease before expiry, publish a superseding final, and stop for independent
re-audit. Apply no steward/provider/external effect.

In parallel, create only the two authorized atomic branches from exact
integration head `088b40476bd5ceeb0af901b6f78a4cb8c556671b`:

- P21 `codex/v21-p21-content-publication`, claim `3a93eeca-5035-4328-b685-e580f2b32ce6`,
  CONTENT_PUBLICATION lease `31423c6c-74ef-43cc-b3a8-75b425568619`,
  READY digest `d2b127c6cb94a4428a39f1789f153a625b6b3153b0e4104778aa7f51c98cebe2`.
- P09 `codex/v21-p09-school-inquiry`, claim `92d411ff-e9c0-431d-ab69-e7b71935e4e5`,
  SCHOOL_INQUIRY lease `55f80667-a56c-4eeb-b04c-dcd40700466e`,
  READY digest `d40ec2fea20f686e5cf866e7f25c2693465ae2f1a7d6afe45f96de8a7b98e529`.

For each, seed and push exactly the three task runtime-memory files, verify
normal atomic branch creation, and stop for C00 reconciliation. Do not edit
product code, inspect live providers, apply steward work, or perform effects
in either first push.

P09 claim `64e5626832e3b849f61e1f020d12acb25d13e0e9` and P21 claim
`6a065ef4f8a23bce3c7ef6d6caa70a342114f12e` are reconciled. Resume them
under their unchanged claims and leases. Implement only each task's normalized
owned roots plus immutable structured steward requests, use local provider
ports/mocks only, run focused tests/typecheck/scope/digest checks, release
leases, publish ready-for-review finals, and stop for independent audit. Do not
apply migration/registration/config requests or inspect/mutate live GHL,
Vimeo, Drive, S3, or any external provider.

P11 final `17538da1ff15066c3e242567970062db4589577b` must not be
integrated. Resume it only for an atomic three-runtime-file claim under claim
`95a4b423-1906-4b24-846b-c4f9d3c1c32a`, ADMIN_OPERATIONS_UI lease
`c9c69acd-9df5-4411-9cbd-887f33f237f1`, acquisition
`930b5ab55c1f7e40b1143a757417bee1ca9ae49e`, and READY digest
`daa56dabb6b8f3d28f7a4d23ce252143d51f8b8b08fbad35802ac9fedef34dcb`.
Change exactly P11 `TASK-STATE.yaml`, `HANDOFF.md`, and `NEXT-PROMPT.md`,
bind the rejected head and fresh identities, push normally, remote-verify, and
stop for C00 reconciliation.

After reconciliation only, bind every retained private page, request, and
recent-query snapshot to the credential version that produced it and
synchronously fail closed unless that version equals the current Admin
credential. Add rotated-Admin SSR/first-render and same-state credential-change
tests while preserving the passing revoked render, generation guards, injective
IDs, Bearer filtering, authorization, privacy, a11y, window, timezone, and
navigation behavior. No provider/external effect is authorized.

P11 final `51bd416bbf3b53a2eb985c41617673135bcfc7a7` failed semantic
admission and must not be integrated. Resume that exact head only for an atomic
correction claim under claim `b66b8fdf-14d6-4f3b-8902-ebe8a16cba81`,
ADMIN_OPERATIONS_UI lease `39ce3c68-6685-4981-bc09-f1cd3dd24c55`,
ready parent `a6a9c53b670c1345187f846eaf1f53133f4c7e67`, and ready digest
`48210c4c569564fcf829a5ee5fbd3fcf9b4b989377ad0ca8f898fc66d32f1aba`.
The first push changes exactly the three P11 runtime-memory files, binds the
fresh authorization/claim/lease and rejected source head, pushes normally,
remote-verifies, and stops for C00 reconciliation. Do not edit product code in
that push.

After C00 reconciliation only, correct every confirmed P11 blocker within its
owned roots plus structured steward requests: a server resolver that rechecks
current Admin/session/scope and target authorization immediately before
navigation with neutral missing/archived/revoked results; exact
runtime/verification-environment filtering without relabeling provider rows;
the locked quick actions and truthful PS-025.3 operational groups; canonical
primary destinations; approved content metadata matching; redaction/rejection
of provider URLs, secrets, and sensitive title content; actually time-bounded
Recent Activity; sign-out/role-revocation/bfcache clearing; accessible active-
descendant/focus behavior; and visible unambiguous Jerusalem zone labels.
Strengthen the registration request for the exact resolver, route, cache,
session-version, and partner-composition duties but do not apply it. Preserve
POST-body-only private search, `no-store`, same-origin/CSRF requirements, real
data only, all eight kinds, exact Admin equality, safe same-origin destinations,
honest empty/error/pagination behavior, and zero effects. Re-run focused
positive/negative tests, direct leakage/TOCTOU/environment probes, typecheck,
lint/format, scope/digest verification, release the lease, and publish a
superseding final for independent re-audit.

P11 atomic correction claim
`2fa5c8da116d42c9202c462ef9e061c254dd3958` is reconciled. Resume it
under unchanged claim `b66b8fdf-14d6-4f3b-8902-ebe8a16cba81` and lease
`39ce3c68-6685-4981-bc09-f1cd3dd24c55`. Implement the complete bounded P11
correction already enumerated above, add direct TOCTOU/environment/leakage/
cache/time-window/timezone/keyboard/a11y proof, strengthen but do not apply the
structured registration request, publish a superseding final, release the
lease, and stop with effects `0/0/0`.

P11 claim `bd40e5f0547eb9ad629c47fb4ab294982765978f` is reconciled.
Resume it under unchanged claim `95a4b423-1906-4b24-846b-c4f9d3c1c32a`
and ADMIN_OPERATIONS_UI lease `c9c69acd-9df5-4411-9cbd-887f33f237f1`.
Bind retained `AdminSearchPage`, initial-request state, and recent-query state
to the exact credential version that produced each snapshot. Before state
initialization or synchronous render, fail closed unless every retained
snapshot's version equals the current exact Admin credential version. Clear on
a same-state Admin credential-version change and add direct rotated-Admin
SSR/first-render and same-state version-change tests. Preserve all passing
revoked-render, generation, authorization, navigation, injective-ID,
Bearer-filtering, provenance, window, timezone, privacy, and accessibility
behavior. Run focused verification and typecheck, release the lease before
expiry, publish a superseding final, and stop for independent re-audit. Apply
no steward request and perform no provider or external effect.

P09 final `a81e5e98e21eeb1df8d0ff21dd6b948a33a65d46` is rejected and
must not be integrated. Resume it only for an exact three-runtime-file atomic
claim under claim `555a5878-9a7f-4486-a6e0-a959dc9ab1a1`,
SCHOOL_INQUIRY lease `8ca16a74-fa49-4c61-8aa8-b50416b50913`, acquisition
`b0dc03dc140dd05ab8ae65530cd672c8c10126e5`, and READY digest
`505e68237f3d2d0401e4727b9a8111a330026f994344ca804d83a6692a09f766`.
Change exactly P09 `TASK-STATE.yaml`, `HANDOFF.md`, and `NEXT-PROMPT.md`,
bind the rejected head and fresh identities, push normally, remote-verify, and
stop for C00 reconciliation. After reconciliation only, serialize the exact
normalized-email inquiry key or recover the uniqueness race, accept absent
optional phone/note as canonical null while rejecting extras, and bind the
durable acknowledgment intent to the approved template/version/digest rather
than UI success copy. Add direct concurrent and four-field tests. Do not apply
either steward request or perform a provider/external effect.

P21 final `24f82a7484f2889349f7768d29ec7f2545cfa45a` is rejected and
must not be integrated. Resume it only for an exact three-runtime-file atomic
claim under claim `f7ed5c86-2b2a-4e58-930a-b602ac9f1657`,
CONTENT_PUBLICATION lease `2ea04691-d951-4c3b-90cf-e1909f42be7c`,
acquisition `b0dc03dc140dd05ab8ae65530cd672c8c10126e5`, and READY digest
`571dff5375ca1cfd20d305f1924eaab1d6d7b05bd8588799f519467972c28ff3`.
Change exactly P21 `TASK-STATE.yaml`, `HANDOFF.md`, and `NEXT-PROMPT.md`,
bind the rejected head and fresh identities, push normally, remote-verify, and
stop for C00 reconciliation.

After P21 claim reconciliation only, require immutable content-version,
participant-snapshot, redaction-review, and Admin-attestation evidence before
approval; remove direct web-process provider mutation and preserve one fenced
F05/F06 provider-operation identity through canonical private-asset readback
and ambiguity reconciliation; atomically create versioned Student assignments,
library projections, and protected Student/adult recording notices; bind
playback grants to exact Student/session/content/assignment/access versions and
current enrollment, service-account consent, and revocation/privacy facts;
unpublish to `approved` while immediately invalidating active grant generation;
and validate/persist a governed occurrence/product relation. Preserve all
passing denial, five-minute TTL, search, resume, optimistic-write, and URL
redaction behavior. Strengthen but do not apply the steward request. Use local
ports/mocks only and perform no live provider or external effect.

P09 correction claim `86d5f5ffd046505c4df336ea40dd83c6559d3255`
and P21 correction claim
`355d7b126fe2db7b2e8061f86585d724866998a6` are reconciled. Resume
each under its unchanged claim and lease, implement only the exact bounded
correction enumerated above inside task-owned roots plus direct tests and
immutable structured requests, publish a superseding final, release the lease,
and stop for independent audit. Apply no steward request and perform no live
provider, send, or external effect.

P11 final `15660c1115d9d8066651573100acd8acaaac574e` has passed
independent exact-source audit and is admitted. Resume I36 only from exact
integration head `088b40476bd5ceeb0af901b6f78a4cb8c556671b` under
claim `5be2d721-aff2-494a-bb22-ad324334b376`, RELEASE_INTEGRATOR lease
`33a465ad-1fa2-4600-9259-044f6bc767a2`, acquisition
`e6a6729bc109816124ef2e7beef5e42aa398b147`, and READY digest
`a5b4fec66b1f2bcd67e278ba8b7d58d710d4d87bf1072706902e379001e20eb7`.
Change exactly I36 `TASK-STATE.yaml`, `HANDOFF.md`, and `NEXT-PROMPT.md`,
push normally, remote-verify, and stop for C00 reconciliation. Do not merge
P11 or apply `P11-registration-001` in this first push. No provider action,
send, or external effect is authorized.

I36 claim `ce3bf023ce2f9cfab4413ac3af711885caeb95ad` is reconciled.
Resume that exact head under unchanged claim
`5be2d721-aff2-494a-bb22-ad324334b376` and RELEASE_INTEGRATOR lease
`33a465ad-1fa2-4600-9259-044f6bc767a2`. Verify rebound P11 merge-item
digest `02c2f9db6892d5c3df3f315ec5583287ba71c5a5f492ba42755f627abb61f964`,
then ancestry-merge only source
`15660c1115d9d8066651573100acd8acaaac574e` with the exact queued
parents and 18 paths. Preserve source ancestry; run the 4 focused files /
21 tests and workspace typecheck; publish the I36 metadata-only release
checkpoint and release the lease. Leave `P11-registration-001` unapplied and
perform no provider/send/external effect.

F02 Lease B atomic claim
`6a5e359c0a7dae56542741126974a571af5da5a9` is reconciled.
Resume it under unchanged claim `e2a7b9ff-ce58-495e-b164-84d9299250d0`
and shared MIGRATION_AUTHORITY/SCHEMA_CONTRACT lease
`cad3d0dd-59a2-44dd-87fb-6597978daaaf`. Read only the six bound
requests in order P16/P32/P10/P23/P24/P27; update the allocation proposal;
author exact migrations 2239 through 2244 within the ten authorized paths;
derive native normalized-LF and pg-mem checksums; and prove all 75 migrations
in a fresh disposable database plus focused semantics, typecheck, lint,
format, build, package, YAML, secret, diff, scope, and zero-effect gates.
Release both writer slots before expiry, publish the final, and stop for
independent C00 audit. Do not edit any applied migration, allocate 2231 or
another ordinal, apply registration, inspect providers, deploy, send, or
perform an external effect.

F02 stopped its first Lease B draft safely after independent semantic audit
rejected release. Resume only from unchanged remote head
`6a5e359c0a7dae56542741126974a571af5da5a9` under READY digest
`635c8923ed3aa11f3dbcf11b1195a22235ce150e43284de265b48f1b0f7da8bd`,
claim `2002fc61-531d-4b4c-b0c0-c65b3468b8c5`, and shared
MIGRATION_AUTHORITY/SCHEMA_CONTRACT lease
`4d52c050-fd00-4240-a029-48d4f27f6820`. Correct and commit only the
F02 runtime triplet to renewed renewal_requested authority while preserving
the six SQL drafts and allocation proposal dirty and byte-unchanged. Push
normally, remote-verify, and stop for C00 reconciliation. Do not perform
semantic corrections, regenerate checksums, edit another path, apply
registration, inspect providers, deploy, send, or perform an external effect
in that first renewal push.

F02 renewal claim `9daa5251acf9b6d2c4c932d9864d894ded2bdd2d`
is reconciled under unchanged claim
`2002fc61-531d-4b4c-b0c0-c65b3468b8c5` and shared
MIGRATION_AUTHORITY/SCHEMA_CONTRACT lease
`4d52c050-fd00-4240-a029-48d4f27f6820`. Correct only the six preserved
SQL drafts and proposal against the seven bound semantic blockers, then
finalize the runtime triplet within the ten-path ceiling. Stabilize SQL before
regenerating native/pg-mem checksums. Rerun native and disposable 75/75
migration proof, focused semantic probes, typecheck, lint, build, format,
package, YAML, secret, diff, scope, lease-release, and zero-effect gates.
Push the final normally and stop for independent audit. Do not edit another
path, apply registration, inspect providers, deploy, send, or perform an
external effect.

F02 final `032aeb9cb0c786729ff2c394744ab561eeb3f6c1` is rejected
and must not be integrated. Resume F02, P16, and P32 only for their exact
atomic runtime-triplet claims from heads `032aeb9c`, `72fca16b`, and
`f4ae1c03` under the three READY entries issued from acquisition
`a6bc58cc4a35173fd1606124c0fa651dda2dac64`. Each worker must fetch the
containing control commit, verify its canonical READY digest, claim and lease,
change exactly `TASK-STATE.yaml`, `HANDOFF.md`, and `NEXT-PROMPT.md`, push
normally, remote-verify, and stop for C00 reconciliation.

Do not correct SQL or product code in the first push. After C00 reconciles all
three claims, route only: migration 2239 canonical-selection lifecycle
preservation to F02; authoritative series/occurrence reminder-time persistence
to P16; and explicit trusted product/runtime-tier/verification-environment
persistence plus composite binding to P32. Require native positive and
negative compatibility probes, task tests, typecheck, scope/format/secret
gates, released leases, and effects `0/0/0` before any re-admission.

F02 claim `24c327eaf06fc502d167d2d5863c5fbb05db5a2c`, P16 claim
`be95754a1b331a5e420f9cf755bc190357fe3436`, and P32 claim
`39a578ff9a8ba91c59ebe082dc6611a17c051b79` are reconciled.
Resume each exact head under its unchanged claim and lease. F02 may alter only
2239, its allocation proposal/checksum metadata, direct schema probes, and its
runtime triplet while preserving 2234-2238 and 2240-2244. P16 may alter only
its task-owned class-series/occurrence repository roots, direct tests, and
runtime triplet to persist authoritative non-null reminder timing. P32 may
alter only its task-owned privacy contract/domain/repository/server roots,
direct tests, and runtime triplet to carry explicit trusted
product/runtime-tier/verification-environment scope without unsafe defaults.

Each worker must run exact native positive/negative compatibility probes,
focused tests, typecheck, formatting, secret/diff/scope gates, release its
lease before expiry, push a superseding final, remote-verify, and stop for
independent audit. Do not merge, register, inspect providers, deploy, send, or
perform an external effect.

F02 `cd2d7c2fe3bfeb250c320bc02c9bfebb3bd04911` and P32
`92a7ee6377d9507140def1159a440fbfd1733123` have passed independent
compatibility audits and are held for ordered integration. P16 timing final
`c58ed7d65f46783717901512d249202b2ec46614` passed its authorized audit,
but the repository still passes public/domain weekdays `0..6` directly to
migration 2237's ISO `1..7` column.

Resume P16 only for an atomic runtime-triplet claim from exact head `c58ed7d6`
under READY digest
`bfbe5b37da8dd4e6acb36c5d57ea68a365d81fae50a95c53bb738e7e07c70be5`,
claim `ebdca6e9-aa5b-411b-88fd-747089e869ce`, and CLASSROOM_CORE lease
`8c250e39-5c4d-4684-93ba-2ff373a1253a`. The first push must change exactly
P16 `TASK-STATE.yaml`, `HANDOFF.md`, and `NEXT-PROMPT.md`; preserve all
product/test bytes; push normally; remote-verify; and stop for C00
reconciliation.

After reconciliation, encode Sunday `0` as database `7`, preserve weekdays
`1..6`, decode database `7` back to public/domain `0`, preserve array order,
reject absent/non-integer/out-of-range/duplicate values before persistence,
and prove canonical Sunday-through-Thursday roundtrip through native
PostgreSQL after exact migration 2239. Limit the final correction to the P16
repository, its direct test, and runtime triplet. Do not edit migrations,
contracts, domain roots, interfaces, steward requests, registrations,
providers, deployment, sends, or external effects.

P16 atomic weekday claim
`79c745344e71c3b90a9fd7e569920e63a4d865cf` is reconciled as the exact
runtime-triplet-only child of `c58ed7d6`. Resume it under unchanged claim
`ebdca6e9-aa5b-411b-88fd-747089e869ce` and CLASSROOM_CORE lease
`8c250e39-5c4d-4684-93ba-2ff373a1253a` through
`2026-07-30T02:31:25Z`.

Change exactly `packages/db/src/classes/core/repository.ts`,
`tests/unit/classes/classroom-core-repository.test.ts`, and the P16 runtime
triplet. Preserve public/domain weekdays `0..6`; encode Sunday `0` as database
`7`, preserve `1..6`, decode database `7` back to Sunday `0` without
reordering, reject absent/non-integer/out-of-range/duplicate sets before any
query, and prove canonical `[0,1,2,3,4]` to database `[7,1,2,3,4]` and back
through native PostgreSQL after exact migration 2239. Run focused tests,
typecheck, lint, format, secret, diff/scope and native gates, release the lease,
push a superseding final, remote-verify, and stop for independent audit.

Do not edit migrations, contracts, domain weekday semantics, interfaces,
steward requests, registrations, control, integration, providers, deployment,
sends, or external effects.

Resume I36 from exact integration head
`1798f31b5f698c80ee2babbd6414e9934745a178` under READY digest
`ac622e744953504c52a7250aadcf75ba4b2b73126c42c4a0c6e2463a470500c9`,
claim `d2ba6c12-e7c2-49b1-b4cd-883a1c394adb`, and RELEASE_INTEGRATOR
lease `6c88e2a7-e2fc-48be-acae-4b4a5e9839ad` through
`2026-07-30T03:54:35Z`.

Fetch and verify the containing control commit, exact READY payload, ordered
P16/P32/F02 merge items, source heads and canonical digests. The first push
must change exactly I36 `TASK-STATE.yaml`, `HANDOFF.md`, and `NEXT-PROMPT.md`,
record the claim and lease, preserve all product/migration/steward bytes, push
normally, remote-verify, and stop for C00 reconciliation.

Do not merge a source, modify product code or SQL, apply steward requests,
inspect providers, deploy, send, or perform an external effect until C00
consumes the READY entry and rebinds every merge target to the exact claim
head.

Resume I36 at exact claim head
`d53c1d22dfa84806b07c51e599997c7ebc053849`. The READY entry is consumed
and the three ordered merge targets are rebound. Recompute canonical payloads
P16 `58695dcb553d55502ba509ea54783b5e78d1edd9094ea9333f6467eca9a7fcf2`,
P32 `18378a2ea0fae5b91640def9946c8ccf2e54f11c1d879ecbab55fbcf27af5836`,
and F02 `e85b0073845c7bd7489d8596e5b68ddfe5792a0653ab376bdd69c7fdfa701195`.

Merge exact source heads P16 `55544f55`, P32 `92a7ee63`, then F02
`cd2d7c2f` with source ancestry preserved. Verify each merge's parents,
first-parent allowlist, merge-after dependencies, exact cumulative scope, and
all source digests. Run combined focused tests, workspace typecheck,
native/pg-mem 75-migration replay and checksum gates, format/lint/secret/diff
checks, and effects `0/0/0`. Then update only the I36 runtime triplet to record
the final evidence and release lease `6c88e2a7-e2fc-48be-acae-4b4a5e9839ad`
before `2026-07-30T03:54:35Z`; push, remote-verify clean equality, and stop for
independent audit.

Do not apply steward requests, inspect or mutate providers, deploy, send, or
perform an external effect.

Before merging P16, verify its `merge_after_heads.P15` is exact live/source
dependency `c96b8c55c07e5283e762537934a6bf948833700e` and is an ancestor of
the integration claim head. Reject any nonexistent, abbreviated, or
prefix-matched dependency SHA.

Release `36dca3844664657875b7c66a1ff30378b21c5cbb` is independently
audited and reconciled. MERGE and READY are empty; migrations 2239 through
2244 and their six steward results are recorded; the next ordinal is 2245.

Next, perform a read-only inventory comparing integration ancestry with all
ready-for-review source heads and dependency/steward requirements. Admit only
the next dependency-valid source-only wave through a fresh exact I36 claim and
lease. Candidate is still null. Do not inspect or mutate providers, deploy,
send, reserve an effect, or perform any external effect before candidate,
identity, budget, dependency, and fencing gates are satisfied.

Resume I36 from exact release
`36dca3844664657875b7c66a1ff30378b21c5cbb` under READY digest
`25dc83c569bb1e5a6a8f2196c4b9f9e01371d9268593360cc0560468f964a7b9`,
claim `4ec8712e-8ed3-4164-8774-c03c67748ec4`, and RELEASE_INTEGRATOR
lease `2ed546f8-d65b-4fe3-b86c-042d441e3015` through
`2026-07-30T05:45:23Z`.

Fetch and recompute the exact READY entry plus P29 merge digest `f1294fce`
and P30 digest `81d29fd0`. The first push must change only I36
`TASK-STATE.yaml`, `HANDOFF.md`, and `NEXT-PROMPT.md`, preserve every
product/steward byte, push normally, remote-verify, and stop for C00
reconciliation. Do not merge, apply a steward request, inspect providers,
deploy, send, or perform an external effect before C00 consumes READY and
rebinds both targets to the exact claim head.

I36 claim `c698da9826572c486f3ddf14cb01785dd2a120cf` is independently
reconciled. READY is consumed and both merge targets are rebound to that
claim. Recompute P29 payload `d26853a6ae2eeb0b7c15c5730a5ccd83ff6b318b29fcea997d9e622a023e87d3`
and P30 payload `e005f5c019ccc58160fb46e273abdb00068ea9f482fe670597707cb2cee76884`,
then merge exact P29
`aa7b363812676afce8ac9ebd13f335e65551bb1f` followed by P30
`772d4783f82b7eb89a5c98d897601b444cd3c2f4`, preserving ancestry and
the exact 15-path and 14-path allowlists.

Run combined focused workflow tests, typecheck, lint, focused format, YAML,
secret, ancestry, scope, and effects `0/0/0` gates. Update only I36 runtime
metadata to release lease `2ed546f8-d65b-4fe3-b86c-042d441e3015`,
push, remote-verify, and stop for C00 audit. Do not apply steward requests,
inspect providers, deploy, send, or perform an external effect.

Final source release `42068ace48fe1a93302ce7d5533e11803b526d5b`
is independently audited; all 35 implementation heads are ancestors and
MERGE is empty.

Resume F02 from exact `cd2d7c2f` under READY `5ab53779`, claim `0e98de00`,
and only the MIGRATION_AUTHORITY/SCHEMA_CONTRACT leases through
`2026-07-30T06:01:19Z`. Its first push may change only the F02 runtime
triplet. After C00 reconciliation, it may implement only ordinals 2245–2249
for P19, P20, P28, P08, and P09 in that dependency order. Do not reserve an
ordinal for P17, P18, or P21.

Resume P28 from exact `f891f16e` under READY `48da940a`, claim `42599e59`,
and COMMUNICATION_FOUNDATION lease `ac74a2a9` through
`2026-07-30T06:01:19Z`. Its first push may change only the P28 runtime
triplet. After C00 reconciliation, implement only integrated request
P17-REMINDER-ROUTING-001 within P28-owned additive paths. No provider call,
send, deployment, or external effect is authorized.
Continue F02 only under claim `0e98de00-4873-41cb-a06f-bd0ace918b89` and its
MIGRATION_AUTHORITY/SCHEMA_CONTRACT leases, implementing only migrations 2245
through 2249. Continue P28 only under claim
`42599e59-5e65-4269-b3d1-d10632342be6` and its COMMUNICATION_FOUNDATION lease,
implementing only P17 reminder routing. P17/P18/P21 migration duties remain
withheld. Keep provider inspection, deployment, sends, and all effects blocked
until candidate gates are satisfied.
P31 may atomically resume from exact head
`ba811b3b2682ab46de1859334f5aa4ad5d7f5f0d` under claim
`ff4a79d9-158b-4e3f-a150-03b171427749` and COPY_CATALOG lease
`d03dd6a9-384f-4b52-aaaf-3ac5752a36da` for only
`P30-copy-registration-001`. Change exactly its runtime triplet, push, and stop
for C00 reconciliation before copy-catalog edits. Keep effects `0/0/0`.
Continue P31 only under claim `ff4a79d9-158b-4e3f-a150-03b171427749` and
COPY_CATALOG lease `d03dd6a9-384f-4b52-aaaf-3ac5752a36da`, implementing only
`P30-copy-registration-001`. Preserve adult-only, current-consent,
named-approval, exact-digest, and no-token-content gates. Do not configure,
activate, enroll, or send through providers. Keep effects `0/0/0`.
After F02, P28, and P31 direct prerequisites finish, apply the 38 immutable I36
steward duties in serialized dependency order: config/dependency, central
registration, GHL registry/projection, then deployment metadata. Keep protected
or provider-bound targets fail-closed until concrete paths and approved
non-secret metadata exist. Do not mark OPS-084 complete or begin
`production_broad` without the exact externally approved six-file legal bundle.

F02, P28, and P31 direct prerequisites are now independently audited. Prepare a
fresh I36 runtime-triplet-only atomic claim from exact integration release
`42068ace48fe1a93302ce7d5533e11803b526d5b`, then stop for C00 reconciliation.
After target-CAS rebind, integrate exact F02
`6d16d6eb2c901c58cc4d0c2bb3298b5543af3d9f`, P28
`a2025a768ae6e69a15ec5605379a9e359cf2deec`, and P31
`d72dda5669627695edaf9dbf20f7650c9b5c9ded` in that order, preserving ancestry
and exact 9/12/8-path allowlists. Run combined migrations, focused tests,
typecheck, YAML, scope, digest, secret, and zero-effect gates; release the
integrator lease and stop for independent audit. Do not apply central steward
requests during this ancestry-only wave.

Resume I36 from exact release `42068ace48fe1a93302ce7d5533e11803b526d5b`
under READY digest
`b60c929884c5bd974b66c1f02fe56d23fd50cceee35e929b5138a2d3c912bda1`,
claim `ff36a180-ce16-4787-841b-5e10a7aabfec`, and RELEASE_INTEGRATOR lease
`0430520f-6a94-4550-a1ea-f01f8d5173b2` through
`2026-07-30T06:35:30Z`. Recompute the exact C00/I36/F02/P28/P31 dependency
bindings and merge payloads F02 `bfb510da`, P28 `f3e7df0d`, and P31
`f9922704`. Make only a runtime-triplet atomic claim, push normally, verify
remote equality, and stop. Do not merge a source, apply a steward request,
inspect a provider, deploy, send, or perform an external effect before C00
consumes READY and rebinds all three target CAS fields to the exact claim head.

Resume I36 at exact claim `1b8335f8bdad4bc4ac1aa65838314faa7d65ebd0`.
READY is consumed and the ordered merge targets are rebound. Recompute payloads
F02 `54cf0dc63a9ec3df6181224f82104e3c5f7163537cd970704b28abfc6640a597`,
P28 `55ca02a580f22d764be7fe62dd4e5455a811d423bbbbac4d75b008117c5505ad`,
and P31 `066ea448b424ada56611b6abdea4a56b49146707a34e0149199a0baca4509626`.
Merge exact F02 `6d16d6eb`, then P28 `a2025a76`, then P31 `d72dda56`,
preserving ancestry and exact 9/12/8-path scopes. Run combined migration,
focused, typecheck, YAML, digest, scope, secret, diff, and zero-effect gates.
Update only I36 runtime metadata to release lease `0430520f`, push, verify
remote equality, and stop for C00 audit. Do not apply central steward requests,
inspect providers, deploy, send, or perform an external effect.

I36 direct-prerequisite release
`3cf787409decb5beb84561ef7e37924111d398b6` is independently audited and
reconciled. Migrations 2245 through 2249 and the seven direct steward results
are recorded, MERGE is empty, and all effects remain `0/0/0`.

Resume P31 from exact existing head
`d72dda5669627695edaf9dbf20f7650c9b5c9ded` under READY digest
`23b245aac06c1984c4a52dca9c5a58df201a2c14f67192f28d3552354845b314`,
claim `7f50cef8-f816-4a32-8f9e-071db09abbc0`, and COPY_CATALOG lease
`42734cda-47b5-44ec-8d9a-8da7c4f86ed1`. Recompute the exact C00/I36/P31
bindings, lint-file digest, claim, and lease. The first push must change only
P31 `TASK-STATE.yaml`, `HANDOFF.md`, and `NEXT-PROMPT.md`, preserve every
source, test, copy, request, and interface byte, push normally, verify remote
equality, and stop for C00 reconciliation.

Do not remove `_removedNamedApproval` before C00 consumes READY and reconciles
the atomic claim. Do not configure, inspect, activate, enroll, or send through
a provider; do not deploy or perform an external effect.

P31 claim `9d878d88587d6f742a927d3cf4e175594d1e12de` is independently
reconciled. Continue only under claim `7f50cef8-f816-4a32-8f9e-071db09abbc0`
and COPY_CATALOG lease `42734cda-47b5-44ec-8d9a-8da7c4f86ed1`. Remove only
the unused `_removedNamedApproval` binding in
`tests/unit/communications/copy-catalog.test.ts`; preserve the test assertion,
copy catalog, approval semantics, interface checkpoint, requests, and runtime
behavior. Run the focused test, workspace typecheck, full lint, scoped format,
YAML, secret, scope, and diff gates. Release the lease, publish a superseding
final, verify remote equality, and stop for C00 audit. Effects remain `0/0/0`.

P31 final `839ec12bb83317a63f1d064891fb2929a707f3ec` is independently
audited and ready for bounded I36 integration after the current disjoint
correction lanes finish. Do not reopen its released COPY_CATALOG lease.

P17 may make only its runtime-triplet atomic claim from exact
`78af71603713b6fc73fe755995bdf56193eb199a` under canonical READY
`b141b7501dd1862aab3232f939458e6652a6a8d20d7b003e71f6917bac94ada6`,
claim `f7c01bf5-d289-48fc-bf32-cec1c1c1d6a1`, and ZOOM_PREPARATION lease
`0e53a171-263b-41d9-b957-80588027c194`. Recompute every dependency, ownership,
request, allowlist, and lease binding. The first push changes only P17
`TASK-STATE.yaml`, `HANDOFF.md`, and `NEXT-PROMPT.md`, preserves every product
and existing request byte, pushes normally, verifies remote equality, and
stops for C00 reconciliation. Do not edit a migration or inspect a provider.

P20 may make only its runtime-triplet atomic claim from exact
`3d75b57e91c12ab3e0cad78b1a6a63497838f46f` under canonical READY
`ba07246d1f3ed1d91828512ed588feca1f0b647928b2afb8b0e132aef3ae86ea`,
claim `e8c768e8-f603-4d0c-a45b-34b5cd7ea92c`, and CONTENT_PROCESSING lease
`24d0fa6f-30ac-4fc0-af2a-2b495d826063`. Recompute every dependency,
migration-result, P20/P21, base-manifest, collision, allowlist, and lease
binding. The first push changes only P20 `TASK-STATE.yaml`, `HANDOFF.md`, and
`NEXT-PROMPT.md`, preserves all source/migration/request bytes, pushes
normally, verifies remote equality, and stops for C00 reconciliation. Do not
edit P21, publish a migration request, inspect a provider, or perform an
external effect.

P17 renewed claim `b9e7b49a2fa8c0ad1281dc262babd457d4f532ac` is reconciled.
Continue only under fresh claim `e85735a2-4a41-476b-bca2-d1dde009e69d`
and ZOOM_PREPARATION lease `0d08dc64-fb12-4aa5-bf5d-10a3267e18f4`
through `2026-07-30T08:31:44Z`, using only the explicit eleven-path
allowlist. Preserve P18's sole launch/bootstrap/live-session/attendance
ownership; replace competing provider persistence with canonical `job_outbox`
plus `provider_operation_binding`; limit P17 to five preparation tables;
publish only `P17-MIGRATION-002` and
`P17-SERVER-WORKER-REGISTRATION-002`; run exact gates, release the lease,
push, and stop for C00 audit. Provider inspection and effects remain forbidden.

P20 final `dc438725fb6bb8779c2d816d5e28d3b73227b6d4` is behaviorally valid
but rejected for stale runtime digest metadata. Atomically claim only its
runtime triplet under canonical READY
`f10eafc49cd2665bd6bf1b8ae5e804fd880799e4ca734c9e88954957e0f7ff91`, fresh claim
`162924fc-86b1-466b-8836-9e6fcc2a1326`, and CONTENT_PROCESSING lease
`3da95218-b815-434a-ae63-154220c083b0` through
`2026-07-30T08:32:00Z`; preserve every source/test/request/migration/P21 byte
and the two stale fields, push normally, verify remote equality, and stop.
After C00 reconciliation, replace contract digest `cb557d14…` with final blob
digest `cdeff616…`, replace or explicitly historicize twelve-file aggregate
`d58ec3c6…` with corrected implementation aggregate `9b4cfb26…`, rederive the
runtime triplet, release the lease, push, and stop for audit. Effects stay zero.

P17 final `506d9024fc3280f0f302c04b7d265597117d9936` is semantically valid
but rejected for conflicting stale runtime instructions/status. Atomically
claim only its runtime triplet under canonical READY
`e716a27e02a9f92e5214777cb3ba4f6298309d0e8bd6147d12853b3f5119a245`,
fresh claim `023cf8f0-4c6b-4224-943e-71c8e7f522d2`, and ZOOM_PREPARATION
lease `24a593bc-5edd-4fe1-8e65-87cbebdfd933` through
`2026-07-30T08:37:15Z`; preserve every non-runtime byte and the stale text,
push normally, verify remote equality, and stop. After reconciliation, remove
or explicitly label the old `3560b053` handoff/next blocks as superseded,
mark terminal gates passed, and state exactly: migration-001 and
server-worker-registration-001 are superseded/withheld; Zoom-config-001 stays
assigned; reminder-routing-001 stays applied/acknowledged; every `-001` byte
is preserved. Recompute runtime evidence, release, push, and stop for audit.

P20 claim `75abbd84cc8668aff4a4ed803f907e237f65bb5a` is reconciled.
Change only its runtime triplet: replace stale contract digest with
`cdeff616…`, replace or explicitly historicize the stale twelve-file aggregate
with corrected `9b4cfb26…`, make every runtime statement unambiguous, rederive
manifests, release CONTENT_PROCESSING lease `3da95218`, push, and stop.

P17 claim `8d409a2d70017a60dc70c54eac3942deaf40eb7d` is reconciled. Change
only its runtime triplet: remove or label superseded old-head instructions,
mark terminal verification passed, and record exact `-001` dispositions
without changing request bytes. Recompute manifests, release ZOOM_PREPARATION
lease `24a593bc`, push, and stop. Both effects remain `0/0/0`.

I36 may atomically claim only its runtime triplet from exact release
`3cf787409decb5beb84561ef7e37924111d398b6` under READY
`f04fd32379e14f45a60988328b95ad07095463648519f4d8ae642b52542a8dce`,
claim `b3e05cde-c76b-4b54-8a63-9a32624f6a87`, and RELEASE_INTEGRATOR
lease `dbef2b0e-c3c6-4ed9-a15f-f8fc0ae02dc7`. Recompute canonical control,
release, task, path, source-manifest, merge-payload, claim, and lease bindings.
The first push changes only I36 `TASK-STATE.yaml`, `HANDOFF.md`, and
`NEXT-PROMPT.md`, preserves all source/runtime/request bytes, pushes normally,
verifies remote equality, and stops for C00 reconciliation. Do not merge,
apply either P17 request, allocate migration 2250, inspect a provider, deploy,
send, or perform an external effect.

I36 claim `1b0df6fa15b2ac4a5febe35fee3f18ca9b9457d7` is reconciled.
Continue only under claim `b3e05cde-c76b-4b54-8a63-9a32624f6a87` and
RELEASE_INTEGRATOR lease `dbef2b0e-c3c6-4ed9-a15f-f8fc0ae02dc7`.
Recompute rebound payloads P31 `951e3547`, P20 `a3c16a42`, and P17
`1017f826`, then merge exact sources `839ec12b`, `75137bf4`, and `7f8a41bc`
in that order with ancestry-preserving two-parent commits and exact 4/8/14
scopes. Run focused tests, workspace typecheck, full lint, formatting,
YAML/secret/migration/diff/parent/scope gates; publish a runtime-triplet-only
release final, release the lease, push normally, and stop for audit. Do not
apply P17 requests, allocate migration 2250, inspect providers, deploy, send,
or perform effects.

I36 release `e2907b4086e65074a49717a840f45d53685b15f3` passes all code,
ancestry, scope, test, lint, migration, lease, request, remote, and zero-effect
gates but is rejected for two stale top-level TASK-STATE fields. Atomically
claim only its runtime triplet under READY
`b793c1816f3e150ec5b2e1d79b4e317388b0e61dcd92d58a2418ae17c563382d`,
fresh claim `27f0fe39-785e-4cae-a707-de596a7e8500`, and RELEASE_INTEGRATOR
lease `745aefd4-8660-4a0b-8d43-852769ced512` through
`2026-07-30T09:47:00Z`. Preserve the stale fields on the first push, stop for
C00 reconciliation, then set `remaining_steps: []` and clear or explicitly
resolve the stale top-level P31 lint finding while preserving historical
verification. Recompute runtime evidence, release the lease, push, and stop.
Do not edit source, merges, migrations, requests, control ledgers, providers,
deployment, sends, or effects.

I36 metadata claim `3aab6a199730ab2ed75f45c234ec8331894cdf6b` is
reconciled. Continue only under claim
`27f0fe39-785e-4cae-a707-de596a7e8500` and RELEASE_INTEGRATOR lease
`745aefd4-8660-4a0b-8d43-852769ced512` through
`2026-07-30T09:47:00Z`. Change only the I36 runtime triplet: set top-level
`remaining_steps: []`, clear or explicitly resolve the obsolete top-level P31
lint finding, preserve the historical failed verification and later passing
full lint, rederive pair/triplet evidence, release the lease, push normally,
and stop for independent audit. All source, merge, migration, request,
control-ledger, provider, deployment, send, and effect bytes remain frozen.

I36 final `f83ff0ce1ffb4ffcabfc8e6fccdbcc63278a61c5` passes all other
release and metadata gates but is rejected because one current verification
row still says the completed final push is pending. Atomically claim only the
I36 runtime triplet under READY
`3252e7b6e9e35f332e799e0151c14cd097cbc549b2d6c7879227f83268fa6228`,
fresh claim `f34c38fb-f977-4c41-ae4b-5343d13c85f7`, and RELEASE_INTEGRATOR
lease `994b32cc-4ca9-4b11-88ed-713631a61f33` through
`2026-07-30T09:47:00Z`. Preserve the pending result on the first push and stop
for C00 reconciliation. After reconciliation, record it as passed at exact
final `f83ff0ce`, sole parent `3aab6a19`, runtime-triplet-only scope,
pair/triplet `0ad39797`/`d069382c`, released lease, clean remote equality,
frozen non-runtime bytes, and effects `0/0/0`; release the new lease, push,
and stop. Do not edit any non-runtime byte or perform an effect.

I36 terminal-verification claim
`391866bf32150b515159146a329568ce544ade48` is reconciled. Continue only
under claim `f34c38fb-f977-4c41-ae4b-5343d13c85f7` and
RELEASE_INTEGRATOR lease `994b32cc-4ca9-4b11-88ed-713631a61f33`
through `2026-07-30T09:47:00Z`. Change only the I36 runtime triplet: replace
the one stale pending post-reconciliation verification result with passed
evidence at exact final `f83ff0ce`, sole parent `3aab6a19`,
runtime-triplet-only scope, pair/triplet `0ad39797`/`d069382c`, prior lease
released before expiry, clean remote equality, frozen non-runtime bytes, and
effects `0/0/0`. Preserve both empty arrays and all historical/current lint
evidence, release the new lease, push normally, and stop for final audit.

I36 release `99fd8c33ea023e838d8ee9c993b5de52f4763e7f` is independently
audited and reconciled. MERGE is empty and corrected P31/P20/P17 sources are
integrated. Perform fresh read-only P18 admission against exact integrated P17
`7f8a41bc09c81c53a276a32bbb667aeb1f0ee69c` and fresh read-only P21
correction admission against exact integrated P20
`75137bf476b4a1773f29bb41a6a149148df2623d`. Admit only exact bounded
claim-only work after dependency, ownership, immutable-request, path, writer
lease, and zero-effect checks pass. Candidate remains null; do not inspect or
mutate providers, deploy, send, execute a migration, or perform an effect.

P18 may make only its runtime-triplet atomic claim from `b9ad9474` under READY
`ba3d425b`, claim `baeb91ef`, and EMBEDDED_CLASSROOM lease `b84e8273`.
P21 must adopt exact integration `99fd8c33` as sole claim parent and change
only its runtime triplet under READY `ede4095b`, claim `9e38d9dd`, and
CONTENT_PUBLICATION lease `afe1ac21`. Each must push normally, remote-verify,
and stop for C00 reconciliation. Do not create successor requests or edit
source before reconciliation; effects remain `0/0/0`.

P18 claim `9b10ef41d65c39bd33d673d0849f0106e13296d2` and P21 claim
`d3ee9a2ba7933663544af2bc22f6873794162986` are reconciled. Continue the two
complete substantive phases concurrently. P18 uses unchanged claim
`baeb91ef-3ce9-460c-8a6f-4c8eb40b8ff4` and rebound EMBEDDED_CLASSROOM lease
`39d6a728-0cde-43e6-9a3f-693c1b07ab4c`; create only immutable
`P18-migration-003` plus final runtime evidence and preserve all prior
product/test/request bytes. P21 uses unchanged claim
`9e38d9dd-8293-451d-9335-ddb466e7234e` and rebound CONTENT_PUBLICATION lease
`eb2c3340-baa7-493c-afc1-bcb050911bb4`; change only its exact authorized
publication source/tests, `P21-MIGRATION-002`, `P21-registration-002`, and
final runtime evidence. Both leases expire `2026-07-30T12:04:00Z`. Run focused
checks, release the leases, push, and return heads. C00 independently validates
and integrates. No provider query/mutation, send, enrollment, charge,
deployment, DNS, migration application, registration application, or effect is
authorized.

Integration release `c19c90777e0562c6fa77e30f0e0fc7ab9ba300f9` is now
reconciled. Merge exact repository-only communications head
`3364c1c31ef12a81abf02cf9f80f7e8008c1778f` under direct C00 claim
`4e5bbe12-d283-40c4-bfaa-3d6a2d0aabd5` and RELEASE_INTEGRATOR lease
`5930be35-0702-4318-b3b4-93170a2ab119`, then publish one terminal I36 runtime
release and stop for audit.

In parallel, F02 may complete one path-coherent 2250-2252 batch from exact
`6d16d6eb2c901c58cc4d0c2bb3298b5543af3d9f` under claim
`3469667a-69e2-4c35-afac-5b1dfbbf417d` and dual leases
`7f2ab8d1-a53f-41da-8143-28da4b62b200` /
`9a3469a3-87c6-45b6-824f-c3b886a01b46` through
`2026-07-30T13:34:41Z`. Create only `2250_v21_zoom_preparation.sql`,
`2251_v21_embedded_classroom.sql`, `2252_v21_content_publication.sql`, update
the allocation proposal and F02 runtime triplet, run focused migration/schema
checks, release the leases, push normally, and return the exact final.

Do not query or mutate a provider, send, enroll, charge, deploy, change DNS,
execute migrations against a live database, freeze a candidate, or perform an
external effect. Effects remain `0/0/0`.

Communications is integrated and remotely clean at
`7185d45b2dbcf157aa9e4f7cbcea02cc516ecf7d`. Supersede the preceding complete
2250-2252 instruction with this narrower wave:

1. F02 first makes native negative probes reject confirmed-preview evidence
   mutation, consumed/revoked grant reset, live-session
   generation/heartbeat/state regression, and malformed canonical digests.
   It then commits and pushes only `2250_v21_zoom_preparation.sql`,
   `2251_v21_embedded_classroom.sql`, its allocation proposal, and runtime
   triplet under existing claim `3469667a` and existing dual leases. Do not
   commit draft 2252.
2. P21 starts at exact `7185d45b` on
   `codex/v21-p21-publication-scope-correction` under claim `00402ed6`.
   Change only the publication contract, lifecycle, database repository,
   repository test, sole web receipt constructor, focused service test, and
   runtime triplet. Replace global-only P21-owned
   conflict targets with composite scope, add exact content-version/generation/
   projection binding to receipts, and add exact `contentVersionId` to resume
   contract/domain/persistence. Preserve immutable request bytes and perform
   no provider effect.
3. Independently audit and integrate both finals, then authorize migration
   2252 under a fresh exact F02 gate.

Candidate freeze, providers, live database execution, sends, enrollments,
charges, deployment, DNS, and every external effect remain withheld.

# Latest forward-only publication projection instruction

Remote control parent is
`f0ccbdc81e6962add93d0900dd159e24df7cf05f`; integration remains
`c0a1e04b8f3ffcaa65b8c6c2a1ec64edf7c1346a`. P20/P21 source implementation
`38156528` and successor-request checkpoint `a210c6cb` are pushed and
remote-equal. `P21-MIGRATION-003` canonical/raw digests are
`4c102308…` / `4ab2d70e…`; immutable migration 2252 remains
`7981b9cf…`.

Consume the exact F02 READY entry and only:

1. Verify branch `codex/v21-lane1-migration-correction` is exactly
   `39cacd4a`, then fast-forward it to exact integration `c0a1e04b`.
2. Under claim `88a902de…` and leases `7de57120…` / `e0a6dd90…`, author
   forward-only `2253_v21_content_publication_projection_v2.sql`, reconcile
   the F02 allocation proposal through 2253, update the F02 runtime triplet,
   and optionally add only the named dedicated migration test.
3. Use CREATE OR REPLACE only, preserve 2252 byte-for-byte, and prove exact
   27/8 digest parity plus all five validator calls with fresh native
   PostgreSQL accept/replay and negative probes.
4. Push one normal terminal checkpoint and stop for C00 admission. Do not
   integrate or perform any provider, deployment, DNS, send, charge, live
   migration, or candidate effect.

In parallel, independently admit already-pushed Lane B `97108442`, Lane C
`f50d95ba`, P08, and P20/P21. Keep I36 idle until the producers are admitted.

# Latest full-production completion instruction

Resume from control parent
`1b33b5d92a3cb59d64232050ffbe4eccfeb3d4ca` and integration
`c0a1e04b8f3ffcaa65b8c6c2a1ec64edf7c1346a`. Do not restart discovery,
re-merge P18/P21/communications, or repeat the F02 audit. F02 correction
`39cacd4a` is integrated at `526f0384`; the source-complete P20 head
`12980cb0` is explicitly quarantined pending its coordinated P20/P21/F02
correction.

Continue in this order:

1. Finish the disjoint P08 server/client registration seam and P20/P21/F02
   publication-seed correction; independently admit each exact remote head.
2. Run Lane B from READY `5c3f7739…`. Preserve `#090909`, `#FFD400`,
   `#67E8F9`, white, and Inter while implementing the complete landing contract.
3. When a writer slot opens, run Lane C from READY `63ac2cf7…` as read-only
   provider/GHL preflight. Reject unrelated connector resources and perform no
   effect.
4. Consume I36 READY `c010024f…` only after producer admission; apply checkpoint
   1 server/client/worker registrations and barrels, then the remaining three
   bounded shared checkpoints under fresh exact control boundaries.
5. Run one merged workspace verification, freeze one candidate, and continue
   through V37–V43, R44, deferred proof, V43 Phase B, R45, legal approval,
   cutover, and observation in the locked sequence.

Candidate freeze, provider mutation, live database migration, sends,
enrollments, charges, deployment, DNS, and customer activation remain
withheld. Legal blocks V43’s legal case, R45, customer activation, DNS cutover,
and broad release—not source correction, staging, read-only checks, or approved
operator-only canaries.

# Latest controlled-launch instruction

Use exact remote integration
`dd944eee39c314c562171c89c7350a6900ea2e6f`. P21 correction
`705030f2d5163f95340a19dc42efd0f167259869` is admitted and integrated; do
not re-audit or re-merge it. F02 `68e3c527` failed native semantic admission
and must not be merged or executed.

Before any new writer edits, state one short runtime-only table with four
exclusive lanes:

1. Lane 1 — integration, migrations, candidate, deployment, release manifests,
   and shared generated outputs.
2. Lane 2 — GHL/email readback and bounded configuration; no app or landing
   files.
3. Lane 3 — landing page, campaign content, and exact Drive asset files.
4. Lane 4 — read-only launch-critical verification; defects return to owners.

Then run the lanes concurrently. F02 receives one bounded correction covering
the eleven recorded bypasses and newly admitted 2252. Lane 2 may start exact
read-only inspection at GHL location `pBSnOK2nkdxp6gf9Rg3o`; acquire the
provider effect lock only immediately before any later mutation. Lane 3 uses
the verified Campaign v1 asset manifest and locked hero copy. Lane 4 prepares
the smallest complete critical journey set.

Legal remains a `production_broad` blocker only. No bulk send, Student contact,
WhatsApp activation, real-customer charge, live migration, deployment, DNS
change, or provider mutation may precede its exact dependency, candidate, and
effect-lock gates.
