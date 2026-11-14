import assert from 'node:assert/strict';
import test from 'node:test';
import {inspectOpenCodeReady} from '../lib/runner.mjs';

function screen(lines, status = 'running') {
  return {
    ok: true,
    unwrapped: {
      terminal: {
        status,
        tail: lines,
      },
    },
  };
}

test('ready OpenCode composer passes the readiness gate', () => {
  const result = inspectOpenCodeReady(
    screen([
      '  Ask anything… "Fix a TODO in the codebase"',
      '  Build · DeepSeek V4.1 Flash 1017 OpenCode Go · high',
      '  shift+tab agents  ctrl+p commands',
    ]),
  );
  assert.equal(result.ok, true);
});

test('a non-high variant blocks dispatch before the prompt is sent', () => {
  const result = inspectOpenCodeReady(
    screen([
      '  Ask anything… "Fix a TODO in the codebase"',
      '  Build · DeepSeek V4.1 Flash 1017 OpenCode Go · max',
      '  shift+tab agents  ctrl+p commands',
    ]),
  );
  assert.equal(result.ok, false);
  assert.match(result.reason, /high variant/);
});

test('a different model blocks dispatch before the prompt is sent', () => {
  const result = inspectOpenCodeReady(
    screen([
      '  Ask anything… "Fix a TODO in the codebase"',
      '  Build · Qwen3.8 Max OpenCode Go · high',
      '  shift+tab agents  ctrl+p commands',
    ]),
  );
  assert.equal(result.ok, false);
  assert.match(result.reason, /DeepSeek V4\.1 Flash/);
});

test('an auth integration prompt blocks dispatch', () => {
  const result = inspectOpenCodeReady(
    screen([
      '  Connect an integration to send prompts',
      '  Build · DeepSeek V4.1 Flash 1017 OpenCode Go · high',
    ]),
  );
  assert.equal(result.ok, false);
  assert.match(result.reason, /not authenticated/);
});

test('an MCP startup modal blocks dispatch', () => {
  const result = inspectOpenCodeReady(
    screen([
      '  MCP server failed: supabase  › Open MCP servers',
      '  Build · DeepSeek V4.1 Flash 1017 OpenCode Go · high',
      '  Ask anything…',
    ]),
  );
  assert.equal(result.ok, false);
  assert.match(result.reason, /MCP startup modal/);
});

test('an empty, exited, or incomplete screen blocks dispatch', () => {
  assert.equal(inspectOpenCodeReady(screen([], 'running')).ok, false);
  assert.equal(inspectOpenCodeReady(screen(['Build · high'], 'exited')).ok, false);
  assert.equal(inspectOpenCodeReady(screen(['random'])).ok, false);
  assert.equal(inspectOpenCodeReady(null).ok, false);
});
