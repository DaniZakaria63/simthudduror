import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {main} from '../lib/cli.mjs';

function tempEnv() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'orca-harness-cli-'));
  const env = {
    ...process.env,
    HOME: path.join(root, 'home'),
    XDG_CONFIG_HOME: path.join(root, 'config'),
    XDG_STATE_HOME: path.join(root, 'state'),
    ORCA_CLI_COMMAND: '/opt/orca',
    TYPESAFE_API_KEY: '',
  };
  for (const key of [
    'OPENCODE',
    'OPENCODE_SESSION_ID',
    'ORCA_OPENCODE_AGENT',
    'ORCA_HARNESS_ACTIVE_ROLE',
    'AI_AGENT',
    'CODEX_HOME',
    'CODEX_THREAD_ID',
    'AGY_SESSION_ID',
    'ANTIGRAVITY_SESSION_ID',
  ]) {
    delete env[key];
  }
  return {root, env};
}

function capture(fn) {
  const original = console.log;
  const lines = [];
  console.log = (...args) => lines.push(args.join(' '));
  return Promise.resolve(fn())
    .then(value => ({value, output: lines.join('\n')}))
    .finally(() => {
      console.log = original;
    });
}

test('plan principal is side-effect free and shows the private OpenCode wrapper', async () => {
  const {root, env} = tempEnv();
  const {value, output} = await capture(() =>
    main(['plan', 'principal', '--json', '--orca', '/opt/orca'], {env, cwd: root}),
  );
  assert.equal(value, 0);
  const plan = JSON.parse(output);
  assert.equal(plan.role, 'principal');
  assert.equal(plan.model, 'opencode-go/deepseek-v4.1-flash');
  assert.equal(plan.effort, 'high');
  assert.match(plan.steps[0].command, /opencode-principal\.sh/);
  assert.match(plan.steps[0].command, /--session ses_orcah/);
  assert.match(plan.steps[2].command, /terminal read/);
  assert.match(plan.steps[3].command, /terminal send/);
  assert.equal(fs.existsSync(path.join(env.XDG_STATE_HOME, 'orca-harness')), false);
});

test('plan implementation is side-effect free and shows Codex model/effort', async () => {
  const {root, env} = tempEnv();
  const {value, output} = await capture(() =>
    main(
      [
        'plan',
        'implementation',
        '--json',
        '--orca',
        '/opt/orca',
        '--task-file',
        '/tmp/task.md',
        '--effort',
        'low',
      ],
      {env, cwd: root},
    ),
  );
  assert.equal(value, 0);
  const plan = JSON.parse(output);
  assert.equal(plan.role, 'implementation');
  assert.equal(plan.model, 'gpt-6.1-sol');
  assert.equal(plan.effort, 'low');
  assert.equal(plan.steps.length, 1);
  assert.match(plan.steps[0].command, /worker-start/);
  assert.match(plan.steps[0].command, /--agent codex/);
  assert.match(plan.steps[0].command, /--model gpt-6\.1-sol/);
  assert.match(plan.steps[0].command, /--effort low/);
  assert.match(plan.steps[0].command, /--spec-file \/tmp\/task\.md/);
});

test('boolean flags do not consume a following positional', async () => {
  const {root, env} = tempEnv();
  const {value, output} = await capture(() =>
    main(['plan', '--json', 'principal', '--orca', '/opt/orca'], {env, cwd: root}),
  );
  assert.equal(value, 0);
  assert.equal(JSON.parse(output).role, 'principal');
});

test('principal dry-run with an inline task writes no task or receipt', async () => {
  const {root, env} = tempEnv();
  const {value, output} = await capture(() =>
    main(
      ['principal', '--task', 'do it', '--dry-run', '--json', '--orca', '/opt/orca'],
      {env, cwd: root},
    ),
  );
  assert.equal(value, 0);
  const plan = JSON.parse(output);
  assert.match(plan.steps[0].command, /opencode-principal\.sh/);
  assert.match(plan.steps[3].command, /Task file: <inline-task>/);
  assert.equal(fs.existsSync(path.join(env.XDG_STATE_HOME, 'orca-harness')), false);
});

test('implementation dry-run with an inline task writes no task or receipt', async () => {
  const {root, env} = tempEnv();
  const {value, output} = await capture(() =>
    main(
      ['implementation', '--task', 'do it', '--dry-run', '--json', '--orca', '/opt/orca'],
      {env, cwd: root},
    ),
  );
  assert.equal(value, 0);
  const plan = JSON.parse(output);
  assert.match(plan.steps[0].command, /--spec-file '<inline-task>'/);
  assert.equal(fs.existsSync(path.join(env.XDG_STATE_HOME, 'orca-harness')), false);
});

test('an OpenCode principal environment can dispatch implementation from the CLI', async () => {
  const {root, env} = tempEnv();
  env.ORCA_OPENCODE_AGENT = 'opencode2';
  env.OPENCODE_SESSION_ID = 'ses_principal';
  env.ORCA_HARNESS_ACTIVE_ROLE = 'principal';
  const {value, output} = await capture(() =>
    main(
      ['implementation', '--task', 'principal dispatch', '--dry-run', '--json', '--orca', '/opt/orca'],
      {env, cwd: root},
    ),
  );
  assert.equal(value, 0);
  const plan = JSON.parse(output);
  assert.equal(plan.role, 'implementation');
});

test('implementation retry dry-run uses the same failed task and retry-of', async () => {
  const {root, env} = tempEnv();
  const {value, output} = await capture(() =>
    main(
      [
        'implementation',
        '--task-id',
        'task_failed',
        '--retry-of',
        'ctx_failed',
        '--dry-run',
        '--json',
        '--orca',
        '/opt/orca',
      ],
      {env, cwd: root},
    ),
  );
  assert.equal(value, 0);
  const plan = JSON.parse(output);
  assert.equal(plan.taskId, 'task_failed');
  assert.equal(plan.retryOf, 'ctx_failed');
  assert.match(plan.steps[0].command, /--task task_failed/);
  assert.match(plan.steps[0].command, /--retry-of ctx_failed/);
  assert.equal(fs.existsSync(path.join(env.XDG_STATE_HOME, 'orca-harness')), false);
});

test('implementation refuses to launch a copy of the current Codex worker', async () => {
  const {root, env} = tempEnv();
  env.CODEX_THREAD_ID = 'thread-1';
  const {value} = await capture(() =>
    main(
      ['implementation', '--task', 'do it', '--json', '--orca', '/opt/orca'],
      {env, cwd: root},
    ),
  );
  assert.equal(value, 1);
});

test('jev offline example is side-effect free and escalates', async () => {
  const {root, env} = tempEnv();
  const {value, output} = await capture(() =>
    main(['jev', '--example', '--offline', '--json'], {env, cwd: root}),
  );
  assert.equal(value, 0);
  const result = JSON.parse(output);
  assert.equal(result.result.status, 'offline');
  assert.equal(result.result.escalate, true);
  assert.equal(result.result.advisory, null);
  assert.equal(fs.existsSync(path.join(env.XDG_STATE_HOME, 'orca-harness')), false);
});

test('install dry-run is side-effect free', async () => {
  const {root, env} = tempEnv();
  const {value, output} = await capture(() => main(['install', '--dry-run', '--json'], {env, cwd: root}));
  assert.equal(value, 0);
  const result = JSON.parse(output);
  assert.equal(result.dryRun, true);
  assert.equal(fs.existsSync(path.join(env.HOME, '.codex', 'AGENTS.md')), false);
});

test('verify-session proves the expected principal variant from a temporary OpenCode database', async () => {
  const {root, env} = tempEnv();
  const dbPath = path.join(root, 'opencode.db');
  const {DatabaseSync} = await import('node:sqlite');
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE session_v2 (id TEXT PRIMARY KEY, model TEXT);
    CREATE TABLE session_message (id TEXT PRIMARY KEY, session_id TEXT, type TEXT, seq INTEGER, data TEXT);
  `);
  db.prepare('INSERT INTO session_v2 (id, model) VALUES (?, ?)').run('ses_orcahcli', null);
  db.prepare('INSERT INTO session_message (id, session_id, type, seq, data) VALUES (?, ?, ?, ?, ?)').run(
    'm1',
    'ses_orcahcli',
    'assistant',
    1,
    JSON.stringify({model: {providerID: 'opencode-go', id: 'deepseek-v4.1-flash', variant: 'high'}}),
  );
  db.close();
  const {value, output} = await capture(() =>
    main(['verify-session', '--session', 'ses_orcahcli', '--db-path', dbPath, '--json'], {
      env,
      cwd: root,
    }),
  );
  assert.equal(value, 0);
  const result = JSON.parse(output);
  assert.equal(result.status, 'high');
  assert.equal(result.observed[0].variant, 'high');
});
