import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {verifySessionModel} from '../lib/session-evidence.mjs';

function makeDb({sessionId = 'ses_test', messages = [], sessionModel = null} = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orca-harness-session-'));
  const file = path.join(dir, 'opencode.db');
  const db = new DatabaseSync(file);
  db.exec(`
    CREATE TABLE session_v2 (id TEXT PRIMARY KEY, model TEXT);
    CREATE TABLE session_message (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      type TEXT NOT NULL,
      seq INTEGER NOT NULL,
      data TEXT NOT NULL
    );
  `);
  if (sessionId) {
    db.prepare('INSERT INTO session_v2 (id, model) VALUES (?, ?)').run(
      sessionId,
      sessionModel ? JSON.stringify(sessionModel) : null,
    );
  }
  messages.forEach((message, index) => {
    const type = message && typeof message === 'object' && 'type' in message && 'data' in message
      ? message.type
      : 'assistant';
    const data = message && typeof message === 'object' && 'data' in message ? message.data : message;
    db.prepare('INSERT INTO session_message (id, session_id, type, seq, data) VALUES (?, ?, ?, ?, ?)').run(
      `msg_${index}`,
      sessionId,
      type,
      index,
      JSON.stringify(data),
    );
  });
  db.close();
  return file;
}

const HIGH = {providerID: 'opencode-go', id: 'deepseek-v4.1-flash', variant: 'high'};
const MAX = {providerID: 'opencode-go', id: 'deepseek-v4.1-flash', variant: 'max'};
const EXPECTED = {providerID: 'opencode-go', id: 'deepseek-v4.1-flash', variant: 'high'};

test('read-only verification proves high from actual assistant message metadata', () => {
  const dbPath = makeDb({
    messages: [
      {agent: 'build'},
      {model: HIGH, content: [{type: 'text', text: 'done'}]},
    ],
  });
  const result = verifySessionModel({sessionId: 'ses_test', expected: EXPECTED, dbPath});
  assert.equal(result.status, 'high');
  assert.deepEqual(result.observed[0], HIGH);
  assert.equal(fs.existsSync(dbPath), true);
});

test('a max assistant message is a mismatch, not a pass', () => {
  const dbPath = makeDb({messages: [{model: MAX}]});
  const result = verifySessionModel({sessionId: 'ses_test', expected: EXPECTED, dbPath});
  assert.equal(result.status, 'mismatch');
  assert.deepEqual(result.observed[0], MAX);
});

test('a session without an assistant message is pending', () => {
  const dbPath = makeDb({messages: []});
  const result = verifySessionModel({sessionId: 'ses_test', expected: EXPECTED, dbPath});
  assert.equal(result.status, 'pending');
  assert.deepEqual(result.observed, []);
});

test('a session-level model setting alone is pending, not proof', () => {
  const dbPath = makeDb({sessionModel: HIGH, messages: []});
  const result = verifySessionModel({sessionId: 'ses_test', expected: EXPECTED, dbPath});
  assert.equal(result.status, 'pending');
  assert.deepEqual(result.observed, []);
});

test('user-message model metadata is ignored', () => {
  const userOnly = makeDb({
    messages: [{type: 'user', data: {model: HIGH, text: 'pretend this is high'}}],
  });
  const pending = verifySessionModel({sessionId: 'ses_test', expected: EXPECTED, dbPath: userOnly});
  assert.equal(pending.status, 'pending');
  assert.deepEqual(pending.observed, []);

  const mixed = makeDb({
    messages: [
      {type: 'user', data: {model: MAX, text: 'stale user metadata'}},
      {type: 'assistant', data: {model: HIGH, content: [{type: 'text', text: 'done'}]}},
      {type: 'idle', data: {model: MAX}},
    ],
  });
  const high = verifySessionModel({sessionId: 'ses_test', expected: EXPECTED, dbPath: mixed});
  assert.equal(high.status, 'high');
  assert.deepEqual(high.observed, [HIGH]);
});

test('a missing session is pending and a missing database is unavailable', () => {
  const dbPath = makeDb({sessionId: null, messages: []});
  const missingSession = verifySessionModel({sessionId: 'ses_absent', expected: EXPECTED, dbPath});
  assert.equal(missingSession.status, 'pending');
  const missingDb = verifySessionModel({
    sessionId: 'ses_test',
    expected: EXPECTED,
    dbPath: path.join(os.tmpdir(), 'orca-harness-no-such.db'),
  });
  assert.equal(missingDb.status, 'unavailable');
});
