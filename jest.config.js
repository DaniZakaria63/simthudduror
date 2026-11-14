/**
 * Jest configuration for the React Native app.
 *
 * `@react-navigation/*` ships ESM-only builds (`lib/module`) and React Native
 * libraries are untranspiled TypeScript/Flow, so the preset's default
 * `transformIgnorePatterns` is widened to let babel-jest compile them.
 *
 * Coverage always measures every executable module under `src` (only ambient
 * `.d.ts` declarations are excluded) and the global floor is stricter than the
 * project's 80% requirement. Thresholds are enforced by ordinary `npm test`
 * and `npm run test:ci` because collection is on by default.
 */
module.exports = {
  preset: '@react-native/jest-preset',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-screens|react-native-safe-area-context|use-latest-callback)/)',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/android/',
    '<rootDir>/ios/',
  ],
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
  coverageThreshold: {
    global: {
      statements: 81,
      branches: 81,
      functions: 81,
      lines: 81,
    },
  },
};
