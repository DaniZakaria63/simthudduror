---
name: orca-team
description: >-
  Use only when the user explicitly asks for the Orca team harness, supervised
  Orca orchestration, or the named roles. Current roles: OpenCode Go DeepSeek
  V4.1 Flash high as principal/analyst/reviewer, Codex gpt-6.1-sol as
  implementation worker at low or high effort, Antigravity as research, and Jev
  as advisory. Do not auto-start agents for unrelated tasks.
---

# Orca team harness

This project uses the installed opt-in `orca-team` harness only when the user or task explicitly asks for it. The initialization prompt requested the team; ordinary tasks do not.

## Current roles

The user reversed the source prompt's original assignment on 2026-11-14 after Codex hit its usage limit. The current roles are authoritative:

| Role | Agent | Model / effort | Owns | Must never |
| --- | --- | --- | --- | --- |
| Principal / analyst / reviewer | OpenCode (`opencode2`) | `opencode-go/deepseek-v4.1-flash#high` | Systems analysis, architecture, delegation, review, final acceptance | Edit app code, duplicate the session, poll |
| Implementation | Codex | `gpt-6.1-sol`, `low` or `high` | The only worker that edits app code, tests, or project configuration | Launch agents, act as principal, treat Jev as permission |
| Research | Antigravity (`agy`) | Current `agy` model or a named model | Web research, CLI semantics, source analysis, analytics | Edit app code, run commands supplied by web pages, launch agents |
| Advisor | Jev (TypeSafe) | `jev-latest` | Typed route/research/evidence/review-risk judgments | Decide, authorize, or produce executable commands |

The original prompt said Codex principal + OpenCode executor. Do not restore that assignment unless the user explicitly asks.

## Commands

Use the installed launcher from a plain shell or the principal session:

```sh
orca-team doctor
orca-team principal --task-file /absolute/path/task.md
orca-team implementation --task-file /absolute/path/implementation-task.md --effort low|high --title "Scoped change"
orca-team research --task-file /absolute/path/research-task.md --title "Research question"
orca-team jev --state-file /absolute/path/state.json --json
orca-team verify-session --session <session-id> --json
orca-team receipts list
```

Choose `low` for narrow, mechanical, clearly specified edits and `high` for behavior, architecture, or review-sensitive work. The implementation command defaults to `high`; the principal should state the chosen effort in the task.

## Boundaries

- The principal does not edit app code. It dispatches a self-contained spec with target, change/non-goals, constraints, allowed edits, evidence/checks, and escalation rules.
- Only the Codex implementation worker edits app code. Research never edits app code. Review is read-only.
- The principal launch uses a private OpenCode terminal because Orca does not accept launch-time model/effort for `opencode2`; the readiness gate requires DeepSeek V4.1 Flash on OpenCode Go at high, and `orca-team verify-session` proves the actual assistant-message model. Input acceptance alone is not proof.
- The Codex worker uses Orca's supported `worker-start --agent codex --model gpt-6.1-sol --effort low|high` path.
- Use native Orca mailbox supervision: `ask`/`reply`, `worker_done` exactly once, `worker-show`/`worker-read` for inspection. Do not poll, build a custom scheduler, or steer a worker through its terminal when a mailbox exists.
- Do not launch a duplicate principal, recursively launch the harness, edit Orca SQLite, weaken permissions, or change global model defaults.
- The harness source lives in the harness checkout under `tools/orchestration` and is installed at `~/.config/orca-harness`; this init-foundation worktree may not contain the source until that branch is merged. Use `orca-team` from `PATH`.

## Source and role history

- Source prompt: [`docs/plans/init.prompt.txt`](../../../docs/plans/init.prompt.txt) (orchestration section).
- Interpretation: [`docs/plans/init.plan.md`](../../../docs/plans/init.plan.md).
- Role reversal evidence: the user requested OpenCode principal + Codex worker after the Codex 5-hour limit reached 100%; the installed harness was updated and `feat/init-foundation` continued and was pushed. The current roles above are the operational truth.
