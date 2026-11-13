# Decision log

Architecture decisions for the React Native migration. Decisions marked **Jev** were made with the
TypeSafe System One model; the request payloads live in [`tools/jev/requests/`](../tools/jev/requests)
and the recorded typed answers in [`docs/evidence/`](evidence). Re-run them with:

```bash
export TYPESAFE_API_KEY="..."    # key is never committed
node tools/jev/run.mjs
```

The model used was `jev-1.14.0` (`jev-latest`). Each answer is a calibrated probability distribution,
not prose; the probabilities below are the recorded evidence.

---

## ADR-001 — Branch topology for the rewrite

**Context.** `development` held the complete legacy app (`b165519`: Android Java + the "Kumpulan Syair"
docx). `master` (`2df0dc4`) was a merge of that line. The rewrite must not destroy the legacy line and
must start from a clean, up-to-date base.

**Decision.**
1. `origin/development` → renamed to `origin/dev-legacy` at the same commit; the tree diff
   `b165519..dev-legacy` is empty (no code change).
2. `development` recreated from `master` (`2df0dc4`) and force-pushed.
3. `feat/migration` created from the recreated `development` and pushed.
4. A dedicated git worktree on `feat/migration` hosts the rewrite; the main worktree was switched to
   `dev-legacy` so the legacy checkout stays physically intact.

**Consequences.** Both histories are reachable on the remote; the legacy line is never rewritten,
only renamed. The force-push of `development` is a deliberate branch re-initialization, safe because
its old head is preserved as `dev-legacy`.

---

## ADR-002 — Reinitialize with the React Native CLI

**Decision.** Replace the Gradle/Java project with a React Native 0.88.1 scaffold created by
`npx @react-native-community/cli init`, with the app label and the legacy launcher icons migrated.

**Alternatives.** Keep the legacy project and add RN as a module (rejected: the requirement is a total
reinitialization); Expo (rejected: the task explicitly asks for the React Native CLI).

**Consequences.** New architecture + Hermes are on by default. The iOS host exists and is configured;
it cannot be compiled on this Linux machine.

---

## ADR-003 — TypeScript for the app code **(Jev)**

| | |
| --- | --- |
| Answer | `typescript` — confidence 0.96, p(typescript)=0.98, p(javascript)=0.02 |
| Why | The catalog and navigation params benefit from compile-time contracts; the RN CLI template is TypeScript-first; the legacy app is tiny enough that typing costs nothing. |
| Consequence | Strict-ish TS throughout; domain types live in `src/shared/types`. JavaScript remains the runtime — RN/Metro transpiles it to native bundles as required. |

**Decision:** TypeScript (also satisfies "javascript code transcribes to native" — the RN JavaScript
runtime is what ships; TS is erased at build time).

---

## ADR-004 — React Navigation native stack **(Jev)**

| | |
| --- | --- |
| Answer | `react_navigation_native_stack` — confidence 0.92, p=0.95 (custom navigator 0.05, expo-router 0.00) |
| Native-dependency risk | 0.77 probability of meaningful first-build risk (Noul) |
| Mitigation | Only navigation-related native deps were added: `@react-navigation/native`, `native-stack`, `react-native-screens`, `safe-area-context` (the latter already in the template). No gesture/reanimated stack. |

**Consequences.** Two screens use the standard, Android-back-aware native stack; adding screens later
needs no custom routing code. The design deliberately avoids the rest of the native-dependency surface.

---

## ADR-005 — Custom zoomable reader instead of a gesture library **(Jev)**

| | |
| --- | --- |
| Answer | `core_animated_panresponder` — confidence 0.80, p=0.87 (gesture-handler+reanimated 0.13, plain image 0.00) |
| Why | Preserves the legacy PhotoView behavior (pinch/pan/double-tap) without adding two native modules and Babel configuration under a one-session build. |

**Implementation.** Nested `Animated.View`s (translate outside, scale inside), `PanResponder`, pure
math extracted to `lib/zoomMath.ts`, native-driver spring settle. See
[ARCHITECTURE.md §5](ARCHITECTURE.md#5-reader-feature-srcfeaturesreader).

**Trade-off.** Gesture processing runs on the JS thread; acceptable for one image and simpler to test.
If frames ever become a problem, the component boundary allows dropping in gesture-handler later.

---

## ADR-006 — Theme tokens + `StyleSheet` **(Jev)**

| | |
| --- | --- |
| Answer | `theme_tokens_stylesheet` — confidence 0.98, p=0.99 |
| Why | The legacy UI is small and resource-token driven (`colors.xml`, dimension values). Porting it to tokens + `StyleSheet` is the direct analogue, with zero runtime. |

---

## ADR-007 — Keep the image-page content model and legacy labels **(Jev)**

| | |
| --- | --- |
| Content model | `image_pages` — confidence 0.96, p=0.97 |
| Labels | `keep_legacy` — confidence 0.98, p=0.99 |
| Why | Migration must be behavior-faithful; content is explicitly not written yet ("tinggal konten"). Renaming or inventing sections would be a product decision, not a migration one. |

**Consequences.** The catalog is typed and centralized; swapping in real content later touches one
data file. The image registry is keyed so new pages are additive.

---

## ADR-008 — Single `FlatList` grid with legacy sheet composition **(Jev)**

| | |
| --- | --- |
| Answer | `flatlist_num_columns` — confidence 0.96, p=0.97 |
| Why | FlatList is the idiomatic virtualized grid and maps directly to the legacy `RecyclerView` + `GridLayoutManager(3)`. |

**Implementation detail.** The legacy `NestedScrollView` + `RecyclerView` pair is flattened into one
scroller: the hero and the sheet's rounded top cap become `ListHeaderComponent`, the sheet background
continues in `columnWrapperStyle`, and a footer fills the remainder. No nested `VirtualizedList`.

---

## ADR-009 — No global state manager **(Jev)**

| | |
| --- | --- |
| Answer | `none_local` — confidence 0.92, p=0.95 |
| Why | Six static entries and a single route param payload do not justify Context or Zustand. |

**Consequences.** Features stay independent, tests need no provider, and the reader is driven purely by
route params. If content becomes remote/editable, a data layer can be introduced behind the catalog
module without changing the screens' contracts.

---

## ADR-010 — Unit + smoke test depth **(Jev)**

| | |
| --- | --- |
| Answer | `unit_plus_smoke` — confidence 0.74, p=0.83 |
| Why | Confidence is lower because the app is small, but the pure zoom math and typed catalog are exactly the parts where regressions are silent; the emulator run covers visuals. |

**Consequences.** Jest + RTL suites cover catalog, zoom math, both screens and navigation; device
verification is done with emulator screenshots.

---

## ADR-011 — Feature-first folder layout **(Jev)**

| | |
| --- | --- |
| Answer | `feature_first` — confidence 1.00, p=1.00 |
| Why | The migration is explicitly requested as "modular feature-based"; grouping by feature keeps changes local as content/features grow. |

---

## ADR-012 — Keep the iOS host project **(Jev)**

| | |
| --- | --- |
| Answer | Keep `ios/` — P(yes)=0.94 |
| Why | The deliverable asks for an Android **and** iOS codebase; RN generates one host project per platform and they share all `src/` code. |

**Consequence.** iOS is configured (bundle id, display name, pods) but cannot be built/verified on
Linux. This is recorded as a limitation, not silently dropped.

---

## ADR-013 — New app identity `id.maulid.app`

**Decision.** The React Native app ships under package/bundle id **`id.maulid.app`** on both Android
(`namespace` + `applicationId`, Kotlin package `id.maulid.app`) and iOS
(`PRODUCT_BUNDLE_IDENTIFIER`). The display name stays `Simtudduror 2021 Terbaru`, the legacy launcher
icons are migrated (all densities + adaptive icon), `RootStackParamList` stays serialisable, and the
legacy error message ("Terjadi Error") is kept in the reader failure state. The untouched legacy app on
`dev-legacy` keeps its original `com.daniza.simtudduror` id.

**Why.** The product owner specified the new package id for the rewritten app; the legacy branch keeps
the historical identity for reference, so both generations can coexist during the transition.

**Consequence.** The migrated app installs as a distinct package from the legacy one, so QA must
install/launch `id.maulid.app` and old builds can live side by side.

---

## Rejected options (summary)

| Option | Reason |
| --- | --- |
| Expo / Expo Router | The task requires the React Native CLI workflow; Expo adds a different toolchain and native project ownership model. |
| React Native Gesture Handler + Reanimated | Unneeded native/Babel surface for a two-screen app; Jev preferred core (0.87) and the risk model flagged native deps (0.77). |
| NativeWind / styled-components | Added runtime/build tooling for a small fixed palette; token + StyleSheet is the direct port. |
| Global state (Zustand/Context) | No shared mutable state exists; route params + static data suffice. |
| Keep legacy Java and wrap it | Requirement is a total reinitialization; wrapping preserves the old structure instead of replacing it. |
| Rename placeholder catalog labels | Product change outside migration scope; content is explicitly the next step. |

---

## Post-implementation review (Jev)

After implementation, the same model was asked where the residual risk sits (request:
[`tools/jev/requests/post-implementation-review.json`](../tools/jev/requests/post-implementation-review.json),
response: [`docs/evidence/jev-post-implementation.json`](evidence/jev-post-implementation.json)):

| Question | Answer |
| --- | --- |
| Highest residual risk | `pinch_not_e2e_tested` (0.49) narrowly over `ios_unverified` (0.41); confidence 0.39 — a close call, recorded as such |
| Reader fidelity vs PhotoView | Score 1.13 / 3 with 88% of probability on "Low: math and gestures verified except live multi-touch" |
| Release-ready judgment | 0.48 — not a confident yes, consistent with the deferred content and unbuilt iOS host |
| Most valuable next step | `content_authoring` (0.58) over device-level E2E gesture tests (0.26) and iOS CI (0.13) |

**How this was used.** The review pass focused on the pinch/pan/double-tap wiring and bounds maths, and
[VERIFICATION.md](VERIFICATION.md) records exactly which gestures were exercised on the emulator and
why pinch could not be. The next-step ranking is recorded here rather than acted on, because content is
explicitly out of scope for the migration ("tinggal konten").
