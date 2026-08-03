# Candidate-bound results

I36 creates `results/<canonical-candidate-digest>/CANDIDATE-RESULT-INDEX.yaml`
from the locked template on the evidence branch. Verification lanes write only
their assigned
`<lane>/<case-id>/attempt-<n>.yaml` paths plus per-case `CURRENT.yaml`. Attempts
are immutable and supersede by digest; they never overwrite. The normative
acceptance contract is never edited for status.
