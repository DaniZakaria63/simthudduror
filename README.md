# Simtudduror 2021 Terbaru — React Native

A feature-based React Native rewrite of the legacy native Android app. The React Native app ships as
`id.maulid.app` on both Android and iOS (the untouched legacy app keeps its original id on `dev-legacy`).
The app is a two-screen syair/maulid reader: a catalog of six sections on a navy mosque
hero screen, and a full-screen zoomable reader for each section page.

> **Migration status.** Branch `feat/migration` replaces the old Android/Java/Gradle project with a
> React Native 0.88.1 (TypeScript) codebase. The original app is preserved untouched on the
> `dev-legacy` branch — see [Branch model](#branch-model).

## Screens

| Home (`src/features/home`) | Reader (`src/features/reader`) |
| --- | --- |
| Navy `#1A2C55` screen, 250 dp mosque hero, white sheet with 25 dp top corners overlapping the hero by 50 dp, 3-column grid of cream `#FFFAF0` cards with a monogram and italic title. | Black full-screen page with pinch-zoom, pan and double-tap zoom (1×–5×), translucent top bar with the section title and a back control. |

## Tech stack

- **React Native 0.88.1** with the New Architecture and Hermes, created with the React Native CLI.
- **TypeScript** (strict) — typed catalog domain, typed navigation params, no `any` shortcuts.
- **React Navigation 7** native stack (`@react-navigation/native`, `native-stack`, `react-native-screens`, `react-native-safe-area-context`).
- **Zero extra native dependencies** beyond navigation: the zoomable reader is implemented with React Native core `Animated` + `PanResponder`.
- **Jest + React Native Testing Library** for domain, component and navigation tests.
- Android host project + iOS host project (iOS is configured but cannot be built on Linux).

Architecture, module boundaries and the legacy-to-RN mapping are documented in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). AI-assisted design decisions are recorded in
[docs/DECISIONS.md](docs/DECISIONS.md).

## Branch model

| Branch | Purpose | Head at migration start |
| --- | --- | --- |
| `master` | Stable upstream line. | `2df0dc4` |
| `development` | Active development line, recreated from `master` for the rewrite. | `2df0dc4` |
| `feat/migration` | This rewrite: React Native app. | created from `development` |
| `dev-legacy` | The original Android/Java app, preserved exactly as it was (renamed from the old `development` branch). | `b165519` |

The legacy sources are still readable from the repository:

```bash
git show dev-legacy:app/src/main/java/com/daniza/simtudduror/HomeFragment.java
git worktree add ../simtudduror-legacy dev-legacy   # optional read-only checkout
```

## Project structure

```
.
├── App.tsx                     # entry re-export of src/app/App
├── index.js                    # AppRegistry bootstrap (component name: Simtudduror)
├── src/
│   ├── app/                    # providers + navigation container (app shell)
│   ├── navigation/             # native stack + RootStackParamList contract
│   ├── features/
│   │   ├── home/               # catalog data, card component, home screen
│   │   └── reader/             # zoom math, zoomable image, reader screen
│   └── shared/
│       ├── assets/images/      # migrated legacy photos + asset registry
│       ├── theme/              # design tokens ported from colors.xml/drawables
│       └── types/              # cross-feature domain types
├── __tests__/                  # Jest + RTL suites
├── android/                    # Android host (applicationId id.maulid.app)
├── ios/                        # iOS host (bundle id id.maulid.app)
└── docs/                       # architecture + decision records + QA evidence
```

Feature rule: a feature may import `src/shared` and `src/navigation/types`, but features never
import each other. The reader receives everything it needs through route params.

## Getting started

Prerequisites: Node.js ≥ 22.11, JDK 17–21, Android SDK (platform 37, build-tools 37, NDK 27.1)
or Xcode + CocoaPods on macOS.

```bash
npm install

# Android (emulator or device)
npm start                 # Metro
npm run android           # build + install + launch

# iOS (macOS only)
cd ios && bundle install && bundle exec pod install && cd ..
npm run ios
```

### Scripts

| Script | Purpose |
| --- | --- |
| `npm start` | Start the Metro bundler. |
| `npm run android` | Build and launch the Android app (requires a running emulator/device). |
| `npm run ios` | Build and launch the iOS app (macOS only). |
| `npm run android:build` | Build the Android debug APK without installing. |
| `npm test` / `npm run test:ci` | Run Jest (CI mode in the latter). |
| `npm run lint` | ESLint (`@react-native` config). |
| `npm run typecheck` | `tsc --noEmit`. |

## Authoring content

The six catalog entries keep the legacy placeholder labels so behavior is identical to the old app.
When real syair content is ready, edit one file — `src/features/home/data/catalog.ts`:

```ts
export const catalog: SyairEntry[] = [
  {id: 'satu', initial: 'I', title: 'SATU', imageKey: 'masjid_sophia'},
  // ...
];
```

- `title` / `initial` are rendered by `CatalogCard`.
- `imageKey` points into the image registry in `src/shared/assets/images`; add a new photo there and
  extend `SyairImageKey` in `src/shared/types/catalog.ts` to use it.
- The reader is image-page based, matching the legacy PhotoView screen. Text-page rendering can be
  added later as a new feature module without touching navigation or home.

## Migration fidelity

| Legacy Android | React Native |
| --- | --- |
| `MainActivity` + `FragmentManager` back stack | React Navigation native stack (`src/navigation/AppNavigator.tsx`) |
| `HomeFragment` + `ListAdapter` + `RecyclerView` grid | `HomeScreen` + `CatalogCard` + `FlatList numColumns={3}` |
| `ReadFragment` + `PhotoView` | `ReaderScreen` + custom `ZoomableImage` (`Animated` + `PanResponder`) |
| `colors.xml` / drawables | `src/shared/theme/tokens.ts` |
| `drawable/*.jpg` | `src/shared/assets/images/*` via a typed registry |
| `strings.xml` arrays | typed `catalog` data |
| `getArguments().getInt("IMAGE")` + Bundle | serialisable `{entryId, title, imageKey}` route params |

## iOS

`ios/` is a complete React Native host project (bundle id `id.maulid.app`, display name
`Simtudduror 2021 Terbaru`). Building it requires macOS with Xcode and CocoaPods; the migration was
verified on Android because the development machine is Linux.
