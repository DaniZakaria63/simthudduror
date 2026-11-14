# Harness evidence — 2026-11-14

> **Configuration note:** Sections below the role-reversal section document the original Codex-principal build. The current harness uses the OpenCode principal plus Codex implementation worker described in the role-reversal section and the updated README/RUNBOOK. Historical evidence is kept so earlier live results remain auditable.

This file records the evidence produced while building the opt-in Orca team harness. It contains no API keys or secrets.

## Role reversal — OpenCode principal + Codex worker (2026-11-14)

The Codex subscription hit `usage_limit_exceeded` while it was acting as principal. The harness was reversed without changing app behavior:

| Role | Before | After |
| --- | --- | --- |
| Principal / analyst / reviewer | Codex `gpt-6.1-sol` high | OpenCode `opencode2` / `opencode-go/deepseek-v4.1-flash#high` |
| Implementation | OpenCode `deepseek-v4.1-flash#high` | Codex `gpt-6.1-sol` at `low` or `high` |
| Research | Antigravity | Antigravity (unchanged) |
| Decision owner | Codex | OpenCode principal |

Implementation changes:

- `PRINCIPAL` now launches a private `opencode2` terminal through `opencode-principal.sh`; the wrapper supplies the private config and the readiness gate requires `DeepSeek V4.1 Flash` on `OpenCode Go` at `high`.
- `IMPLEMENTATION` now uses `worker-start --agent codex --model gpt-6.1-sol --effort low|high`; the OpenCode wrapper, session verification, and readiness gate were removed from the implementation path.
- `orca-team implementation --effort low|high` is the new principal-facing command. The default is `high`.
- `assertLaunchGuard` now allows the OpenCode principal to dispatch Codex implementation and research, while blocking a Codex implementation session from launching a copy of itself.
- Jev's `codex_decision` route and `requiresCodexDecision` field became `principal_decision` and `requiresPrincipalDecision`.
- The installer copies `bin/opencode-principal.sh` and `bin/opencode-principal-config.mjs`, and removes the obsolete OpenCode implementation wrapper after backing it up.
- Global managed blocks now describe OpenCode as principal and Codex as implementation worker.

Offline verification:

```sh
for f in tools/orchestration/lib/*.mjs tools/orchestration/bin/*.mjs; do
  node --check "$f" || exit 1
done
node --test tools/orchestration/test/*.test.mjs
```

Result: `66` tests, `66` pass, `0` fail.

Live principal wrapper probe:

- terminal `term_ed239256-5126-4966-93bf-7e104411fe43` (closed after the probe);
- session `ses_orcahroleproof1`;
- rendered screen: `Build · DeepSeek V4.1 Flash 1017 OpenCode Go · high`;
- `orca-team verify-session --session ses_orcahroleproof1 --json` returned `status: high`;
- observed assistant-message model: `opencode-go/deepseek-v4.1-flash#high`.

Full redacted evidence: [`evidence/role-reversal.json`](evidence/role-reversal.json).

The Codex terminal that hit the limit was `term_6da6501f-dd5d-42a9-a463-256dbe128694`; its pending worktree was `/home/dani/orca/workspaces/simthudduror/init-foundation` on branch `feat/init-foundation`. It was told to stop and hand off to the OpenCode session.



Implemented tracked source under `tools/orchestration`, documentation under `docs/orchestration`, project role instructions in `AGENTS.md`, and a one-line integration link in `tools/jev/README.md`. No app code was changed. No commit was made.

Changed files:

- `AGENTS.md`
- `tools/orchestration/bin/orca-team.mjs`
- `tools/orchestration/bin/opencode-implementation.sh`
- `tools/orchestration/bin/opencode-implementation-config.mjs`
- `tools/orchestration/lib/*.mjs`
- `tools/orchestration/global/AGENTS.md`
- `tools/orchestration/roles/{codex,opencode,antigravity}.md`
- `tools/orchestration/templates/{implementation-task,research-task}.md`
- `tools/orchestration/test/*.test.mjs`
- `tools/orchestration/README.md`
- `docs/orchestration/RUNBOOK.md`
- `docs/orchestration/EVIDENCE.md`
- `docs/orchestration/evidence/*.json`
- `tools/jev/README.md` (added integration link; existing requests and `run.mjs` unchanged)

Global install outside the repository: `~/.config/orca-harness`, `~/.local/bin/orca-team`, and managed opt-in blocks in `~/.codex/AGENTS.md`, `~/.config/opencode/AGENTS.md`, and `~/.gemini/GEMINI.md`.

## Syntax and offline tests

```sh
for f in tools/orchestration/lib/*.mjs tools/orchestration/bin/*.mjs tools/orchestration/test/*.mjs; do
  node --check "$f" || exit 1
done

node --test tools/orchestration/test/*.test.mjs
```

Result: `62` tests, `62` pass, `0` fail.

Coverage includes:

- typed Jev decision validation (choice membership, probability maps, score range, confidence, extra answers);
- deterministic escalation for low confidence, low top probability, missing evidence, research-needed plus implementation, high review risk, and `codex_decision`;
- one batched request with four independent questions;
- offline, network, auth, invalid-JSON, and schema-invalid fallbacks;
- no-key and private-key-file precedence (unit-level) and no key in evidence;
- principal command construction (`gpt-6.1-sol`, `high`);
- implementation command construction (private high-variant terminal, `worker-start`, no unsupported `--model`/`--effort` at worker-start);
- anti-recursion guards;
- receipt durability, recovery extraction, and no-blind-retry messaging;
- installer idempotence and backups;
- read-only verification that requires an actual assistant-message model; session settings and user-message metadata are ignored;
- reliable caller identity: generic `ORCA_OPENCODE_AGENT` alone is not caller proof, while Codex session markers take precedence and actual OpenCode workers stay blocked;
- Orca resolution precedence: `ORCA_CLI_COMMAND` > `ORCA_DEV_REPO_ROOT` (`orca-dev`) > outside-managed Linux (`orca-ide`) > `orca`, with no executable probing or fallback.
- private worker config generation disables MCP without copying headers or environment secrets;
- the OpenCode readiness gate rejects auth/MCP startup modals and incomplete composers;
- input acceptance stays `awaiting_verification` until an actual assistant message proves high, and a mismatch fails;
- failed Orca `task_not_startable` errors preserve code, message, and actionable nextSteps without inventing a retry;
- the successful supervised smoke and its exact ready-task recovery are recorded in `evidence/supervised-smoke.json`.

## Live Jev call

Command (key file fallback; environment key deliberately unset):

```sh
env -u TYPESAFE_API_KEY node tools/orchestration/bin/orca-team.mjs jev --example --json \
  --evidence docs/orchestration/evidence/jev-orchestration-routing.json
```

Observed:

| Field | Value |
| --- | --- |
| Model | `jev-1.14.0` |
| Key source | `file` (`~/.config/orca-harness/typesafe.env`, mode `600`) |
| Route | `codex_decision`, confidence `0.65`, probability `0.74` |
| Probabilities | implementation `0.14`, research `0.10`, review `0.02`, codex_decision `0.74` |
| `research_needed` | P(yes) `0.64` |
| `evidence_sufficient` | P(yes) `0.13` |
| `review_risk` | score `0.21`, confidence `0.70`, probabilities `{0: 0.8, 1: 0.2, 2: 0}` |
| Policy | `escalate: true` |
| Reasons | evidence below `0.7`; model selected `codex_decision` |
| Authorization | `none`; Codex decides |
| Commands | `[]` |

The evidence file contains the model, answers, probabilities, confidence, usage, and a state hash/excerpt. It contains no `Authorization` header, API key, or key material.

## Offline Jev fallback

```sh
orca-team jev --example --offline --json \
  --evidence docs/orchestration/evidence/jev-offline-fallback.json
```

Observed: `status: offline`, `escalate: true`, `advisory: null`, reason `offline mode requested; no network call was made`.

The test suite additionally verifies network errors, HTTP 401, invalid JSON, and schema-invalid responses all produce `escalate: true` without throwing or returning an advisory. A deterministic summary is saved at [`evidence/jev-fallbacks.json`](evidence/jev-fallbacks.json).

## Interactive wrapper smoke: failure, readiness fix, and successful supervised retry

The first supervised smoke used receipt `1794636176674-2754ef5e85edec04-implementation`, task `task_4dcc5dea2b6b`, dispatch `ctx_e3563cef0b68`, session `ses_orcahc7ef6a75a880ce8b`. `worker-start` returned `state: ready / input_accepted`, but no session was ever created; the TUI showed the high model plus a startup integration/MCP blocker, and the task prompt was never submitted.

Investigation:

- `orca account list --agent opencode` returns no managed OpenCode accounts. The normal worker and the wrapper terminal both use `HOME=/home/dani` and the same global XDG data/credential store; there is no private OpenCode profile to propagate.
- A bounded real-terminal probe was run in the actual Orca launch environment: the installed wrapper showed `Build · DeepSeek V4.1 Flash 1017 OpenCode Go · high`, accepted a harmless prompt, and produced `status: high` from the actual assistant message in session `ses_orcahgatedprobe2`. The probe terminal was closed.
- A race probe with an immediate prompt (`ses_orcahraceprobe1`) remained `pending / session has not been created yet`; the screen showed an MCP startup modal. `tui-idle` can fire before the provider/MCP startup settles, so the Enter was consumed by the modal instead of submitting the prompt.
- The wrapper does preserve global auth; the failure was startup readiness, not a missing credential profile.

Fix:

- The wrapper generates `OPENCODE_CONFIG_CONTENT` from the real global config with the build agent pinned to `opencode-go/deepseek-v4.1-flash#high` and every MCP server disabled for this private process only. No headers, environment, tokens, or other secret-bearing fields are copied.
- After `tui-idle` the launcher waits 4 seconds, reads the rendered screen, and refuses to send the task when `Connect an integration`, `MCP server failed`, `Open MCP servers`, an exited terminal, or an incomplete composer is visible.
- The launcher no longer treats input acceptance as success: pending assistant-message proof yields `awaiting_verification`, a mismatch yields `failed`, and only an actual high assistant message yields `started`.
- A real Orca-created wrapper terminal with the gated sequence produced a harmless assistant reply and `verify-session` reported `high` (`ses_orcahgatedprobe2`). Detailed redacted evidence: [`evidence/opencode-wrapper-auth.json`](evidence/opencode-wrapper-auth.json).

Recovery UX correction:

- The first recommended `--retry-of ctx_e3563cef0b68` attempt failed with `task_not_startable`: the task was already `ready`, and `--retry-of` may only name the latest settled dispatch of a failed or blocked task. The failed receipt's Orca `nextSteps` said to inspect `dispatch-show` and `worker-show` first.
- The launcher now preserves the Orca error code, message, and `nextSteps` in the receipt (`orcaError`) and CLI summary, without inventing a retry.
- The actual successful recovery attached the already-ready terminal without `--retry-of`; no duplicate terminal and no fresh task were created:

```sh
orca orchestration worker-start \
  --task task_4dcc5dea2b6b \
  --terminal term_187476a3-defa-4e5c-acba-24e3724f9a3d \
  --worktree current \
  --run run_3ed0be1875a1 \
  --full \
  --json
```

Supervised smoke result:

- Task `task_4dcc5dea2b6b`, dispatch `ctx_06c9feb81d95`, run `run_3ed0be1875a1`: `worker_done` succeeded, no files edited, correct cwd `/home/dani/StudioProjects/simthudduror`.
- Session `ses_orcahf25c69259dbbec9a`: actual assistant-message model `providerID: opencode-go`, `id: deepseek-v4.1-flash`, `variant: high`.
- `orca-team verify-session --session ses_orcahf25c69259dbbec9a --json` returned `ok: true`, `status: high`.
- Evidence: [`evidence/supervised-smoke.json`](evidence/supervised-smoke.json).

## Model and effort

See [`evidence/model-effort.json`](evidence/model-effort.json) for session ids and commands.

- **Principal:** `~/.codex/config.toml` has `model = "gpt-6.1-sol"` and `model_reasoning_effort = "high"`. `orca agent launch --help` supports `--model`/`--effort`, and `orca-team plan principal` emits `--model gpt-6.1-sol --effort high`. No second principal was launched to avoid duplicating the current coordinator.
- **Bootstrap implementation worker:** session `ses_e27846df8fferbB6QINfjim7Cq` actually observed `opencode-go/deepseek-v4.1-flash#max`. This is disclosed; it is not claimed as high.
- **Explicit high proof:** session `ses_e277f1203ffe371LU2z6IEm32X` from `opencode run --model 'opencode-go/deepseek-v4.1-flash#high'` observed `variant: high` in the actual assistant message; its session selection also records high. Verification now requires the assistant-message proof, not the setting.
- **Standalone agent config proof:** session `ses_e277e0f12ffenez2KnOzYl7fAb` from `OPENCODE_CONFIG_CONTENT` plus `--standalone --agent build` observed an assistant message at `variant: high`. This is the same private config path used by the implementation wrapper.
- **Session-id proof:** a caller-generated `ses_...` id is accepted, so the launcher can verify the exact interactive worker session with `orca-team verify-session`.
- **Supervised retry:** the original wrapper failure was fixed and the same task passed a supervised smoke (`ctx_06c9feb81d95`, session `ses_orcahf25c69259dbbec9a`) with an actual assistant-message high proof. `OPENCODE_CONFIG_CONTENT` is observable v2 behavior, not a documented public config API.

## Global install and cross-project dry run

```sh
node tools/orchestration/bin/orca-team.mjs install
cd /tmp/opencode/proj
orca-team doctor --json                     # managed Orca environment
orca-team plan principal --json
orca-team plan implementation --task-file task.md --json

# selection cases (no launch)
env -u ORCA_CLI_COMMAND -u ORCA_TERMINAL_HANDLE -u ORCA_DEV_REPO_ROOT \
  orca-team plan principal --json
env -u ORCA_CLI_COMMAND -u ORCA_TERMINAL_HANDLE \
  ORCA_DEV_REPO_ROOT=/tmp/fake-orca-repo orca-team plan principal --json
env -u ORCA_CLI_COMMAND -u ORCA_TERMINAL_HANDLE -u ORCA_DEV_REPO_ROOT \
  orca-team doctor --json
```

Observed:

- `~/.local/bin/orca-team` links to `~/.config/orca-harness/bin/orca-team.mjs`.
- `doctor --json` in the managed Orca environment returned `ok: true`; Orca runtime reachable via `ORCA_CLI_COMMAND`; `opencode2 v2.3.0`; `agy 1.5.8`; TypeSafe key file mode `600`; all three instruction blocks managed.
- The cross-project principal plan emitted `--agent codex --model gpt-6.1-sol --effort high`.
- The cross-project implementation plan emitted the private wrapper, caller-generated session id, `terminal wait --for tui-idle`, then `worker-start --terminal {terminal} --spec-file task.md`.
- Outside the managed environment the plan selected bare `orca-ide` with no shim fallback; with `ORCA_DEV_REPO_ROOT` it selected `orca-dev` even though that executable was absent. The selected `orca-ide` doctor run returned `ok: false` and did not fall through to the shim, proving selected failure stops.
- A mixed Codex-principal environment (`ORCA_OPENCODE_AGENT=opencode2` plus `CODEX_THREAD_ID`) successfully built an implementation plan; the same launcher refused an actual OpenCode worker environment (`OPENCODE=1`).
- Global instruction files were added without replacing user content: `~/.codex/AGENTS.md`, `~/.config/opencode/AGENTS.md`, `~/.gemini/GEMINI.md`.
- The harness is explicitly opt-in; no automatic adoption by unrelated sessions.

## Commands to initiate a principal without duplicating this session

Run from a plain shell, not from inside the current Codex coordinator:

```sh
orca-team principal --task-file /absolute/path/to/task.md
```

The launcher refuses when it detects an existing Codex, OpenCode, or Antigravity agent environment. The explicit underlying command is:

```sh
orca agent launch --agent codex --worktree current \
  --model gpt-6.1-sol --effort high \
  --prompt "Read ~/.config/orca-harness/AGENTS.md and ~/.config/orca-harness/roles/codex.md. You are the Codex principal." \
  --json
```

## Blockers and boundaries

- No supported mechanism attaches a supervised team to every plain Orca agent session automatically. The global launcher and opt-in instruction blocks are the boundary.
- OpenCode interactive launch cannot accept a model/effort flag through Orca. The controlled standalone config plus actual-session verification is the reliable path.
- The bootstrap worker ran at `max`, not `high`; the reusable launch path is high and verified, including a successful supervised smoke with actual assistant-message high proof.
- No app behavior, app tests, Orca SQLite, or global model defaults were changed.
