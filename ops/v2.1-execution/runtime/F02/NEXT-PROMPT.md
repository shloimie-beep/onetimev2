MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Audit the exact F02 Lease A canonical-format release.

Require sole parent `e669c0e85d0bdf2bc72f2f8a9ff3646c0a6a1df6`,
containing control `974985a321b71ad05d491b8c981ece5e38bed52c`, sole
acquisition `c9b0f526907d62f782ef3d44a752a9467d03e986`, claim
`7acb5991-7704-4a6f-b590-020e47824876`, and shared lease
`bf42793b-2731-43aa-8e88-c246c87d70bb`.

Require an exact four-path delta containing only the proposal and F02 runtime
triplet. Run repository Prettier through its API over the raw canonical Git
blob bytes; do not use Windows `git archive`, which converts text to CRLF.
Also run YAML parsing, package Git-byte validation, secret scan, and diff/scope gates.
Confirm native and pg-mem checksum pairs are unchanged, SQL 2235 through 2238
is byte-identical, both slots released before expiry, and effects remain
`0/0/0`. Stop for C00 admission; do not integrate or perform external effects.
