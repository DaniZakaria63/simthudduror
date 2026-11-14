# API provider contracts

The sole provider source is `~/WebstormProjects/maulid.id` (resolved here to `/home/dani/WebstormProjects/maulid.id`). Do not derive endpoints from another repository, a production website, or a guessed framework convention.

The source snapshot in [inventory.json](inventory.json) contains **zero implemented endpoint contracts**. At its recorded UTC observation, the provider contains eight instruction, planning, research, journal and design files. There are no handlers, routing registrations, transport schemas, application manifests or endpoint implementations. The mobile app continues to display bundled images without network calls.

## Defined plans and unknown contracts

The provider's `docs/plans/initial.plan.md`, under “Required behavior”, proposes an API prefix `/api/v1`, health endpoints and a posts/accounts/staff-validation slice. `AGENTS.md` requires server-side validated-user posting. The provider research note `docs/research/initial.sources.md` additionally proposes `GET /api/v1/posts`, `POST /api/v1/posts`, and Post/User domain field names. These are research recommendations, with no implementation, serialized field names/types, required/null rules, response shapes, status codes or authentication transport. The inventory preserves these sketches as `plannedEvidence`, separately from implemented endpoint contracts. Planning and research use inconsistent validation names (`validation_status`, `is_validated`, `IsValidated`); the wire field and vocabulary remain unresolved.

`endpointContracts: []` means no implemented endpoint contracts were found in this source snapshot. Every `wireContract` field is `null` because no wire contract defines it yet. In particular, do not assume bearer tokens, cookies, an error envelope, pagination, validation-status enum values, or a base URL. A provider contract must establish them before implementation in this app.

The inventory records the provider's Git HEAD **and each inspected file's SHA-256 and byte count**, including uncommitted documents. HEAD alone cannot fingerprint this snapshot because the provider is being developed concurrently. This is dated extraction evidence, not a claim about future provider changes or other worktrees.

## Re-extract before API work

1. Read the provider's current `AGENTS.md` and inventory all non-generated project files, including uncommitted source. Skip Git metadata, dependency/build/cache directories and private environment/credential files. Never copy credentials or private environment content into this repository.
2. Inspect current route registrations, handlers, request/response types, serialization tags, validation, authentication middleware, error handling, tests, and any OpenAPI/API documentation. Read referenced contract definitions; search results alone are not complete extraction.
3. For **every** endpoint, record method, path, base/version information, auth and permissions, params/headers/query/body fields with required/optional/null rules, constraints and enums, success/error status codes and schemas, pagination, and relevant limits when defined. Attach exact provider file/symbol references. Distinguish implemented behavior, published contracts and proposed plans. Mark genuinely undefined information unknown; do not invent it.
4. Replace the inventory with the new dated snapshot, Git revision, per-file fingerprints and extracted endpoint contracts; add endpoint-specific Markdown documentation if endpoints exist. If source documentation and handlers disagree, record and resolve the discrepancy before consuming the API.
5. Verify the snapshot against the same provider state, document results in `.agents/journal`, and make a small scoped commit. Introduce feature-owned mobile services only for an authorized integration, after the provider contract exists.

To check whether this snapshot has drifted, run from this repository root (requires Python 3 and the local provider checkout):

```sh
python3 - <<'PYCODE'
from pathlib import Path
import hashlib
import json
import subprocess

snapshot = json.loads(Path('docs/api/inventory.json').read_text())
provider = Path(snapshot['provider']['path'])
expected = {
    item['path']: (item['bytes'], item['sha256'])
    for item in snapshot['inspection']['sourceFiles']
}
ignored = {'.git', 'node_modules', 'vendor', 'build', 'dist', '.cache'}
actual = {}
for path in provider.rglob('*'):
    relative = path.relative_to(provider)
    if not path.is_file() or any(part in ignored for part in relative.parts):
        continue
    if path.name == '.env' or path.name.startswith('.env.'):
        continue
    data = path.read_bytes()
    actual[relative.as_posix()] = (len(data), hashlib.sha256(data).hexdigest())
revision = subprocess.check_output(
    ['git', '-C', str(provider), 'rev-parse', 'HEAD'], text=True,
).strip()
assert actual == expected, 'Provider files changed: inspect and re-extract contracts.'
assert revision == snapshot['provider']['gitHead'], 'Provider HEAD changed.'
print('Provider snapshot matches; zero implemented contracts at this observation.')
PYCODE
```

A drift failure requires reinspection; it is not permission to retain an empty endpoint list. Provider absence is also a failed check. This fingerprint check validates freshness only: endpoint completeness still requires reviewing the provider source.
