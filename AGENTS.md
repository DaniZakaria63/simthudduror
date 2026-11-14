# simthudduror — agent instructions

This repository is a React Native 0.88.1 TypeScript migration of the Simtudduror Android reader app. Preserve the existing two-screen behavior unless a task explicitly changes it.

## Orca team harness (opt-in)

A reusable, opt-in Orca team harness is tracked in [`tools/orchestration`](tools/orchestration) with the runbook in [`docs/orchestration/RUNBOOK.md`](docs/orchestration/RUNBOOK.md).

Use it only when the user explicitly asks for the Orca team harness or supervised Orca orchestration. Do not auto-launch agents for ordinary tasks.

Roles:

- **OpenCode principal** — the main model for systems analysis, architecture, delegation, review, and final acceptance. Does not edit app code; model `opencode-go/deepseek-v4.1-flash#high`.
- **Codex implementation** — the only worker that edits app code; model `gpt-6.1-sol` at `low` or `high` effort chosen by the principal.
- **Antigravity research** — web search, CLI/research semantics, analytics; never edits app code.
- **Jev** — typed advisory route/research/evidence/review judgments. Advisory only; confidence is never permission.

Native Orca mailbox rules apply: `ask` / `reply`, `worker_done` exactly once, no polling, no custom scheduler.

## Commands

```sh
node tools/orchestration/bin/orca-team.mjs doctor
node tools/orchestration/bin/orca-team.mjs plan principal
node tools/orchestration/bin/orca-team.mjs jev --example --json
node tools/orchestration/bin/orca-team.mjs verify-session --session <id> --json
```

After a one-time global install, `orca-team ...` works from any project.

## Project verification

- `npm run typecheck`
- `npm run lint`
- `npm test -- --runInBand`
- `npm run format:check`

Run only the checks relevant to a change. Do not claim a check passed without observed output.

## Boundaries

- Do not modify app behavior for tooling/documentation tasks.
- Do not commit secrets, keys, or private environment files.
- Do not edit Orca SQLite or global agent configuration as part of normal project work.
- Preserve existing user changes and unrelated branches.
