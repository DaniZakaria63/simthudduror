import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {installGlobal, mergeManagedBlock} from '../lib/install-global.mjs';

const SOURCE_ROOT = path.resolve(import.meta.dirname, '..');

function tempEnv() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'orca-harness-install-'));
  return {
    root,
    env: {
      ...process.env,
      HOME: path.join(root, 'home'),
      XDG_CONFIG_HOME: path.join(root, 'config'),
      XDG_STATE_HOME: path.join(root, 'state'),
      ORCA_HARNESS_LOCAL_BIN: path.join(root, 'bin'),
    },
  };
}

test('managed block appends to existing instructions and replaces idempotently', () => {
  const target = {
    role: 'OpenCode principal',
    roleFile: 'roles/opencode.md',
  };
  const first = mergeManagedBlock('# Existing user rules\n\nKeep me.\n', target);
  assert.match(first, /Existing user rules/);
  assert.match(first, /BEGIN orca-harness/);
  assert.match(first, /OpenCode principal/);
  const second = mergeManagedBlock(first, target);
  assert.equal(second, first);
  assert.equal((second.match(/BEGIN orca-harness/g) ?? []).length, 1);
});

test('global install copies the launcher, roles, and instruction blocks with a backup', () => {
  const {root, env} = tempEnv();
  const codexFile = path.join(env.HOME, '.codex', 'AGENTS.md');
  fs.mkdirSync(path.dirname(codexFile), {recursive: true});
  fs.writeFileSync(codexFile, '# My Codex rules\n\nDo not remove.\n');
  const keyFile = path.join(env.XDG_CONFIG_HOME, 'orca-harness', 'typesafe.env');
  fs.mkdirSync(path.dirname(keyFile), {recursive: true});
  fs.writeFileSync(keyFile, 'TYPESAFE_API_KEY=do-not-touch\n');
  fs.chmodSync(keyFile, 0o600);

  const first = installGlobal({sourceRoot: SOURCE_ROOT, env});
  assert.equal(fs.existsSync(path.join(first.harnessHome, 'bin', 'orca-team.mjs')), true);
  assert.equal(fs.existsSync(path.join(first.harnessHome, 'bin', 'opencode-principal.sh')), true);
  assert.equal(fs.existsSync(path.join(first.harnessHome, 'roles', 'codex.md')), true);
  assert.equal(fs.existsSync(path.join(first.harnessHome, 'lib', 'jev.mjs')), true);
  assert.equal(fs.existsSync(first.link), true);
  assert.equal(fs.readlinkSync(first.link), path.join(first.harnessHome, 'bin', 'orca-team.mjs'));
  assert.ok(first.backups.some(backup => backup.target === codexFile));
  assert.equal(fs.readFileSync(keyFile, 'utf8'), 'TYPESAFE_API_KEY=do-not-touch\n');
  const codexText = fs.readFileSync(codexFile, 'utf8');
  assert.match(codexText, /My Codex rules/);
  assert.match(codexText, /BEGIN orca-harness/);
  assert.match(codexText, /Codex implementation worker/);

  const second = installGlobal({sourceRoot: SOURCE_ROOT, env});
  const codexSecond = fs.readFileSync(codexFile, 'utf8');
  assert.equal((codexSecond.match(/BEGIN orca-harness/g) ?? []).length, 1);
  assert.equal(second.backups.length, 0);
  assert.equal(fs.readFileSync(keyFile, 'utf8'), 'TYPESAFE_API_KEY=do-not-touch\n');
});

test('install removes the obsolete OpenCode implementation wrapper with a backup', () => {
  const {root, env} = tempEnv();
  const harnessHome = path.join(env.XDG_CONFIG_HOME, 'orca-harness');
  const obsolete = path.join(harnessHome, 'bin', 'opencode-implementation.sh');
  fs.mkdirSync(path.dirname(obsolete), {recursive: true});
  fs.writeFileSync(obsolete, '#!/bin/sh\nexit 0\n');

  const result = installGlobal({sourceRoot: SOURCE_ROOT, env});
  assert.equal(fs.existsSync(obsolete), false);
  assert.ok(result.actions.some(action => action.action === 'remove-obsolete' && action.target === obsolete));
  const backup = result.backups.find(item => item.target === obsolete);
  assert.ok(backup);
  assert.equal(fs.existsSync(backup.backup), true);
});

test('install dry-run writes nothing', () => {
  const {root, env} = tempEnv();
  const result = installGlobal({sourceRoot: SOURCE_ROOT, env, dryRun: true});
  assert.equal(result.dryRun, true);
  assert.equal(fs.existsSync(path.join(root, 'config')), false);
  assert.equal(fs.existsSync(path.join(root, 'bin')), false);
});
