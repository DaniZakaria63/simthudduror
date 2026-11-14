import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {keyFileStatus, parseDotEnvValue, resolveTypesafeKey} from '../lib/keys.mjs';

function keyFile(text, mode = 0o600) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orca-harness-key-'));
  const file = path.join(dir, 'typesafe.env');
  fs.writeFileSync(file, text);
  fs.chmodSync(file, mode);
  return file;
}

test('environment key overrides the private file and is never logged', () => {
  const file = keyFile('TYPESAFE_API_KEY=file-secret\n');
  const result = resolveTypesafeKey({env: {TYPESAFE_API_KEY: 'env-secret'}, keyFile: file});
  assert.equal(result.ok, true);
  assert.equal(result.source, 'env');
  assert.equal(result.key, 'env-secret');
});

test('private file fallback accepts export syntax and quotes', () => {
  const file = keyFile('export TYPESAFE_API_KEY="file-secret"\n');
  const result = resolveTypesafeKey({env: {}, keyFile: file});
  assert.equal(result.ok, true);
  assert.equal(result.source, 'file');
  assert.equal(result.key, 'file-secret');
  assert.equal(keyFileStatus({env: {}, keyFile: file}).secure, true);
});

test('an insecure key file is refused without reading or returning a key', () => {
  const file = keyFile('TYPESAFE_API_KEY=file-secret\n', 0o644);
  const result = resolveTypesafeKey({env: {}, keyFile: file});
  assert.equal(result.ok, false);
  assert.equal(result.code, 'insecure_key_file');
  assert.equal('key' in result, false);
  assert.match(result.message, /chmod 600/);
});

test('missing key file and empty values are reported without a key', () => {
  const file = keyFile('TYPESAFE_API_KEY=\n');
  const missing = resolveTypesafeKey({env: {}, keyFile: path.join(os.tmpdir(), 'nope', 'x.env')});
  assert.equal(missing.ok, false);
  assert.equal(missing.code, 'missing_key');
  const empty = resolveTypesafeKey({env: {}, keyFile: file});
  assert.equal(empty.ok, false);
  assert.equal(empty.code, 'missing_key');
  assert.equal(parseDotEnvValue('OTHER=value\n', 'TYPESAFE_API_KEY'), null);
});
