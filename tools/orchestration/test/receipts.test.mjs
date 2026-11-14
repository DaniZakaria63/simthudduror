import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  applyPrincipalVerification,
  applyWorkerStartResult,
  createReceipt,
  extractRecovery,
  listReceipts,
  loadReceipt,
  receiptSummary,
  recoveryPlan,
  saveReceipt,
} from '../lib/receipts.mjs';
import {planImplementation, planPrincipal} from '../lib/commands.mjs';

function tempEnv() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'orca-harness-receipts-'));
  return {
    root,
    env: {
      ...process.env,
      HOME: path.join(root, 'home'),
      XDG_CONFIG_HOME: path.join(root, 'config'),
      XDG_STATE_HOME: path.join(root, 'state'),
    },
  };
}

test('receipts are durable, private, listable, and reloadable', () => {
  const {root, env} = tempEnv();
  const plan = planPrincipal({
    orcaPath: '/opt/orca',
    wrapperPath: '/tmp/opencode-principal.sh',
    taskFile: '/tmp/task.md',
    sessionId: 'ses_orcahabc123',
  });
  const receipt = createReceipt({role: 'principal', plan, cwd: root, env});
  assert.equal(receipt.status, 'intent');
  const file = path.join(env.XDG_STATE_HOME, 'orca-harness', 'receipts', `${receipt.id}.json`);
  assert.equal(fs.existsSync(file), true);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);

  const loaded = loadReceipt(receipt.id, env);
  assert.equal(loaded.role, 'principal');
  assert.equal(loaded.plan.expectedModel.variant, 'high');
  assert.equal(listReceipts(env).length, 1);
});

test('ready worker-start settles a receipt as started', () => {
  const {root, env} = tempEnv();
  const plan = planImplementation({
    orcaPath: '/opt/orca',
    taskFile: '/tmp/task.md',
  });
  const receipt = createReceipt({role: 'implementation', plan, cwd: root, env});
  applyWorkerStartResult(receipt, {
    ok: true,
    result: {
      state: 'ready',
      dispatchId: 'dispatch-1',
      taskId: 'task-1',
      runId: 'run-1',
      terminal: 'term-1',
      agent: 'codex',
      model: 'gpt-6.1-sol',
      effort: 'high',
      next: 'Orca wakes you.',
    },
  });
  saveReceipt(receipt, env);
  assert.equal(receipt.status, 'started');
  assert.equal(receipt.dispatchId, 'dispatch-1');
  assert.equal(receipt.terminal, 'term-1');
  assert.equal(receipt.recovery, null);
});

test('outcome_unknown becomes uncertain and preserves Orca recovery commands', () => {
  const {root, env} = tempEnv();
  const plan = planImplementation({orcaPath: '/opt/orca', taskFile: '/tmp/task.md'});
  const receipt = createReceipt({role: 'implementation', plan, cwd: root, env});
  applyWorkerStartResult(receipt, {
    ok: true,
    result: {
      state: 'outcome_unknown',
      dispatchId: 'dispatch-2',
      next: "don't resend",
      recovery: {
        orchestrationRequestId: 'req-2',
        dispatchId: 'dispatch-2',
        queryCommand: ['orca', 'orchestration', 'worker-show', '--dispatch', 'dispatch-2', '--json'],
        retryCommand: [
          'orca',
          'orchestration',
          'worker-start',
          '--terminal',
          'term-2',
          '--spec-file',
          '/tmp/task.md',
          '--retry-request',
          'req-2',
          '--json',
        ],
        recoveryBlocked: false,
        disposition: 'outcome_unknown',
      },
    },
  });
  assert.equal(receipt.status, 'uncertain');
  assert.equal(receipt.recovery.orchestrationRequestId, 'req-2');
  const lines = recoveryPlan(receipt).join('\n');
  assert.match(lines, /Inspect first/);
  assert.match(lines, /--retry-request req-2/);
  assert.match(lines, /never blind-retry/i);
});

test('worker input acceptance is not model proof until an assistant message exists', () => {
  const {root, env} = tempEnv();
  const plan = planPrincipal({
    orcaPath: '/opt/orca',
    wrapperPath: '/tmp/wrapper.sh',
    taskFile: '/tmp/task.md',
  });
  const receipt = createReceipt({role: 'principal', plan, cwd: root, env});
  receipt.status = 'started';
  receipt.terminal = 'term-1';
  applyPrincipalVerification(receipt, {
    status: 'pending',
    reason: 'session exists but no assistant message with model metadata yet',
    observed: [],
  });
  assert.equal(receipt.status, 'awaiting_verification');
  assert.match(receipt.next, /verify-session/);
});

test('assistant-message high proof settles started and a mismatch fails', () => {
  const {root, env} = tempEnv();
  const plan = planPrincipal({
    orcaPath: '/opt/orca',
    wrapperPath: '/tmp/wrapper.sh',
    taskFile: '/tmp/task.md',
  });
  const high = createReceipt({role: 'principal', plan, cwd: root, env});
  high.status = 'started';
  applyPrincipalVerification(high, {
    status: 'high',
    reason: 'observed assistant-message model matches',
    observed: [{providerID: 'opencode-go', id: 'deepseek-v4.1-flash', variant: 'high'}],
  });
  assert.equal(high.status, 'started');

  const mismatch = createReceipt({role: 'principal', plan, cwd: root, env});
  mismatch.status = 'started';
  applyPrincipalVerification(mismatch, {
    status: 'mismatch',
    reason: 'observed assistant-message model does not match',
    observed: [{providerID: 'opencode-go', id: 'deepseek-v4.1-flash', variant: 'max'}],
  });
  assert.equal(mismatch.status, 'failed');
  assert.match(mismatch.lastError, /does not match/);
});

test('task_not_startable preserves Orca code/message/nextSteps without inventing recovery', () => {
  const {root, env} = tempEnv();
  const plan = planImplementation({
    orcaPath: '/opt/orca',
    taskFile: null,
    taskId: 'task_4dcc5dea2b6b',
    retryOf: 'ctx_e3563cef0b68',
  });
  const receipt = createReceipt({role: 'implementation', plan, cwd: root, env});
  applyWorkerStartResult(receipt, {
    ok: false,
    error: {
      code: 'task_not_startable',
      message:
        'Task task_4dcc5dea2b6b cannot retry from Dispatch ctx_e3563cef0b68. Orchestration mutation request ID: req-1.',
      data: {
        taskId: 'task_4dcc5dea2b6b',
        status: 'ready',
        unmetDependencies: [],
        retryOf: 'ctx_e3563cef0b68',
        nextSteps: [
          '--retry-of must name the latest settled Dispatch of a failed or blocked Task; check dispatch-show and worker-show.',
        ],
        orchestrationRequestId: 'req-1',
        originalCommand: ['orca', 'orchestration', 'worker-start'],
      },
    },
  });
  assert.equal(receipt.status, 'failed');
  assert.equal(receipt.recovery, null);
  assert.equal(receipt.lastError.includes('cannot retry from Dispatch'), true);
  assert.equal(receipt.orcaError.code, 'task_not_startable');
  assert.equal(receipt.orcaError.status, 'ready');
  assert.equal(receipt.orcaError.taskId, 'task_4dcc5dea2b6b');
  assert.equal(receipt.orcaError.retryOf, 'ctx_e3563cef0b68');
  assert.equal(receipt.orcaError.orchestrationRequestId, 'req-1');
  assert.match(receipt.orcaError.nextSteps[0], /latest settled Dispatch/);
  assert.equal(receiptSummary(receipt).orcaError.code, 'task_not_startable');
  const lines = recoveryPlan(receipt).join('\n');
  assert.match(lines, /Orca error task_not_startable/);
  assert.match(lines, /latest settled Dispatch/);
  assert.match(lines, /never blind-retry/i);
});

test('a receipt without a retry token explicitly forbids blind retry', () => {
  const {root, env} = tempEnv();
  const plan = planImplementation({orcaPath: '/opt/orca', taskFile: '/tmp/task.md'});
  const receipt = createReceipt({role: 'implementation', plan, cwd: root, env});
  receipt.status = 'uncertain';
  const lines = recoveryPlan(receipt).join('\n');
  assert.match(lines, /No supported retry token/);
  assert.match(lines, /never blind-retry/i);
});

test('extractRecovery accepts both result and error.data shapes without inventing retries', () => {
  const fromResult = extractRecovery({
    ok: true,
    result: {recovery: {orchestrationRequestId: 'r1', queryCommand: ['orca', 'x']}},
  });
  assert.equal(fromResult.orchestrationRequestId, 'r1');
  assert.deepEqual(fromResult.queryCommand, ['orca', 'x']);

  const fromError = extractRecovery({
    ok: false,
    error: {
      data: {
        recovery: {
          orchestrationRequestId: 'r2',
          queryCommand: ['orca', 'y'],
          retryCommand: null,
          recoveryBlocked: true,
        },
      },
    },
  });
  assert.equal(fromError.orchestrationRequestId, 'r2');
  assert.equal(fromError.recoveryBlocked, true);
  assert.equal(extractRecovery({ok: true, result: {state: 'ready'}}), null);
});
