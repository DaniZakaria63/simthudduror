# Implementation task template

Copy this file, fill every section, and pass it to the OpenCode principal:

```sh
orca-team implementation --task-file /absolute/path/to/implementation-task.md --effort low|high --title "Short title"
```

Choose `low` for narrow mechanical edits and `high` for behavior, architecture, or review-sensitive work.

## Target

- Project and workspace:
- Exact files or areas in scope:
- Current behavior and why it changes (or "no behavior change"):

## Change

- Required change:
- Non-goals:
- Acceptance criteria:

## Constraints

- Only the implementation worker edits app code.
- Do not touch global configuration, secrets, Orca SQLite, or unrelated files.
- Do not commit unless this task explicitly asks.
- Preserve existing user changes.

## Allowed edits

- `path/one`
- `path/two`

## Evidence

- Commands to run:
- Expected result:
- What must be captured in `worker_done`:
- Does a non-zero exit mean failure, or is capturing it the deliverable?

## Escalation

Stop and ask the coordinator if the task is ambiguous, a constraint conflicts with the code, or required evidence is missing.
