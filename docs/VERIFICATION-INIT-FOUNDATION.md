# Initialization verification

Evidence for the initialization conventions added on `feat/init-foundation`,
baseline `06e697f`. Source prompt: [init.prompt.txt](plans/init.prompt.txt);
analysis: [init.plan.md](plans/init.plan.md). This record does not replace the
principal's acceptance review or the historical migration evidence in
[VERIFICATION.md](VERIFICATION.md).

## Environment

| Item | Value |
| --- | --- |
| Node.js / npm | 26.5.0 / 11.17.0 |
| OS | Linux |
| React Native | 0.88.1 (TypeScript, existing hosts unchanged) |
| Test stack | Jest 29 + React Native Testing Library 13 |
| Worktree | `/home/dani/orca/workspaces/simthudduror/init-foundation` |

`npm ci` installed 889 packages (exit 0). The pre-existing `npm audit` state is
16 vulnerabilities (10 low, 6 moderate); no dependency was added except the
already-transitive `@typescript-eslint/parser`, declared explicitly because the
boundary rule tests require it directly.

## Required checks

| Command | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0; local `no-cross-feature-imports` loaded via `--rulesdir` |
| `npm test -- --runInBand` | exit 0; **7 suites, 102 tests** |
| `npm run test:ci -- --runInBand` | exit 0; **7 suites, 102 tests** |
| `npm run test:coverage` | exit 0; **7 suites, 102 tests** |
| `npm run test:rules` | exit 0; **17 valid / 22 invalid fixtures passed** |
| `npm run format:check` | exit 0; all matched files use Prettier style |

## Coverage

Coverage collects every executable `src/**/*.{ts,tsx}` module. Only ambient
`*.d.ts` declarations are excluded. Global thresholds are 81% for all four
metrics and are enforced by ordinary `npm test` and `npm run test:ci` because
Jest collects coverage by default.

| Metric | Result | Floor |
| --- | --- | --- |
| Statements | **99.58%** | 81% |
| Branches | **91.86%** | 81% |
| Functions | **100%** | 81% |
| Lines | **99.57%** | 81% |

Baseline before the new gesture suite was 57.14% / 37.20% / 66.07% / 56.25%.

## Test inventory

| Suite | Tests | Scope |
| --- | --- | --- |
| `app.test.tsx` | 2 | real app shell mounts; Home → Reader → back |
| `catalog.test.ts` | 4 | six legacy entries, ordering, pairing, one grid |
| `homeScreen.test.tsx` | 3 | six cards, navigation params, pressed feedback |
| `readerScreen.test.tsx` | 5 | image/title/back, pressed feedback, error state and back |
| `zoomMath.test.ts` | 23 | clamp, fit, bounds, focal rebase, double-tap target |
| `zoomableImage.test.tsx` | 26 | real gesture wiring and transforms (below) |
| `eslintBoundaries.test.js` | 39 | 17 valid + 22 invalid boundary fixtures |

### Gesture coverage

`ZoomableImage` is rendered for real. Tests measure the viewport through
`onLayout`, invoke the captured `PanResponder` config, and read the component's
own `Animated.Value`s. The native spring scheduler is replaced only at the
animation boundary; the spy commits the configured `toValue` into the real
value, and tests assert `useNativeDriver: true` plus the visible transforms.

Covered paths: unmeasured no-op, pan and clamping, minimum-scale pan,
two-finger pinch around a focal point, 1×–5× scale clamps, zero pinch distance,
pinch → one-finger rebase, extra-finger rebase, three-to-two rebase, empty touch
lists, tap-versus-pan slop, double-tap timing and distance, zoom/reset, edge and
letterbox clamping, termination, viewport-shrink re-clamping, source reset and
unresolved intrinsic size.

## Feature boundary rule

`tools/eslint/rules/no-cross-feature-imports.js` resolves specifiers as paths
(relative and optional configured aliases), so it does not depend on fragile
source-text regexes. It enforces:

- a feature imports only its own internals, `src/shared`, and
  `src/navigation/types`;
- a feature never imports a sibling feature (public index included), the app
  shell, or navigation runtime;
- `src/shared` never imports features, app or navigation;
- `src/app` and `src/navigation` consume features only through `index.ts`.

Static imports, re-exports, dynamic `import()`, literal `require()` and
TypeScript import-equals are checked. A temporary probe importing a sibling
feature failed with exit 1 and the expected message, then was removed.

## API source status

The only provider is documented in [docs/api](api/README.md). At the principal's
recorded observation it contained eight instruction/planning/research files and
zero implemented endpoint contracts; proposed research endpoints and Post/User
names are recorded separately from wire contracts, with authentication,
payloads, schemas, statuses, pagination and base URLs explicitly unknown.

During final verification the provider changed while keeping the same Git HEAD
`1a4c44a`: it grew well beyond the eight fingerprinted files to include
additional journals, raw research extracts, image assets and credits, and
modified planning/research files. The drift check embedded in the API README
therefore fails; the exact file count is a moving target because the provider is
being developed concurrently. The added material contained no implemented
handler, route registration or serialized schema. The principal owns `docs/api`
and will re-extract/revalidate before acceptance. No endpoint was invented or
used by the app.

## Behavior preservation and limitations

- `git diff 06e697f -- src` is empty; no application behavior changed.
- No Android native build/emulator run was performed because no native host,
  dependency or runtime behavior changed.
- iOS is configured but cannot be compiled on Linux; it is unverified here.
- Live multi-touch delivery was not re-run on a device in this task. Jest drives
  the real handlers and transforms, but native touch dispatch remains a device
  concern.
- Principal review, acceptance and the normal push to `origin` are pending.
- Keep this worktree until the human confirms the branch is merged.

## Reproduce

```sh
cd /home/dani/orca/workspaces/simthudduror/init-foundation
npm ci
npm run typecheck
npm run lint
npm test -- --runInBand
npm run test:ci -- --runInBand
npm run test:coverage
npm run test:rules
npm run format:check
```

Implementation details and command-by-command evidence are in the
[execution journal](../.agents/journal/2026-11-14-init-implementation.md).
