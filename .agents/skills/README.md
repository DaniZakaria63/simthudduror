# Project skills

These are project-local Agent Skills for `simthudduror`. Load one explicitly when its `description` matches the task; they do not replace `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, or the task's `*.plan.md`.

| Skill | Use when |
| --- | --- |
| [`project-architecture`](project-architecture/SKILL.md) | Any feature, refactor, test, API, branch, or agentic-workflow task. Encodes the architecture rules from `docs/plans/init.prompt.txt`. |
| [`orca-team`](orca-team/SKILL.md) | The user explicitly asks for the Orca team harness or supervised Orca orchestration. Encodes the current roles and commands. |

Source prompt: [`docs/plans/init.prompt.txt`](../../docs/plans/init.prompt.txt). Interpretation: [`docs/plans/init.plan.md`](../../docs/plans/init.plan.md). Journal: [`../journal/README.md`](../journal/README.md).

The source prompt's orchestration assignment was changed by the user on 2026-11-14. The current roles are in `orca-team/SKILL.md`; do not follow the source prompt's older Codex-principal assignment.
