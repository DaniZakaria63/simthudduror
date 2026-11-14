# API provider contracts

The sole endpoint source is `~/WebstormProjects/maulid.id` (resolved here to `/home/dani/WebstormProjects/maulid.id`). Do not infer contracts from another project or framework convention.

[inventory.json](inventory.json) extracts **all eight account/post routes declared in the provider source snapshot captured 2026-11-14T07:20:31 UTC** (59 non-generated/non-private files). The provider is actively being implemented. Source-defined contracts, unresolved source issues and unknown deployment details are distinguished below; this is dated documentation, not continuous synchronization. The mobile reader remains offline.

## Declared account routes

| Method and path | Access/input | Success | Specific errors |
| --- | --- | --- | --- |
| `POST /api/v1/auth/register` | Public; JSON `email`, `name`, `password`; origin and per-IP register guard | 201 session response; unvalidated member created; session cookie set | 400 `invalid_input`, 409 `email_unavailable`, 403 `origin_invalid`, 429 `rate_limited` |
| `POST /api/v1/auth/login` | Public; JSON `email`, `password`; origin and per-IP login guard | 200 session response; cookie set; login counter reset | 401 `invalid_credentials`, 403 `origin_invalid`, 429 `rate_limited` |
| `POST /api/v1/auth/logout` | Valid bearer/cookie; cookie writes require CSRF; no decoded body | 204, no body; revoke credential and clear cookie | 401 `unauthenticated`, 403 `csrf_invalid`, 500 `internal_error` |
| `GET /api/v1/auth/session` | Credential resolved optionally; handler rejects anonymous | 200 session response; raw token always omitted | 401 `unauthenticated` |

Source: `internal/account/http.go`, `Handler.RegisterRoutes`, its four handlers and session helpers; middleware: `internal/platform/authn/authn.go`. No server composition root or running deployment was verified. Paths are declared by the adapter; this extraction does not claim they are already publicly reachable. No path/query parameters are read by these handlers.

## Declared post routes

| Method and path | Access/input | Success | Specific errors |
| --- | --- | --- | --- |
| `GET /api/v1/posts` | Public; optional `q` (trimmed ≤100 runes), `limit` (integer 1–100, default30) | 200 `{"posts":[Post]}`; empty array `[]` | 400 `invalid_limit`/`invalid_input`, 500 `internal_error` |
| `POST /api/v1/posts` | Authenticated validated author; JSON `body` | 201 `{"post":Post}` | 403 `validation_required`; input/JSON/auth/internal errors |
| `PUT /api/v1/posts/{id}/like` | Any authenticated account, including unvalidated; no decoded body | 200 `{"post":Post}`; idempotent membership | 404 `post_not_found`; auth/CSRF/internal errors |
| `DELETE /api/v1/posts/{id}/like` | Any authenticated account; no decoded body | 200 `{"post":Post}`; idempotent membership | 404 `post_not_found`; auth/CSRF/internal errors |

Sources: `internal/post/http.go` routes/handlers, `post.go` domain/service, `repository_sqlite.go`, `util.go`. Cookie writes require CSRF; bearer writes are exempt. Body is trimmed and must contain 10–2000 Unicode runes; controls except newline/tab are rejected. Publishing checks current trusted validation status before content validation.

`Post` always serializes `id`, `author_id`, `author_name`, `body` strings; `created_at` (Go time JSON string); `like_count` integer; `liked_by_me` boolean. No fields are nullable/omitted, and private email is absent. Feed order is creation time descending, then ID descending. Search uses literal body substrings with SQL wildcard escaping. There is no cursor/offset/total-count pagination. All per-route errors and validation order are recorded in the inventory; global router 404/405 envelopes remain undefined.

## Payloads, validation and shared behavior

- **Account view**: `id`, `email`, `name` strings; `role` is `member` or `staff`; `validation_status` is `unvalidated` or `validated`; `created_at` uses Go `time.Time` JSON string encoding. All six fields serialize without `omitempty`. Source: `internal/account/account.go`, `View` / `ToView`.
- **Session response**: `account` (view), `expires_at` (time string), optional `csrf_token` and optional `token` (strings omitted when empty). Register/login include `token` only when `X-Maulid-Client`, trimmed and compared case-insensitively, equals `mobile`. GET session never includes the raw token. Source: `account/http.go`, `sessionResponse`, `writeSession`, `wantsMobileToken`.
- **Registration**: email trimmed/lowercased, nonempty plain mailbox ≤254 bytes without whitespace; name trimmed, 2–80 Unicode runes without controls; password 10–128 bytes with no NUL. Missing/null string fields decode empty and fail registration validation. Login missing/empty credentials normally return `invalid_credentials`; there is no equivalent registration-length validation for login. Unknown JSON fields/types are rejected. Source: `account/service.go` normalizers/validator and request structs in `http.go`.
- **JSON**: register/login require `application/json` media type (parameters allowed), body limit 32768 bytes, unknown fields/trailing JSON rejected. Shared decoder errors are 400 `invalid_json`, 413 `body_too_large` on initial-decode size failure, and 415 `unsupported_media_type`. Unknown internal errors map to 500 `internal_error`. Source: `platform/httpx/httpx.go`.
- **Errors**: `{"error":{"code":"...","message":"..."}}`; both values strings. Use code for machine handling; message is human-facing Indonesian text. JSON responses set UTF-8 JSON content type, `Cache-Control: no-store`, and `X-Content-Type-Options: nosniff`. Logout success has no JSON body.
- **Auth**: `Authorization: Bearer <opaque credential>` (scheme case-insensitive) takes precedence over `maulid_session` cookie. Cookie-authenticated unsafe methods under `Require` need `X-CSRF-Token`; GET/HEAD/OPTIONS and bearer credentials are exempt. CSRF is delivered in response JSON, not a separate cookie. Anonymous/stale credentials pass `Optional` silently but the session handler itself returns 401.
- **Cookie**: `Path=/`, HttpOnly, SameSite=Lax, Secure from handler configuration; issue Max-Age is integer remaining session seconds, clear Max-Age is -1. Config defaults Secure in production and rejects disabling it there. Mobile-token requests still receive the cookie.
- **Sessions**: default seven-day TTL, configurable five minutes–30 days; current account role/status reloaded from persistence; expired/revoked credentials rejected. Service logout is idempotent, while repeated HTTP logout with a revoked credential can return 401 from middleware. Token refresh is not defined.
- **Rate/origin**: separate register/login counters per direct client IP; defaults 12 attempts per 300 seconds. Denial gives 429 plus `Retry-After = floor(remaining seconds)+1`. Missing Origin is allowed; malformed/non-HTTP origins rejected; secure mode requires HTTPS; allowed origins or matching host pass. CORS response policy is undefined. Source: account guard, `httpx.SameOrigin`, config and limiter.

The machine inventory records exact field presence, sources, per-route errors, full helper security-header policy and conditional HSTS/cache rules. Global security-header attachment and public base URL remain unknown without a composition root. SQL/internal fields and `AuthResult` are not assumed to be public JSON schemas.

## Source discrepancies and freshness

GET session constructs `View` without `CreatedAt`, so this snapshot returns Go's zero timestamp there; register/login use the actual timestamp through `ToView`. The inventory records that source issue without modifying the provider or claiming a provider test run. Approved plan/implementation enums supersede research `pending` / `rejected` examples. Cached third-party tutorial routes are not provider endpoints.

The snapshot records observation window, Git HEAD and SHA-256/bytes for every inspected file, including uncommitted source. A bounded local copy was reviewed because new source was arriving. Later live changes may fail the freshness check below and require re-extraction before API integration. Do not assume this dated extraction describes later provider work or deployed behavior.

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
ignored = set(snapshot['inspection']['excludedDirectories'])
actual = {}
for path in provider.rglob('*'):
    relative = path.relative_to(provider)
    if not path.is_file() or any(part in ignored for part in relative.parts):
        continue
    if (path.name == '.env' or path.name.startswith('.env.')
            or path.name.endswith(('.pem', '.key'))):
        continue
    data = path.read_bytes()
    actual[relative.as_posix()] = (len(data), hashlib.sha256(data).hexdigest())
revision = subprocess.check_output(
    ['git', '-C', str(provider), 'rev-parse', 'HEAD'], text=True,
).strip()
assert actual == expected, 'Provider files changed: inspect and re-extract contracts.'
assert revision == snapshot['provider']['gitHead'], 'Provider HEAD changed.'
print('Provider snapshot matches; dated contract snapshot at this observation.')
PYCODE
```

A drift failure requires reinspection; it is not permission to retain an empty endpoint list. Provider absence is also a failed check. This fingerprint check validates freshness only: endpoint completeness still requires reviewing the provider source.
