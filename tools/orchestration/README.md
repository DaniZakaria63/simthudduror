# Orca team harness

A small, opt-in, standard-library harness for running a reusable team in Orca:

- **OpenCode principal** — `opencode-go/deepseek-v4.1-flash#high`; the main model for systems analysis, architecture, delegation, review, and final acceptance.
- **Codex implementation** — `gpt-6.1-sol` at `low` or `high` effort, chosen by the principal per task; the only worker that edits app code.
- **Antigravity research** — any model from `agy models`; web search and analytics, no app edits.
- **Jev advisor** — typed route / research-needed / evidence / review-risk judgments; advisory only.

## Quick start

```sh
node tools/orchestration/bin/orca-team.mjs doctor
node tools/orchestration/bin/orca-team.mjs install
orca-team doctor
```

`install` copies the launcher, roles, and templates to `~/.config/orca-harness`, links
`~/.local/bin/orca-team`, and appends an opt-in managed block to the supported global
instruction files for OpenCode, Codex, and Antigravity. Existing files are backed up;
the TypeSafe key file and global model configuration are never overwritten. The
installer also removes the obsolete OpenCode implementation wrapper from an older
Codex-principal install, after backing it up.

## Commands

```sh
orca-team plan principal
orca-team plan implementation --task-file task.md --effort low
orca-team plan research --task-file research.md

orca-team principal --task-file task.md
orca-team implementation --task-file implementation-task.md --effort low|high --title "Scoped change"
orca-team research --task-file research-task.md --title "Research question"

orca-team jev --example --json
orca-team jev --state-file state.json --evidence docs/orchestration/evidence/latest.json
orca-team verify-session --session <session-id> --json

orca-team receipts list
orca-team receipts show <receipt-id>
orca-team receipts resume <receipt-id>
```

## Files

- `lib/jev.mjs` — advisory questions, strict typed validation, deterministic escalation policy, offline fallbacks.
- `lib/commands.mjs` — pure command construction, model/effort constants, anti-recursion guards.
- `lib/receipts.mjs` — durable launch receipts and recovery instructions.
- `lib/runner.mjs` — step execution without a shell and without automatic retries.
- `lib/session-evidence.mjs` — read-only proof of the actual OpenCode principal session model variant.
- `lib/opencode-principal-config.mjs` — private OpenCode config for the principal, with MCP disabled for that process only.
- `lib/install-global.mjs` — additive global install with backups.
- `test/` — offline `node:test` coverage.

## Design boundaries

- The harness is opt-in and does not coerce unrelated tasks.
- It never edits Orca SQLite, weakens permissions, or changes the user's global model defaults.
- It never treats Jev confidence as permission and never executes model-provided commands.
- Launch receipts are durable. Uncertain starts are not retried automatically; inspect the recorded query command first and never blind-retry `worker-start`.
- Failed Orca mutations preserve the error `code`, `message`, and `nextSteps` in the receipt and CLI summary. `--retry-of` is only for the latest settled dispatch of a failed or blocked task; an already-ready task is attached with plain `worker-start --task` and no retry flag.
- Orca resolution follows the skill precedence (`ORCA_CLI_COMMAND`, then `ORCA_DEV_REPO_ROOT` → `orca-dev`, then outside-managed Linux → `orca-ide`, then `orca`). It never probes for or falls through to a different binary; a selected executable failure stops the command.
- Caller identity comes from explicit session markers, not the generic `ORCA_OPENCODE_AGENT` host setting: the OpenCode principal can dispatch Codex implementation and research; a Codex implementation worker is blocked from dispatching a copy of itself; Antigravity research is blocked from dispatching a copy of itself.
- Session verification requires an actual assistant-message model. Session settings and user-message metadata are never accepted as proof.
- Input acceptance is not success: a principal receipt stays `awaiting_verification` until an assistant message proves the high variant.
- Orca does not accept launch-time model or effort selection for `opencode2`. The principal wrapper sets `OPENCODE_CONFIG_CONTENT` for its private standalone process and preserves the normal HOME/XDG credential context. MCP servers are disabled for that process only so a startup modal cannot swallow the prompt. A bounded screen readiness gate requires `DeepSeek V4.1 Flash` on `OpenCode Go` at the `high` variant and refuses to send before an auth/MCP blocker or a different selection is resolved. The actual assistant-message model is then verified read-only.
- The Codex implementation worker uses Orca's supported `worker-start --agent codex --model gpt-6.1-sol --effort low|high` path. There is no private wrapper and no OpenCode session verification for that worker.
