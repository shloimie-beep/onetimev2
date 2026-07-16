# OPS-02 Resume

Status: waiting_for_ot99_sha
Run ID: $runId
Packet: $packetId

## Safe Rediscovery Commands

`powershell
git -C C:\Users\User\onetimev2 fetch --all --prune --tags
git -C C:\Users\User\onetimev2 remote get-url origin
gh pr list --repo webcraft-media/onetimev2 --state all --limit 100 --json number,title,headRefName,headRefOid,baseRefName,state,isDraft,updatedAt,url,statusCheckRollup
gh issue list --repo webcraft-media/onetimev2 --state all --limit 100 --search 'OT-99 OR OT99' --json number,title,state,updatedAt,url
git -C C:\Users\User\onetimev2 for-each-ref --format='%(refname:short) %(objectname) %(committerdate:iso8601) %(subject)' refs/remotes/origin refs/tags
git -C C:\Users\User\onetimev2 grep -n -I -E 'OT-99|OT99' origin/main -- .
`

## Current Blocker

No eligible accepted OT-99 exact SHA has been recorded yet. Do not deploy, create Railway resources, mutate databases, change DNS, send messages, charge cards, create real users, or copy production data until an eligible OT-99 SHA satisfies the packet acceptance conditions.

## Next Safe Step

Run 
ode scripts/ops-02/candidate-resolver.mjs --repo . --json from this worktree after the reusable tooling exists, or rerun the GitHub commands above from any clean webcraft-media/onetimev2 checkout.
