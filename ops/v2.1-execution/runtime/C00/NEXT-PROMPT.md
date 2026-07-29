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
