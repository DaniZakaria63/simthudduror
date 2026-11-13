/**
 * Jest configuration for the React Native app.
 *
 * `@react-navigation/*` ships ESM-only builds (`lib/module`) and React Native
 * libraries are untranspiled TypeScript/Flow, so the preset's default
 * `transformIgnorePatterns` is widened to let babel-jest compile them.
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
};
