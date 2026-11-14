# Agent journal

Every agentic code creation or change is recorded here, including app code, tests, configuration, tooling and documentation. Use a dated Markdown file such as `YYYY-MM-DD-<task>.md`; multiple agents may use separate entries to avoid write conflicts.

Each entry records:

- Source prompt and neighboring interpretation plan; branch, worktree and relevant baseline.
- Files/areas created or changed, purpose and decisions, and any ownership handoff.
- Exact checks and observed results, including exit codes, counts/coverage when measured, failed attempts and remediation. Pending/unrun work is labeled explicitly.
- External source references and observation time, model/effort evidence and advisory decisions when relevant.
- Known limitations, remaining acceptance work, commits and delivery evidence.

Never journal credentials, keys, private environment file contents, or invented test/model/runtime results. Do not treat a source-read or plan entry as implementation acceptance. Existing historical migration evidence remains in `docs/`; new work is journaled here rather than reconstructing unsupported old run details.

The initialization principal entry is [2026-11-14-init-principal.md](2026-11-14-init-principal.md). Executor verification belongs in its own entry, and principal acceptance/delivery is recorded after review. The architecture-skills extraction entry is [2026-11-14-skills.md](2026-11-14-skills.md).
