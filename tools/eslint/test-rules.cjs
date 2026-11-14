#!/usr/bin/env node
'use strict';

/**
 * Runnable contract tests for `no-cross-feature-imports`.
 *
 * RuleTester executes the real rule against relative and alias-resolved
 * fixtures. `npm run test:rules` is the focused command; the same fixtures are
 * exercised by the Jest suite so ordinary `npm test` fails on a regression.
 */

const { RuleTester } = require('eslint');

const rule = require('./rules/no-cross-feature-imports');
const { valid, invalid } = require('./rule-fixtures.cjs');

const tester = new RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
});

tester.run('no-cross-feature-imports', rule, { valid, invalid });

console.log(
  `no-cross-feature-imports: ${valid.length} valid and ${invalid.length} invalid fixtures passed`,
);
