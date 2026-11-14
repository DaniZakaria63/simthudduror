module.exports = {
  root: true,
  extends: '@react-native',
  ignorePatterns: ['coverage/'],
  rules: {
    // Loaded via `eslint --rulesdir tools/eslint/rules .` (see `npm run lint`).
    // Contract tests: `npm run test:rules` and __tests__/eslintBoundaries.test.js.
    'no-cross-feature-imports': 'error',
  },
};
