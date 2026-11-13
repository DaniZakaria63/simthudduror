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

Each response is a typed answer: a `choice` (with per-option probabilities and confidence) or a
`noul` (probability of yes). Code — not the model — owns the follow-up work; the model only supplied
the judgment.
