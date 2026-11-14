# Development workflow

Source: [init.prompt.txt](plans/init.prompt.txt); interpretation: [init.plan.md](plans/init.plan.md). Agent instructions live in [AGENTS.md](../AGENTS.md).

## Native Android and iOS priorities

This is a React Native **CLI** project with real `android/` and `ios/` hosts. Shared TypeScript supports native screens and behavior. Keep native navigation/back handling, safe areas, image assets, gestures and accessibility meaningful on both platforms. No browser implementation, Expo conversion, native-host rewrite or new application feature is implied by the initialization rules.

`npm run android` runs the Android app with the configured SDK/emulator. `npm run android:build` builds its debug APK. On macOS, install the configured CocoaPods dependencies and use `npm run ios`. Use the repository's existing native projects, not a newly scaffolded template. See [README](../README.md) for setup and [architecture](ARCHITECTURE.md) for host details.

Match verification to changes. Native/build/dependency or runtime changes need relevant platform builds and device checks; documentation/lint/Jest changes need their own checks. Linux cannot compile the iOS host. Report that limit explicitly; a passing Jest test with native mocks is not a device test, and historical migration screenshots are not a new run.

## Feature ownership

| Area | Owns | May depend on |
| --- | --- | --- |
| `src/features/home` | Catalog data, card UI, Home screen | Its own internals, shared code, navigation types |
| `src/features/reader` | Reader UI, image gestures, geometry and local gesture state | Its own internals, shared code, navigation types |
| `src/shared` | Cross-feature contracts, assets, theme, genuinely shared components | Shared modules and external packages |
| `src/navigation`, `src/app` | Feature composition, routes, providers | Feature public indexes and shared infrastructure |

Each feature also owns its services (`services/`), local persistence (`local/`), state (`state/`) and UI management when those are needed. The current catalog is static and Reader receives serializable route data, so empty layers and a global state manager are unnecessary. Another feature cannot reach into that ownership through a public barrel, dynamic import or service wrapper. Pass data through props or typed navigation; place actual common functionality in shared modules.

A UI component used by more than one feature belongs in `src/shared/components`. A component used by just one feature remains there; do not promote it based on possible future use. Existing `CatalogCard` and `ZoomableImage` each have one owning feature.

`npm run lint` loads the local ESLint rule in `tools/eslint/rules`; `npm run test:rules` exercises allowed and forbidden import fixtures. The same fixtures are included in ordinary Jest tests. The current project has no source aliases: if aliases are introduced, mirror their resolved prefixes in the rule's `aliases` option as well as TypeScript/Metro, and add fixtures. Dynamic computed module paths cannot establish a statically reviewed architecture boundary; avoid them for local feature dependencies.

## Reading order in React files

Use imports first, then types/constants/module variables. Inside components, put state/hooks, derived variables and event handlers before the returned UI. Keep JSX output in the middle and `StyleSheet.create` at the bottom of the file. Helper components can follow the main screen before the styles. Keep non-React modules organized by dependencies and public purpose.

Preserve the Reader's nested transform model: translation outside scale operates in unscaled screen coordinates. General animation advice is not authorization to reorder transforms or replace the gesture stack. The [reviewed references](references/react-native.md) explain upstream guidance, project-specific requirements and applicability limits.

## Prompts, plans and worktrees

1. Read the complete source prompt and relevant current code/config/docs before designing changes. Preserve `*.prompt.txt` verbatim.
2. Write its neighboring, same-basename `*.plan.md` with interpretation, evidence, scope, decisions, requirement-to-artifact mapping and acceptance checks. Record uncertainty instead of inventing requirements. Update the plan when new source evidence changes the interpretation.
3. Use one dedicated branch/worktree for that prompt. In Orca, use supported Orca worktree commands and preserve existing user changes. Initialization uses `feat/init-foundation` at `/home/dani/orca/workspaces/simthudduror/init-foundation`, based on migrated app `06e697f`.
4. Implement the plan and journal every agentic creation/change under [.agents/journal](../.agents/journal/README.md), including failures, fixes and exact observed checks.
5. Make small scoped commits using `{feature name}: {short changes description}` (for example, `reader: cover pinch rebasing` or `foundation: document API source`). Stage exact task files; do not silently include unrelated user work.
6. Review all requirements against source and actual check results, then push the completed branch to `origin` normally. A plan, worker intention or green narrow test is not broad acceptance evidence.
7. Keep the worktree after push. Remove it **only when the human says the branch has been merged**. Do not automatically merge, delete branches or force-push.

For the team explicitly named in this prompt, use the installed opt-in harness and project role boundaries in AGENTS. Codex Sol high owns analysis/review/decisions, OpenCode Go DeepSeek Flash V4.1 high owns implementation, Antigravity owns research, and Jev supplies advisory typed judgments. Verify actual session metadata when model/effort matters. Do not alter global defaults or recursively launch another principal. Future unrelated requests do not automatically opt into orchestration.

## Tests and coverage

Install reproducible dependencies with `npm ci`, then run relevant checks:

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | TypeScript contracts and components |
| `npm run lint` | React Native lint plus feature dependency enforcement |
| `npm test -- --runInBand` | Unit/component/navigation and boundary-rule tests with coverage |
| `npm run test:ci -- --runInBand` | CI-mode test execution and the same coverage gate |
| `npm run test:coverage` | Explicit serialized coverage report |
| `npm run test:rules` | Focused import-boundary contract fixtures |
| `npm run format:check` | Formatting for source, tests, lint tooling and root configuration |

Jest collects every executable `src/**/*.{ts,tsx}` module; only ambient `.d.ts` declarations are excluded. All four global coverage metrics—statements, branches, functions and lines—must reach **81%**, enforcing the prompt's strictly-above-80% rule. Ordinary and CI runs enforce the gate. Do not lower thresholds, insert ignore directives or omit difficult files to make coverage pass.

Test meaningful behavior and failures. The Reader suite drives measured layout and captured responder callbacks on the real component and inspects its real `Animated.Value` transforms. Deterministic animation scheduling is a native-boundary test aid; it cannot prove real native-driver timing, device pinch behavior or platform performance. Screen/navigation tests continue to cover the existing catalog, route payloads, back control and error state.

## API contract extraction

Use **only** `~/WebstormProjects/maulid.id` as the endpoint source. [docs/api](api/README.md) records the dated inventory, proposed API sketches, unknown wire details, source fingerprints and re-extraction procedure. Before future integration, inspect the current provider implementation and extract every contract, with provider file/symbol references, schemas, auth and success/error behavior. Do not assume research recommendations are implemented endpoints. Keep future clients/services owned by their consuming feature; share only infrastructure actually used across features.
