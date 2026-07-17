# CI Threat Model

Risks reviewed: broad pull_request execution, secret exposure, mutable third-party actions, artifact retention, unpinned runtime, lockfile drift, fork safety, and environment protection assumptions. W13-10 did not change workflows or repository settings. Any production promotion must run from an exact SHA with protected environment controls outside this branch.
