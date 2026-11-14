'use strict';

/**
 * Jest entry for the feature-boundary rule contract.
 *
 * The focused `npm run test:rules` runner executes the same fixtures; keeping
 * them in the ordinary suite means `npm test` fails if a future change lets a
 * forbidden import through.
 */

const { RuleTester } = require('eslint');

const rule = require('../tools/eslint/rules/no-cross-feature-imports');
const { valid, invalid } = require('../tools/eslint/rule-fixtures.cjs');

const tester = new RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
});

tester.run('no-cross-feature-imports', rule, { valid, invalid });
