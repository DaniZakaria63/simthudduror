# Jev (TypeSafe) decision tooling

The migration architecture was chosen with the [TypeSafe](https://typesafe.ai) System One model
(Jev). These requests are reproducible and committed so the decisions are auditable.

```bash
export TYPESAFE_API_KEY="your-key"    # never commit the key
node tools/jev/run.mjs                # run every request
```

- `requests/architecture.json` — language, navigation, reader zoom, styling and native-dependency risk.
- `requests/content-and-structure.json` — content model, catalog labels, grid implementation, state
  management, testing depth, folder layout and iOS scope.
- Recorded responses: [`docs/evidence/`](../../docs/evidence) and the decision log in
  [`docs/DECISIONS.md`](../../docs/DECISIONS.md).

## Orchestration advisory integration

The reusable Orca team harness adds an advisory-only Jev integration under
[`tools/orchestration`](../orchestration). It sends one batched request for a typed
route / research-needed / evidence / review-risk judgment, validates every answer, and
never treats confidence as permission. The existing request files and `run.mjs` above are
unchanged.

```bash
node tools/orchestration/bin/orca-team.mjs jev --example --json
```

See [`docs/orchestration/RUNBOOK.md`](../../docs/orchestration/RUNBOOK.md) for the
deterministic escalation policy and the private-key fallback.

Each response is a typed answer: a `choice` (with per-option probabilities and confidence) or a
`noul` (probability of yes). Code — not the model — owns the follow-up work; the model only supplied
the judgment.
