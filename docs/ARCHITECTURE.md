# Architecture

## 1. Context

The legacy app is a single-module Android/Java project: one `MainActivity`, two fragments
(`HomeFragment`, `ReadFragment`), a `RecyclerView` adapter, a `PhotoView` dependency, and all UI
drawn from XML layouts with `ViewBinding`. It has no backend, no state store, and no tests beyond the
generated samples. The migration keeps the product behavior identical while reinitializing the code as
a modular, feature-based React Native app with Android and iOS hosts.

Design decisions and their evidence are in [DECISIONS.md](DECISIONS.md).

## 2. Module shape

```
index.js                          AppRegistry bootstrap ("Simtudduror")
└── App.tsx                       re-export of the app shell
    └── src/app/App.tsx           SafeAreaProvider + NavigationContainer + StatusBar
        └── src/navigation/AppNavigator.tsx
            ├── src/features/home        Home screen, catalog data, card component
            └── src/features/reader      Reader screen, ZoomableImage, pure zoom math
                └── src/shared/theme, src/shared/types, src/shared/assets
```

Dependency rules:

1. **Features are leaves.** A feature may import `src/shared/**` and `src/navigation/types`; it must
   not import another feature or the app shell.
2. **Navigation is the composition root.** Only `src/navigation/AppNavigator.tsx` names screens from
   both features.
3. **Shared owns cross-cutting contracts**: design tokens, domain types, the static image registry.
   It never imports a feature.
4. **No global state.** The catalog is static data; the reader gets a serialisable route param
   payload. This keeps screens independently testable and avoids a store that a two-screen app does
   not need.

## 3. Navigation contract

`src/navigation/types.ts`

```ts
type RootStackParamList = {
  Home: undefined;
  Reader: {entryId: string; title: string; imageKey: SyairImageKey};
};
```

- Every param is a primitive, so navigation state is serialisable (state restoration and deep links
  work without custom serializers).
- The reader does not look the entry up in catalog data, which keeps the features decoupled and lets
  the reader be tested with fixture params.
- `ReactNavigation.RootParamList` is augmented globally, so `useNavigation()` is typed everywhere.

The legacy app passed an Android resource id inside a `Bundle` (`bundle.putInt("IMAGE", ...)`) and
read it back with a magic default of `-1`. That pattern is replaced by a typed `imageKey`; the
reader still mirrors the legacy missing-image error ("Terjadi Error").

## 4. Home feature (`src/features/home`)

Files: `screens/HomeScreen.tsx`, `components/CatalogCard.tsx`, `data/catalog.ts`, `index.ts`.

### Layout composition

The legacy tree is `NestedScrollView > LinearLayout > [ImageView 250 dp, RecyclerView (white rounded
sheet, -50 dp top margin, 40 dp top padding, 3 columns)]`. The React Native screen keeps one scroller
(a single `FlatList`) and reproduces the sheet with three parts rendered around the grid rows:

| Part | Style | Legacy source |
| --- | --- | --- |
| Hero | `height: 250`, navy background, `Image resizeMode="contain"` | `fragment_home.xml` `ImageView` with `masjid_sophia` background + `centerInside` |
| Sheet cap | `height: 40`, `marginTop: -50`, `marginHorizontal: 5`, white, top radii 25 | `rvList` negative top margin + `paddingTop=40` + `bg_home_card` |
| Grid rows | `columnWrapperStyle`: white, `marginHorizontal: 5`, `paddingHorizontal: 10` | `rvList` background + `paddingHorizontal=10` |
| Footer | white filler with `flex: 1` | `rvList` `minHeight=530` |
| Cards | cream `#FFFAF0`, radius 24, dashed 1 dp `#A5A5A5`, `flex: 1`, gaps 5/4 | `list_item_read.xml` + `bg_item_list_read.xml` |

Consequences: the white sheet is continuous from the overlap to the bottom of the viewport, cards keep
their legacy proportions (`monogram` above `title`), and there is exactly one vertical scroller (no
nested `VirtualizedList` warning, no double-scroll).

### Data flow

```
data/catalog.ts (SyairEntry[]) ── FlatList data ──> CatalogCard
        │                                              │ onPress(entry)
        └───────────── navigation.navigate('Reader', {entryId, title, imageKey})
```

The catalog is the single source of truth. `initial` and `title` are separate fields because the
legacy list and icon arrays were independent; both are rendered verbatim today so real content can
replace only the labels without touching layout code.

## 5. Reader feature (`src/features/reader`)

Files: `screens/ReaderScreen.tsx`, `components/ZoomableImage.tsx`, `lib/zoomMath.ts`, `index.ts`.

### Why a custom zoom component

The legacy screen depends on `chrisbanes:PhotoView`. The React Native ecosystem equivalents pull in
`react-native-gesture-handler` + `reanimated` (a large native + Babel configuration surface). Jev
rated that native-dependency risk at 0.77 probability of meaningful first-build risk and preferred a
core implementation (0.87). The custom component therefore uses only React Native core `Animated`
and `PanResponder`, which keeps the native build limited to React Navigation.

### Transform model

Two nested animated views avoid the classic order-of-transform bug:

```
viewport (overflow: hidden, onLayout → width/height)
└── Animated.View        translateX / translateY   (screen pixels, unscaled)
    └── Animated.View    scale                     (about the image centre)
        └── Animated.Image resizeMode="contain"
```

Pinch and pan both start from the current *committed* values (`useRef` mirrors of the `Animated.Value`s).
`lib/zoomMath.ts` holds the pure, unit-tested math:

- `fitContain()` — displayed image size from the asset's intrinsic size (`Image.resolveAssetSource`)
  and the measured viewport, matching `resizeMode="contain"`.
- `panBounds()` — half the overflow at the current scale, never negative; the image cannot be dragged
  away from its own bounds.
- `focalTranslation()` — keeps the content point under the two fingers fixed while scaling.
- `doubleTapTarget()` — zoom in at the tap point, clamped, or toggle back to 1× / zero translation.

Gestures: one-finger pan only while zoomed; two-finger pinch clamped to 1×–5×; double-tap toggle with
spring; release always settles into valid bounds. The transform is reset when `source` changes.

### Chrome and failure state

The reader is edge-to-edge black. A translucent top bar draws the section title and a back control
(`accessibilityLabel="Kembali"`), offset by the safe-area inset. Invalid `imageKey` at runtime renders
"Terjadi Error" plus the same back control, mirroring the legacy toast instead of crashing.

## 6. Design system (`src/shared/theme/tokens.ts`)

Tokens are direct ports of the legacy resources so native and JS stay in one vocabulary:

| Token | Value | Legacy source |
| --- | --- | --- |
| `colors.navy` | `#1A2C55` | `bg_primary_dark` |
| `colors.surface` | `#FFFFFF` | `bg_primary_light` |
| `colors.cream` | `#FFFAF0` | `bg_white_cool` |
| `colors.border` | `#A5A5A5` | `bg_grey` |
| `radii.card` / `radii.sheet` | 24 / 25 | item and home drawables |
| `layout.heroHeight` / `sheetOverlap` / `gridColumns` | 250 / 50 / 3 | `fragment_home.xml`, `HomeFragment` |
| `fontFamilies.condensed` | `sans-serif-condensed` (Android) / `AvenirNextCondensed-DemiBold` (iOS) | `list_item_read.xml` |
| `fontFamilies.casual` | `casual` (Android) / `MarkerFelt-Wide` (iOS) | `list_item_read.xml` |

iOS has no `sans-serif-condensed`/`casual` system families; the iOS values are the closest bundled
equivalents so the layout keeps its character without shipping custom fonts.

## 7. Native hosts

**Android** — React Native 0.88.1, new architecture, Hermes, `applicationId id.maulid.app`,
label `Simtudduror 2021 Terbaru`, legacy launcher icons (all densities + adaptive icon) migrated,
`minSdk 24`, `targetSdk 36`, `compileSdk 37`, NDK 27.1, edge-to-edge enabled. Status bar is
transparent and light-content over the navy/black screens.

**iOS** — full React Native host (`ios/Simtudduror`), bundle id `id.maulid.app`, display name
`Simtudduror 2021 Terbaru`, new architecture flag kept. CocoaPods install and Xcode build require
macOS, so iOS is configured but not built in this environment.

## 8. Testing strategy

| Level | Scope | Tool |
| --- | --- | --- |
| Pure math | zoom helpers, bounds and focal point | Jest (`lib/zoomMath.ts` is RN-free) |
| Domain | catalog integrity, lookup helper | Jest |
| Component | card rendering, home screen, reader states | Jest + React Native Testing Library |
| Integration | navigation params from card press | Jest + mocked navigation |
| Device | launch, home, reader, zoom | Android emulator + `adb` screenshots |

Commands: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:ci`.
Verification evidence (screenshots, logs) lives in [VERIFICATION.md](VERIFICATION.md).

## 9. Performance notes

- Local bundled images, Hermes, new architecture, no network calls.
- `FlatList` virtualization + memoized rows + stable keys keep the grid cheap as content grows.
- All settle animations use the native driver; gesture moves update transforms from JS, which is
  acceptable for a single full-screen image and avoids a worklet dependency.
- The reader measures the viewport once per layout; image intrinsic size is cached by the module.

## 10. Legacy → React Native traceability

| Legacy | React Native |
| --- | --- |
| `MainActivity.java` (fragment transactions) | `src/navigation/AppNavigator.tsx` native stack |
| `BaseFragment.java` | screen-level `SafeAreaView`/layout per feature (no inheritance base needed) |
| `HomeFragment.java` | `src/features/home/screens/HomeScreen.tsx` + `data/catalog.ts` |
| `ListAdapter.java` + `list_item_read.xml` | `src/features/home/components/CatalogCard.tsx` |
| `ReadFragment.java` + `PhotoView` | `src/features/reader/screens/ReaderScreen.tsx` + `components/ZoomableImage.tsx` |
| `activity_main.xml` / `fragment_home.xml` / `fragment_read.xml` | JSX composition with `src/shared/theme/tokens.ts` |
| `colors.xml`, `strings.xml`, drawables | `src/shared/theme/tokens.ts`, `src/features/home/data/catalog.ts`, `src/shared/assets/images` |
| `bundle.putInt("IMAGE", resId)` | typed `imageKey` route param |

## 11. Known limitations / next steps

- iOS build is configured but unverified (no macOS in this environment).
- Catalog labels remain the legacy placeholders (`SATU`…`ENAM`) until real syair content is authored;
  the data module is the only file to change for that.
- The reader is intentionally image-page based, matching the legacy screen; text pages, search and
  bookmarks would be new feature modules.
- The legacy `DayNight` theme is not reproduced; the product colors are fixed (navy/cream), matching
  the screens the legacy app actually rendered.

## 12. Intentional visual differences from the legacy build

The migration is behavior-faithful, but three details were corrected because the legacy implementation
did not render as its author intended. Each is a visible, deliberate choice:

1. **Sheet fills the viewport.** The legacy `RecyclerView` had `minHeight=530dp` and the
   `NestedScrollView` child was measured as wrap-content, so on tall screens the white sheet stopped
   above the bottom and left a navy band. The React Native sheet grows to the bottom (`flexGrow`
   footer) while keeping the legacy 530dp minimum in documented form (`layout.sheetMinHeight`).
2. **Hero image is letterboxed, not stretched.** The legacy `ImageView` had no `src`; the photo was an
   Android `background` drawable, which stretches to the view bounds. The author's intent was clearly
   `centerInside` (it is written in the XML), so the RN hero uses `resizeMode="contain"` and avoids the
   legacy distortion on non-matching aspect ratios.
3. **Reader chrome.** The reader adds a translucent title/back bar for an explicit back affordance.
   Legacy relied only on the system back button; Android hardware back still works because the reader
   is a normal native-stack screen.
