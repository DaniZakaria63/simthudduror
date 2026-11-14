# Initialization plan

Source: [init.prompt.txt](init.prompt.txt), preserved verbatim. Principal analysis: 2026-11-14.

## Interpretation and current evidence

This prompt establishes engineering conventions for a React Native CLI Android/iOS repository. It does not request new product features or a rewrite into Kotlin/Swift. Both native hosts are first-class targets; TypeScript supports their shared reader behavior. Preserve the six-item Home catalog, Reader, navigation/back/error states, and pinch/pan/double-tap gestures.

The current source has feature-isolated `home` and `reader` modules, an app/navigation composition root, and shared assets/theme/types. Services, local persistence, state and UI belong to their owning feature when required; empty layers and a global state manager add no value today. Promote a component to `src/shared/components` only when multiple features actually use it. React files use imports/types/constants and hooks/handlers first, JSX next, StyleSheet last; non-React files use a suitable dependency-first structure.

The sole provider `~/WebstormProjects/maulid.id` is under concurrent implementation. The complete dated extraction in `docs/api/inventory.json` captures all eight account/post route declarations, their request/response types, validation/auth/error behavior, and shared transport details from the 2026-11-14 07:20:31 UTC source snapshot (59 files). Source references and fingerprints distinguish implemented declarations, planning, unresolved source issues and unknown runtime wiring. This is an extraction deliverable, not continuous synchronization; re-extract against the provider before future integration.

Pre-existing uncommitted harness files in the original checkout are user work. Leave them intact and use the installed opt-in harness for this task; do not silently add those files to this branch.

## Requirements and deliverables

| Prompt requirement | Implementation / evidence |
| --- | --- |
| Read codebase first | Review app, tests, native hosts, configuration and existing docs before editing; journal observations. |
| Native Android and iOS focus | Document native-first priorities and platform verification limits; preserve hosts and current behavior. |
| Feature modules and encapsulated component/service/local/state/UI | Document ownership and enforce imports through ESLint; test the rule with valid/invalid import fixtures. |
| Shared multi-feature components | Document `src/shared/components` promotion rule; no empty scaffolding or moving feature-private components prematurely. |
| All agentic creation journaled | Add `.agents/journal` index/convention and an initialization entry with changes, commands/results, decisions, limitations and branch/worktree. |
| React file order | Record imports/variables and logic, then UI, then styles; verify existing components conform. |
| Unit coverage strictly above 80% | Collect every executable `src/**/*.{ts,tsx}` module (exclude only declaration files); thresholds 81% for statements, branches, functions, lines; meaningful gesture/UI tests, no ignoring difficult paths or mocking the subject under test. Ensure ordinary and CI test commands enforce it. |
| Sole API provider and complete contract extraction | `docs/api/README.md` plus a machine-readable inventory with provider path, exact inspected files, complete dated endpoint/type inventory, unknown auth/error/pagination/payload fields, source fingerprint, re-extraction procedure; never invent endpoints. |
| Prompt-specific branch/worktree | Dedicated `feat/init-foundation` worktree at `/home/dani/orca/workspaces/simthudduror/init-foundation`, based on the current migrated app commit `06e697f`. |
| Small commits, named `{feature}: {description}` | Commit documentation, enforcement/testing and verification separately using `foundation:` / `testing:` prefixes. Stage exact files only. |
| Push completed work | Principal reviews first, then push this branch to origin normally; no force-push. |
| Retain worktree until human confirms merge | Keep this worktree after completion; record cleanup condition. |
| Codex Sol high / OpenCode Go Deepseek Flash high / Antigravity / Jev | Current Codex principal coordinates; installed harness dispatches sole OpenCode executor with actual session-model verification; Antigravity researches references; live Jev advice informs decisions, never grants permission. Do not duplicate principal or alter global defaults. |
| Read all three RN references | Antigravity retrieves the three prompt URLs and upstream primary docs; records practical guidance and version/applicability caveats under `docs/references`. |
| Future `*.prompt.txt` → `*.plan.md` | Keep source prompts verbatim; write same-basename interpretation/analysis plan with acceptance evidence before implementation; document in AGENTS and developer guide. |

## Implementation sequence

1. Establish clean isolated worktree; preserve original dirty checkout and source prompt. Write this analysis before implementation.
2. Obtain Jev advisory and Antigravity research. Use facts over model confidence.
3. Sole OpenCode executor reads the source tree, implements repository guidance/API inventory/journal and ESLint feature encapsulation, and expands meaningful unit/component gesture coverage with strict thresholds.
4. Run `npm run typecheck`, `npm run lint`, `npm test -- --runInBand`, `npm run test:ci -- --runInBand`, `npm run format:check`, and focused architecture-rule checks. Record actual counts and all four coverage metrics. Validate documentation links and inventory against provider source.
5. Principal audits every requirement and code diff, verifies actual OpenCode model/effort, resolves any findings via the executor, records acceptance, creates remaining small scoped commits, and pushes to origin. Keep the worktree until the human confirms merge.

## Scope and verification limits

Do not introduce networking, backend implementation, a web/Expo target, a visual redesign, a new state library, speculative folders or a native-platform rewrite. No global agent/Orca database/configuration edits. No secrets in evidence. No claiming prior Android/device evidence as a new run; iOS cannot be compiled on Linux. Native compilation is only necessary if native/build/runtime behavior changes.

This plan is an acceptance checklist, not a claim that implementation has passed. Current results belong in `.agents/journal` and a separate verification record.


## Implementation and acceptance evidence

Implementation, independent review and the normal origin push are complete. The source prompt remains verbatim. [Initialization verification](../VERIFICATION-INIT-FOUNDATION.md), [principal check evidence](../evidence/init-principal-checks.json), and the [acceptance journal](../../.agents/journal/2026-11-14-init-acceptance.md) map requirements to observed results.

- Feature boundaries are enabled in normal lint and exercised by 17 valid/22 invalid fixtures, including aliases, normalized paths, re-exports, literal dynamic imports/requires and TypeScript import-equals.
- All 15 source modules are represented in coverage. Normal/CI Jest each pass 7 suites/102 tests; statements 99.58%, branches 91.86%, functions 100%, lines 99.57%, above the 81% gate. Typecheck, lint, focused rules and formatting pass.
- `src`, `android` and `ios` are unchanged from `06e697f`. Native/device builds are not claimed for this tooling/docs/test task.
- Agent/developer rules, prompt-to-plan naming and journaling are documented and committed; all requested references and model/advisory evidence are recorded.
- API documentation covers all source-declared routes and referenced data contracts in its timestamped provider snapshot; later live-provider work is outside that snapshot and requires future re-extraction. No network client or backend edit was introduced.
- Work uses `feat/init-foundation` in its dedicated worktree, with scoped `foundation:`/`testing:` commits. Retain the worktree until human merge confirmation. The branch was pushed normally to `origin` as commit `827f423`; no force-push was used.
