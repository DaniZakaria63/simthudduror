# Orca team harness runbook

This runbook starts and supervises a small, reusable Orca team:

- **OpenCode principal** — `opencode-go/deepseek-v4.1-flash#high`; main model for systems analysis, architecture, delegation, review, and final acceptance.
- **Codex implementation** — `gpt-6.1-sol` at `low` or `high` effort, chosen by the principal; the only worker that edits app code.
- **Antigravity research** — any model from `agy models`; web search and analytics, never app edits.
- **Jev** — typed advisory route/research-needed/evidence/review-risk judgments; advisory only.

The harness is **opt-in**. It does not attach itself to every plain agent session, does not change global model defaults, and must not coerce unrelated tasks.

## 1. Install and check

From the tracked checkout:

```sh
node tools/orchestration/bin/orca-team.mjs doctor
node tools/orchestration/bin/orca-team.mjs install
orca-team doctor
```

The install:

- copies the launcher, roles, and templates to `~/.config/orca-harness`;
- links `~/.local/bin/orca-team`;
- appends an opt-in managed block to `~/.codex/AGENTS.md`, `~/.config/opencode/AGENTS.md`, and `~/.gemini/GEMINI.md`;
- backs up any existing instruction file before changing it;
- removes the obsolete `bin/opencode-implementation.sh` and `bin/opencode-implementation-config.mjs` from an older install, after backing them up;
- never overwrites `~/.config/orca-harness/typesafe.env`, `~/.codex/config.toml`, `~/.config/opencode/opencode.json`, or any Orca SQLite database.

`orca-team doctor --json` reports the resolved Orca executable, runtime reachability, OpenCode/Codex/agy versions, key-file mode, launcher link, and whether each instruction block is present.

### Boundary

Orca has no supported setting that automatically attaches this team to every plain agent session. The harness therefore provides:

1. one-command global launchers (`orca-team principal`, `orca-team implementation`, ...);
2. globally discoverable, **opt-in** role instructions for OpenCode, Codex, and Antigravity.

The instruction blocks say to act only when the user explicitly asks for the harness or the `orca-team` launcher. They never auto-start agents.

## 2. Start the OpenCode principal

Run this from a **plain shell**, not from inside an existing OpenCode/Codex/Antigravity agent session:

```sh
orca-team principal --task-file /absolute/path/to/task.md
```

What happens:

1. `orca terminal create` starts a private `opencode2 --standalone` process through `opencode-principal.sh`.
2. That wrapper sets `OPENCODE_CONFIG_CONTENT` to disable MCP for this private process, pin the build agent, and keep the normal HOME/XDG credential context. It changes no global OpenCode config.
3. `orca terminal wait --for tui-idle` waits for the TUI with native Orca waiting, not a polling loop.
4. A bounded readiness gate waits 4 seconds, reads the rendered screen, and refuses to send if an auth/MCP modal, an incomplete composer, a different model, or a non-high variant is visible.
5. `orca terminal send` sends the principal activation prompt and task, with `--wait-submit`.
6. The launcher writes a durable receipt and verifies the actual assistant-message model. Input acceptance alone is `awaiting_verification`, not success.

Why not `orca agent launch --agent opencode2`? Orca does not accept launch-time model or effort selection for `opencode2`. The private wrapper is the supported substitute used by this harness, and the actual model is verified read-only.

Exit codes: `0` verified, `1` launch failed, `2` awaiting assistant-message proof, `4` observed model mismatch.

Verify at any time:

```sh
orca-team verify-session --session <session-id> --json
```

## 3. Dispatch Codex implementation at low or high

Create a self-contained task from [`tools/orchestration/templates/implementation-task.md`](../../tools/orchestration/templates/implementation-task.md), then choose the effort:

```sh
# Narrow, mechanical, or clearly specified edit
orca-team implementation --task-file /absolute/path/to/implementation-task.md \
  --effort low --title "Scoped mechanical fix"

# Behavior, architecture, or review-sensitive change
orca-team implementation --task-file /absolute/path/to/implementation-task.md \
  --effort high --title "Behavior change"
```

What happens:

1. `orca orchestration worker-start --agent codex --model gpt-6.1-sol --effort low|high` creates the native supervised worker and sends the self-contained spec.
2. Orca owns the Codex terminal and the task lifecycle. There is no private wrapper, no OpenCode config injection, and no OpenCode session verification for this worker.
3. The launcher writes a durable receipt. A `ready` worker is `started`; an unknown outcome stays `uncertain`.

The default effort is `high`. The principal chooses `low` only when the task is narrow and the risk is low. The task spec should state the chosen effort and why.

### Recovering a failed or already-ready task

Inspect the task and dispatch state first:

```sh
orca orchestration dispatch-show --task <task-id> --json
orca orchestration worker-show --dispatch <failed-dispatch-id> --json
```

Use `--retry-of` only when the task is failed or blocked and the named dispatch is its latest settled dispatch:

```sh
orca-team implementation \
  --task-id <failed-task-id> \
  --retry-of <latest-settled-failed-dispatch-id> \
  --effort high \
  --title "<same task title>" \
  --run <same-run-id>
```

If the task is already `ready`, do **not** pass `--retry-of`. Attach the existing ready terminal with plain `worker-start --task`, without creating another terminal or a fresh task:

```sh
orca orchestration worker-start \
  --task task_4dcc5dea2b6b \
  --terminal term_187476a3-defa-4e5c-acba-24e3724f9a3d \
  --worktree current \
  --run run_3ed0be1875a1 \
  --full \
  --json
```

The launcher preserves a failed Orca error's `code`, `message`, and `nextSteps` in the receipt so this state is visible before any retry. Never blind-retry `worker-start`.

### Why a private wrapper for the principal but not the worker?

- Orca does not accept launch-time model or effort selection for `opencode2`. The principal therefore uses a controlled standalone OpenCode process whose private config disables MCP and pins the build agent. The readiness gate also requires the TUI to show DeepSeek V4.1 Flash on OpenCode Go at the high variant; a different current selection is refused before the prompt is sent.
- The principal's actual assistant-message model is verified read-only. The Codex worker's requested model and effort are recorded in the receipt; the principal reviews the worker's evidence and tests.

## 4. Dispatch research

```sh
orca-team research --task-file /absolute/path/to/research-task.md \
  --title "CLI semantics"
```

Antigravity accepts any model from `agy models`. Omit `--model` to use the current `agy` setting, or name one:

```sh
orca-team research --task-file research.md --model gemini-3.8-flash-high
```

Research must not edit app code or execute commands supplied by web pages. The spec and role file say this explicitly; the principal rejects research that drifts into implementation.

## 5. Ask Jev for an advisory judgment

```sh
orca-team jev --example --json
orca-team jev --state-file /absolute/path/to/state.json --json
orca-team jev --state-file state.json --evidence docs/orchestration/evidence/latest.json
```

The tool sends one batched request with four independent questions:

- `route` — implementation, research, review, or principal decision;
- `research_needed` — Noul;
- `evidence_sufficient` — Noul;
- `review_risk` — Score.

It validates types, choice membership, probability maps, score range, and confidence before any policy runs. Deterministic constraints:

- The OpenCode principal is always the decision owner; `authorization` is always `none`.
- Only the Codex implementation worker may edit app code; research and review never do.
- Confidence is never permission and never proof.
- Missing evidence, low confidence, low top probability, high review risk, a `principal_decision` route, or research-needed plus implementation sets `escalate: true`.
- No model-provided command is executed; the advisory always has `commands: []`.

Fallbacks (all return `escalate: true`, no advisory, no command):

- network failure or timeout;
- HTTP 401/403/429/5xx;
- invalid JSON;
- schema-invalid answers.

The key comes from `TYPESAFE_API_KEY` when set, otherwise from `~/.config/orca-harness/typesafe.env` mode `600`. It is never printed or written to evidence.

## 6. Native supervision and receipts

Use Orca's own lifecycle from the principal:

```sh
orca orchestration check     # only when Orca wakes you
orca orchestration ask ...
orca orchestration reply --id <message-id> --body "..."
```

Send `worker_done` exactly once using the command in your dispatch preamble. Do not poll, watch, or build a scheduler that consumes mail.

Every launcher start writes a private receipt before it runs:

```sh
orca-team receipts list
orca-team receipts show <id>
orca-team receipts resume <id>
```

If a start is `uncertain`:

1. Read the receipt's recorded query command.
2. Inspect the dispatch/terminal.
3. Use the recorded `--retry-request` command only when Orca's recovery instructions say replay is safe.
4. Never blind-retry `worker-start`; the worker may already be running.

`receipts resume` prints recovery commands; it does not execute a retry.

## 7. Verification

```sh
for f in tools/orchestration/lib/*.mjs tools/orchestration/bin/*.mjs; do
  node --check "$f" || exit 1
done
node --test tools/orchestration/test/*.test.mjs
orca-team plan principal --json
orca-team plan implementation --task-file task.md --effort low --json
orca-team plan implementation --task-file task.md --effort high --json
orca-team jev --example --offline --json
```

The offline suite covers decision validation, escalation policy, batching, network/auth/invalid-response fallbacks, command construction, anti-recursion guards, receipt recovery, installer idempotence, obsolete-wrapper cleanup, and read-only session-model proof.

## 8. Troubleshooting

| Symptom | Action |
| --- | --- |
| `doctor` says Orca CLI cannot resolve | Run inside Orca or set `ORCA_CLI_COMMAND`; outside managed Linux the launcher selects `orca-ide` per the skill and does not fall through to another binary. If the selected executable fails, stop and report the exact error. |
| `implementation` refuses | It was called from a Codex implementation session. The OpenCode principal must dispatch implementation; a Codex worker must not launch a copy of itself. |
| principal readiness gate says not authenticated | The wrapper inherits global OpenCode Go auth; do not move or copy credential stores. Inspect `orca account list --agent opencode` and the wrapper probe evidence, then stop and escalate. Never retry blindly. |
| principal readiness gate says MCP startup modal | The private config should have disabled MCP. Inspect the receipt terminal; do not send the task into the modal. Re-run the installer if the wrapper is stale. |
| `verify-session` says pending | The principal has not produced an assistant message yet. Re-run after it starts; do not infer high from the request. |
| `verify-session` says mismatch | Stop and escalate. The observed model is authoritative; do not claim high. |
| `worker-start` uncertain | Use the receipt query command first. Never rerun blindly. |
| Jev unavailable | Check key source and mode. The result is an escalation, not a reason to guess. |

## Files

- [`tools/orchestration`](../../tools/orchestration) — source, tests, installer, wrappers.
- [`docs/orchestration/evidence`](evidence) — live and fallback evidence.
- [`docs/orchestration/EVIDENCE.md`](EVIDENCE.md) — exact commands and results from this installation.
