import fs from 'node:fs';
import {createRequire} from 'node:module';
import {opencodeDbPath} from './paths.mjs';

const require = createRequire(import.meta.url);

function openSqlite() {
  // node:sqlite is available on this machine's Node 26. Requiring it lazily
  // keeps every other command usable on an older Node that lacks it.
  return require('node:sqlite').DatabaseSync;
}

/**
 * Read the OpenCode session database read-only. This never edits OpenCode or
 * Orca state; it only proves which model an actual session message used.
 */
export function verifySessionModel({
  sessionId,
  expected = {providerID: 'opencode-go', id: 'deepseek-v4.1-flash', variant: 'high'},
  dbPath = opencodeDbPath(),
} = {}) {
  if (!sessionId) {
    return {status: 'unavailable', reason: 'no session id supplied', expected, observed: []};
  }
  if (!fs.existsSync(dbPath)) {
    return {status: 'unavailable', reason: `OpenCode database not found at ${dbPath}`, expected, observed: []};
  }

  let db;
  try {
    const DatabaseSync = openSqlite();
    db = new DatabaseSync(dbPath, {readOnly: true, timeout: 2000});
    const sessionRows = db
      .prepare('SELECT 1 AS present FROM session_v2 WHERE id = ?')
      .all(sessionId);
    if (sessionRows.length === 0) {
      return {
        status: 'pending',
        reason: 'session has not been created yet',
        expected,
        observed: [],
        sessionId,
        dbPath,
      };
    }

    // Only an actual assistant message proves what model ran. User messages,
    // idle events, and session settings cannot substitute for that evidence.
    const messages = db
      .prepare(
        "SELECT data FROM session_message WHERE session_id = ? AND type = 'assistant' ORDER BY seq ASC",
      )
      .all(sessionId);
    const observed = [];
    for (const row of messages) {
      let data;
      try {
        data = JSON.parse(row.data);
      } catch {
        continue;
      }
      if (data && data.model && typeof data.model === 'object') {
        observed.push({
          providerID: data.model.providerID ?? null,
          id: data.model.id ?? null,
          variant: data.model.variant ?? null,
        });
      }
    }

    const uniqueObserved = dedupe(observed);
    if (uniqueObserved.length === 0) {
      return {
        status: 'pending',
        reason: 'session exists but no assistant message with model metadata yet',
        expected,
        observed: [],
        sessionId,
        dbPath,
      };
    }

    const matches = uniqueObserved.filter(
      model =>
        model.providerID === expected.providerID &&
        model.id === expected.id &&
        model.variant === expected.variant,
    );
    const mismatches = uniqueObserved.filter(model => !matches.includes(model));
    if (mismatches.length === 0) {
      return {
        status: 'high',
        reason: 'observed assistant-message model matches the expected principal variant',
        expected,
        observed: uniqueObserved,
        sessionId,
        dbPath,
      };
    }
    return {
      status: 'mismatch',
      reason: 'observed assistant-message model does not match the expected principal variant',
      expected,
      observed: uniqueObserved,
      sessionId,
      dbPath,
    };
  } catch (error) {
    return {
      status: 'unavailable',
      reason: `could not read OpenCode session evidence: ${error instanceof Error ? error.message : String(error)}`,
      expected,
      observed: [],
      sessionId,
      dbPath,
    };
  } finally {
    try {
      db?.close();
    } catch {
      // Read-only close is best effort.
    }
  }
}

function dedupe(models) {
  const seen = new Set();
  const result = [];
  for (const model of models) {
    const key = `${model.providerID}\0${model.id}\0${model.variant}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(model);
  }
  return result;
}
