# React Native Engineering & Architecture References

Accessed Date: 2026-11-14  
Research Agent: Antigravity (Research Specialist)

This reference document compiles findings, architectural patterns, and practical guidelines from requested prompt references and their upstream primary sources. It evaluates their direct applicability and constraints within the `simtudduror` mobile project—a React Native CLI 0.88.1 application targeting native Android and iOS with a two-screen reader workflow (Catalog Home and Reader).

---

## 1. Primary Sources & Exact URLs Researched

All requested URLs were retrieved and validated verbatim on 2026-11-14:

1. **Vercel Labs React Native Skills**:
   - Requested URL: [https://agenticskills.io/skills/react-native-skills](https://agenticskills.io/skills/react-native-skills) (Status: HTTP 200 OK)
   - Upstream Source: [https://github.com/vercel-labs/agent-skills/tree/main/skills/react-native-skills](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-native-skills)
2. **Callstack Agent Skills Repository**:
   - Requested URL: [https://github.com/callstackincubator/agent-skills](https://github.com/callstackincubator/agent-skills) (Status: HTTP 200 OK)
   - Upstream Reference: [https://raw.githubusercontent.com/callstackincubator/agent-skills/main/README.md](https://raw.githubusercontent.com/callstackincubator/agent-skills/main/README.md)
   - Specific Bundles: Building React Native Apps ([`skills/react-native-best-practices`](https://github.com/callstackincubator/agent-skills/tree/main/skills/react-native-best-practices), [`skills/react-navigation`](https://github.com/callstackincubator/agent-skills/tree/main/skills/react-navigation)), Testing React Native Apps ([`@testing-library/react-native`](https://github.com/callstack/react-native-testing-library)).
3. **Callstack React Native Best Practices**:
   - Requested URL: [https://agenticskills.io/skills/react-native-best-practices](https://agenticskills.io/skills/react-native-best-practices) (Status: HTTP 200 OK)
   - Upstream Source: [https://raw.githubusercontent.com/callstackincubator/agent-skills/main/skills/react-native-best-practices/SKILL.md](https://raw.githubusercontent.com/callstackincubator/agent-skills/main/skills/react-native-best-practices/SKILL.md) (Based on *The Ultimate Guide to React Native Optimization* by Callstack).
4. **TypeSafe Jev Coding Agents Reference**:
   - Requested URL: [https://docs.typesafe.ai/introduction/coding-agents.md](https://docs.typesafe.ai/introduction/coding-agents.md) (Status: HTTP 200 OK)
   - Upstream Documentation: TypeSafe System One architecture and primitive guidelines.

---

## 2. Project Requirements vs. Sourced Upstream Guidance

### 2.1 Project Architecture & Code Conventions (Local Project Requirements)
> **Note on Origin**: The following boundaries and conventions originate directly from the repository's initialization instructions (`docs/plans/init.prompt.txt`) and principal planning (`docs/plans/init.plan.md`), rather than external upstream library guides:
- **Feature Modularization & Boundaries**: The repository is modularized strictly by feature (e.g., `src/features/home`, `src/features/reader`). Each feature must encapsulate its own components, local state, services, and private UI management, closed off from other features.
- **Shared Components Promotion Rule**: Components belong to `src/shared/components` only after they are actively consumed by two or more distinct features. No speculative or preemptive promotion is allowed.
- **Structured File Layout**: React components must adhere to the prompt-mandated section order:
  1. Top: Imports, types, and module-level variables/constants.
  2. Middle: Component logic, hooks, event handlers, and UI/JSX output.
  3. Bottom: `StyleSheet.create` styles. (Other files adjust dependency-first accordingly).

### 2.2 Sourced Upstream Technical Guidance

#### Navigation (Native Stack)
- **Direct Primary Sources**:
  - [Callstack React Navigation Stack Reference](https://raw.githubusercontent.com/callstackincubator/agent-skills/main/skills/react-navigation/references/stacks.md)
  - [Vercel Labs Navigation Rule](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-native-skills/rules/navigation-native-navigators.md)
- **Observed Upstream Guidance**:
  - Prefer `@react-navigation/native-stack` over JavaScript-based stack navigators (`@react-navigation/stack`).
  - Native stack utilizes platform native navigation containers (`UINavigationController` on iOS and native `Fragment` hierarchies via `react-native-screens` on Android).
  - Use React Navigation 7 Static API or Dynamic API consistently across the app.
- **Inference & Application**:
  - Using native stack delegates view transitions and screen lifecycle to the OS platform instead of calculating layout transitions on the JavaScript thread, reducing animation jank.
  - Route parameters should remain minimal (IDs, string tokens) rather than transferring large data structures across the navigation serialisation boundary.

#### Safe Area Handling & Android Edge-to-Edge
- **Direct Primary Sources**:
  - [Callstack React Navigation Safe Areas Reference](https://raw.githubusercontent.com/callstackincubator/agent-skills/main/skills/react-navigation/references/safe-areas.md)
  - [Vercel Labs Safe Area Scroll Rule](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-native-skills/rules/ui-safe-area-scroll.md)
- **Observed Upstream Guidance**:
  - Built-in React Navigation components manage system insets automatically; custom headers, floating controls, or edge-to-edge screens require explicit insets via `react-native-safe-area-context` (`useSafeAreaInsets` / `SafeAreaView`).
  - Android 15+ (API 35+) enforces edge-to-edge drawing by default; in React Native Android projects, edge-to-edge support is configured via `android/gradle.properties` (`edgeToEdgeEnabled=true`).
- **Inference & Application**:
  - In `simtudduror`, `android/gradle.properties` contains `edgeToEdgeEnabled=true`. Screens with custom overlays (such as the Reader's top bar and floating controls) must dynamically offset using `insets.top` and `insets.bottom` to prevent overlap with status and navigation bars.

#### Animations, Gestures, Transforms & Opacity
- **Direct Primary Sources**:
  - [Vercel Labs GPU Animation Rule](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-native-skills/rules/animation-gpu-properties.md)
  - [Callstack Reanimated & UI Thread Animations Reference](https://raw.githubusercontent.com/callstackincubator/agent-skills/main/skills/react-native-best-practices/references/js-animations-reanimated.md)
- **Observed Upstream Guidance**:
  - Animate only layout-neutral properties: `transform` (scale, translate, rotate) and `opacity`.
  - Animating layout-affecting dimensions (`width`, `height`, `margin`, `padding`, `top`, `left`) forces Yoga layout recalculation on every frame.
  - Offload gestures to native drivers or UI thread worklets to prevent JavaScript thread starvation.
- **Inference & Application**:
  - Reader zoom and pan interactions avoid triggering React layout passes by applying transform manipulations.
  - Performance improvements depend on thread scheduling and native driver execution; avoid assuming guaranteed or unconditional 60+ FPS without active on-device measurement.

#### Testing & Platform Verification Boundaries
- **Direct Primary Sources**:
  - [Callstack React Native Testing Library](https://github.com/callstack/react-native-testing-library)
  - [Callstack Platform Setup & Differences Reference](https://raw.githubusercontent.com/callstackincubator/agent-skills/main/skills/react-native-best-practices/references/native-platform-setup.md)
- **Observed Upstream Guidance**:
  - "The more your tests resemble the way your software is used, the more confidence they can give you." (RNTL core principle).
  - Test from the user perspective: query by accessibility labels/roles, interact through simulated events, and avoid asserting against internal state or private component instances.
  - Native build tooling is platform-dependent: iOS builds require macOS, Xcode, CocoaPods, and Apple developer tools (`xcodebuild`); Android builds require Android SDK and Gradle (`./gradlew`).
- **Inference & Application**:
  - Jest with RNTL tests component rendering, user interactions, and navigation triggers in a Node.js simulation.
  - On Linux hosts, native compilation and device verification are restricted to Android (`./gradlew assembleDebug` or emulator runs). iOS native builds cannot be compiled on Linux; verification for iOS is limited to TypeScript, ESLint, and Jest unit tests until tested on macOS CI/agents.

---

## 3. Applicability to Installed Stack (React Native CLI 0.88.1 & Two-Screen App)

| Feature / Pattern | Project Reality (`simtudduror`) | Applicability & Actionable Practice |
|---|---|---|
| **Feature Isolation** | `src/features/home`, `src/features/reader` | Project Requirement. Enforce strict boundaries via ESLint; do not import internal feature components cross-feature. |
| **Native Stack** | `@react-navigation/native-stack` ^7.21.0, `react-native-screens` ^4.30.1 | Directly aligned with upstream. Keep screens within native stack container. |
| **Safe Areas** | `react-native-safe-area-context` ^5.5.2 | Directly aligned with upstream. Used in ReaderScreen for topBar back button padding. |
| **Nested Transform Hierarchy** | `ZoomableImage.tsx` uses nested animated views: outer translate `[{ translateX }, { translateY }]`, inner scale `[{ scale }]`. | Preserve existing transform nesting order: translate outside scale ensures translation coordinates operate on unscaled screen points without scaling distortion. Do not reorder to scale then translate. |
| **Reader & Catalog Scope** | 6 static catalog entries; Reader displays one bundled image per route via `imageKey`. | Reader loads a single bundled image asset based on route params (`masjid_sophia`, `habibal`, `sholawat`). It is not an indexed multi-chapter or multi-page reader; standard static image rendering applies. |
| **Unit Testing** | `@testing-library/react-native` ^13.3.3, `jest` ^29.6.3 | Directly aligned. Test user gestures, button taps, error states, and navigation calls to maintain >80% coverage. |

---

## 4. Caveats, Constraints & Upstream Incompatibilities

1. **Expo Recommendations**:
   - *Upstream Guidance*: Vercel Labs and Callstack skills frequently recommend Expo packages (`expo-image`, `expo-font`, Expo Router, config plugins).
   - *Project Reality*: This project is a pure **React Native CLI 0.88.1** application with explicit `android/` and `ios/` folders. Expo recommendations do **not** apply and must not introduce new Expo dependencies.
2. **Third-Party Virtualization Libraries (FlashList)**:
   - *Upstream Guidance*: Vercel Labs and Callstack prioritize `@shopify/flash-list` for list performance.
   - *Project Reality*: Home has six static catalog tiles rendered by one `FlatList` with `numColumns={3}`. Introducing FlashList adds unnecessary dependency weight without performance benefit for six items.
3. **Third-Party Animation Libraries (`react-native-reanimated`)**:
   - *Upstream Guidance*: Recommended for complex worklet animations.
   - *Project Reality*: The reader implements pinch, pan, and double-tap gestures using React Native's built-in `Animated` (with `useNativeDriver: true`) and `PanResponder`. Do not add Reanimated unless native driver limitations prevent required behavior.
4. **Supply Chain & Tooling Installation**:
   - Upstream docs describe `npx skills add ...` or running curl scripts.
   - *Project Reality*: Do not run web-supplied commands or install global agent skills.

---

## 5. Advisory Boundaries: TypeSafe Jev & Coding Agents

Per [TypeSafe Coding Agents Reference](https://docs.typesafe.ai/introduction/coding-agents.md):
- **System One Architecture**: Jev is a System One structured scoring and classification model, not an LLM or code generator. It does not generate text, write code, or execute agent actions.
- **Role in Harness**: Jev provides typed judgments (`choice`, `score`, `noul`) to inform routing or risk decisions.
- **Advisory Only**: Jev confidence is **never permission or authorization**. All code decisions, implementations, and final acceptances remain solely with the Codex principal and authorized workers.
