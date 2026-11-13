# Verification record

Evidence for the `feat/migration` rewrite. Commands are reproducible from
`/home/dani/StudioProjects/simthudduror/.agents/worktrees/feat-migration` unless noted.

## Environment

| Item | Value |
| --- | --- |
| Node.js | 26.5.0 |
| npm | 11.17.0 |
| JDK (Android build) | 21.0.12.1 (`/usr/lib/jvm/jdk-21.0.12.1-oracle-x64`) |
| Android SDK | platforms 35–37.1, build-tools 37.0.0, NDK 27.1.12297006 |
| Emulator | Pixel_9_Pro, Android 17 (API 37), 1280×2856 @480 dpi, KVM |
| Metro | 0.87.3 on port 8081 (relay) |
| React Native | 0.88.1 (New Architecture, Hermes) |
| App package | `id.maulid.app` (Android + iOS) |

## 1. Repository topology

| Check | Result |
| --- | --- |
| `origin/dev-legacy` | `b165519` — original `development` head, **tree identical** (`50653106…` on both) |
| `origin/development` | `2df0dc4` — recreated from `master`, force-pushed |
| `origin/feat/migration` | created from `development`, holds this rewrite |
| `master` | `2df0dc4` (unchanged upstream merge) |
| Legacy code changed by rename | none (same tree hash) |

## 2. Static checks

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | exit 0 |
| `npx eslint .` | exit 0 |
| `npm run format:check` | `All matched files use Prettier code style!` (exit 0) |

## 3. Automated tests

Command: `npx jest --ci --silent` → **5 suites passed / 34 tests passed**, exit 0.

| Suite | Tests | Covers |
| --- | --- | --- |
| `__tests__/catalog.test.ts` | 4 | six entries, legacy ids/initials/titles/image order, unique ids, `CATALOG_COLUMNS` |
| `__tests__/zoomMath.test.ts` | 22 | clamp, touch distance/midpoint, contain fit (both orientations, zero sizes), pan bounds (1×/overflow/never negative/NaN), translation clamp, focal-point invariance, moving-focal rebase (constant-distance two-finger drag, zoom-with-drift), double-tap target (centre, clamp, reset) |
| `__tests__/homeScreen.test.tsx` | 2 | six cards/buttons render; pressing `catalog-card-satu` navigates with `{entryId,title,imageKey}` |
| `__tests__/readerScreen.test.tsx` | 4 | valid params render image/title/back; invalid key renders "Terjadi Error"; back calls `goBack` |
| `__tests__/app.test.tsx` | 2 | real `<App />` mounts the native stack, navigates home → reader → home |

Static gates re-run after the tests: `npx tsc --noEmit` exit 0, `npx eslint .` exit 0.

QA device evidence:

| Check | Result |
| --- | --- |
| Cold launch | `am start -W -n id.maulid.app/.MainActivity` → Status ok, **467 ms**, `Running "Simtudduror" ... "fabric":true` |
| Home → reader | tap `catalog-card-satu` → reader with `content-desc="SATU"` image, `Kembali` button, title `SATU` |
| Double tap | 2.5× zoom visibly applied (screenshot 03) |
| Pan | swipe translates the zoomed image within bounds (screenshot 04) |
| Back | `Kembali` returns to the catalog; focus remains in `id.maulid.app` |
| Logcat | 0 matches for JS errors/invariants, redbox, fatal exceptions, ANR |

## 4. Android build

| Step | Result |
| --- | --- |
| `./gradlew assembleDebug -PreactNativeArchitectures=x86_64` | `BUILD SUCCESSFUL` (first build 2 m 46 s with native deps) |
| APK | `android/app/build/outputs/apk/debug/app-debug.apk` (~48 MB) |
| `aapt2 dump badging` | `package: name='id.maulid.app'`, label `Simtudduror 2021 Terbaru`, minSdk 24, targetSdk 36 |
| Incremental rebuild after package change | `BUILD SUCCESSFUL in 10s` |
| Release build | `./gradlew assembleRelease -PreactNativeArchitectures=x86_64` → `BUILD SUCCESSFUL in 1m 34s`, `app-release.apk` 24.6 MB (Hermes bundle + assets packaged) |
| Release JS bundle | `react-native bundle --platform android --dev false` → 1.19 MB bundle, 22 copied assets, legacy photos embedded |

## 5. Emulator run

| Check | Result |
| --- | --- |
| Install | `adb install -r app-debug.apk` → Success (`id.maulid.app`) |
| Launch | `adb shell am start -n id.maulid.app/.MainActivity` → focus `id.maulid.app/id.maulid.app.MainActivity` |
| Runtime permission | Android 17 local-network prompt granted (`android.permission.ACCESS_LOCAL_NETWORK`) |
| Home screen | navy `#1A2C55`, 250 dp hero, white sheet with 25 dp top corners overlapping, 3-column cream dashed cards (I/A/B/T/G/R, SATU–ENAM) |
| Card navigation | tapping `catalog-card-satu` opens Reader with title `SATU` and the `masjid_sophia` page |
| Reader | full-screen contained image on black, back control, title chrome |
| Double-tap zoom | 2.5× centred on the tap point, content preserved under the finger |
| Pan | drag translates a zoomed image and clamps at its fitted bounds |
| Back control | returns to home |
| JS errors / red box | none in `adb logcat` |

Screenshots in `docs/screenshots/`:

| File | Content |
| --- | --- |
| `01-home.png` | Catalog: navy `#1A2C55`, mosque hero, white 25 dp sheet overlapping, six cream dashed cards |
| `02-reader.png` | Reader: full-screen page for `SATU`, black background, back + title chrome |
| `03-reader-doubletap.png` | Reader after double tap: 2.5× zoom centred on the tap |
| `04-reader-pan.png` | Reader after pan at 2.5×: translation clamped to the fitted image bounds |

### Independent review fixes

A senior read-only review was run against the branch after QA. It found one real defect in the
highest-risk path and several smaller issues; all blockers/majors were fixed and re-verified:

| Finding | Fix |
| --- | --- |
| **Blocker:** pinch rebase omitted the focal-point movement term (`t'` used only `f_now`, not `f_start`), so a constant-distance two-finger drag froze the image and zoom-with-drift moved it the wrong way | `zoomMath.focalTranslation` now takes the start *and* current focal and uses `t' = (f - C) − (s'/s0)(f0 − C − t0)`; three regression tests cover constant-distance drag, frozen-pan and zoom-with-drift (they fail against the old formula) |
| **Major:** grabbing a settling spring rebased from the spring *target* | `ZoomableImage` now mirrors `Animated.Value` via value listeners, so gestures start from the visible frame; the misleading comment was removed |
| **Major:** finger-count changes were re-baselined on start but not on end | `onPanResponderEnd` re-baselines pinch/pan when the remaining finger count changes |
| Minor: title pill swallowed gestures over the top of the page | `titleScrim` is `pointerEvents="none"` (back button still receives touches) |
| Minor: partial last grid row would stretch cards | `CatalogCard` caps at `maxWidth: 33.333%` |
| Minor: dead lookup helper, unused tokens/dependency, dead default exports | removed (`findSyairById`, `sheetMinHeight`, `heroPaddingTop`, `typography.body`, `AppColors`, `Spacing`, `@react-native/new-app-screen`, unused defaults) |
| Minor: `VERIFICATION.md` test counts/prettier claim were wrong | corrected; `npm run format:check` added and green |
| Docs: undocumented visual deviations | `ARCHITECTURE.md` §12 now lists monogram/padding/press feedback, zoom limits, iOS icon gap, release signing |

The dev server was restarted and the app re-run on the emulator after the fixes; the reader flows
(home → reader → double-tap → pan → back) still pass with no JS errors.

### Untestable in this environment

- **Pinch gesture end-to-end.** Multi-finger injection is unavailable from this shell: the emulator
  is a production build (`adb root` refused), `/dev/input` is SELinux-blocked for the shell user, and
  `adb shell input` has no multi-pointer API. The two-finger path is covered by the corrected math and
  its regression tests, and was exercised by the reviewer line by line; a human can confirm it on the
  running emulator (two-finger pinch/pan on a reader page).
- **iOS build.** Requires macOS/Xcode/CocoaPods. The iOS host is configured (bundle id
  `id.maulid.app`, display name, new architecture) but not compiled here.

## 6. Reproduce

```bash
cd /home/dani/StudioProjects/simthudduror/.agents/worktrees/feat-migration
npm install
npm run typecheck && npm run lint && npm test
export JAVA_HOME=/usr/lib/jvm/jdk-21.0.12.1-oracle-x64 ANDROID_HOME="$HOME/Android/Sdk"
npm start                         # Metro (separate terminal)
npm run android                   # build + install + launch on the emulator
```
