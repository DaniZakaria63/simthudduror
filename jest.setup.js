/* eslint-env jest */
/**
 * Minimal Jest mocks shared by every suite.
 *
 * `react-native-safe-area-context` exposes its own official mock: it keeps the
 * real context/hooks but supplies deterministic zero insets, so screens that
 * call `useSafeAreaInsets` render without a device. Everything else (native
 * stack, `react-native-screens`, `Animated`, `Image.resolveAssetSource`) is
 * handled by the React Native jest preset.
 */
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);
