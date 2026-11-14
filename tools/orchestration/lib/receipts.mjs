import fs from 'node:fs';
import path from 'node:path';
import {receiptsDir} from './paths.mjs';
import {ensurePrivateDir, formatArgv, nowIso, randomId, readJsonFile, truncate, writeJsonAtomic} from './util.mjs';

export const RECEIPT_VERSION = 1;

export function receiptsRoot(env = process.env) {
  return receiptsDir(env);
}

export function createReceipt({role, plan, cwd = process.cwd(), env = process.env, taskFile = null}) {
  ensurePrivateDir(receiptsRoot(env));
  const id = `${Date.now()}-${randomId('')}-${role}`;
  const receipt = {
    version: RECEIPT_VERSION,
    id,
    role,
    status: 'intent',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    cwd,
    worktree: plan.worktree ?? null,
    title: plan.title ?? null,
    taskFile,
    plan: {
      role: plan.role,
      steps: plan.steps,
      model: plan.model ?? null,
      effort: plan.effort ?? null,
      sessionId: plan.sessionId ?? null,
      expectedModel: plan.expectedModel ?? null,
      notes: plan.notes ?? [],
    },
    steps: [],
    sessionId: plan.sessionId ?? null,
    terminal: null,
    dispatchId: null,
    taskId: null,
    runId: null,
    recovery: null,
    next: null,
    lastError: null,
    orcaError: null,
    residualResources: null,
  };
  saveReceipt(receipt, env);
  return receipt;
}

export function saveReceipt(receipt, env = process.env) {
  receipt.updatedAt = nowIso();
  const file = receiptPath(receipt.id, env);
  writeJsonAtomic(file, receipt, 0o600);
  return file;
}

export function receiptPath(id, env = process.env) {
  return path.join(receiptsRoot(env), `${id}.json`);
}

export function loadReceipt(idOrPath, env = process.env) {
  const file = idOrPath.endsWith('.json') || idOrPath.includes(path.sep)
    ? idOrPath
    : receiptPath(idOrPath, env);
  return readJsonFile(file);
}

export function listReceipts(env = process.env) {
  const dir = receiptsRoot(env);
  let names = [];
  try {
    names = fs.readdirSync(dir).filter(name => name.endsWith('.json'));
  } catch {
    return [];
  }
  const receipts = [];
  for (const name of names) {
    try {
      receipts.push(readJsonFile(path.join(dir, name)));
    } catch {
      // Ignore an unreadable receipt rather than hiding the rest.
    }
  }
  return receipts.sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
}

export function appendStep(receipt, step) {
  receipt.steps.push(step);
  return receipt;
}

export function recordCommandResult(receipt, {name, argv, result, startedAt, finishedAt, cwd}) {
  const payload = result.payload ?? null;
  const unwrapped = result.unwrapped ?? null;
  const step = {
    name,
    argv,
    cwd,
    startedAt,
    finishedAt,
    exitCode: result.exitCode,
    signal: result.signal ?? null,
    timedOut: result.timedOut ?? false,
    stdout: truncate(result.stdout, 4000),
    stderr: truncate(result.stderr, 4000),
    ok: result.ok,
    payload,
    terminal: unwrapped?.terminal?.handle ?? unwrapped?.terminal ?? null,
  };
  appendStep(receipt, step);
  if (step.terminal && typeof step.terminal === 'string') {
    receipt.terminal = step.terminal;
  }
  return step;
}

export function extractRecovery(payload) {
  const result = payload?.result ?? payload;
  const errorData = payload?.error?.data ?? payload?.data ?? null;
  const recovery = result?.recovery ?? errorData?.recovery ?? null;
  if (!recovery) return null;
  return {
    orchestrationRequestId: recovery.orchestrationRequestId ?? null,
    dispatchId: recovery.dispatchId ?? null,
    queryCommand: Array.isArray(recovery.queryCommand) ? recovery.queryCommand : null,
    retryCommand: Array.isArray(recovery.retryCommand) ? recovery.retryCommand : null,
    recoveryBlocked: Boolean(recovery.recoveryBlocked),
    disposition: recovery.disposition ?? null,
    workerDeathInferred: Boolean(recovery.workerDeathInferred),
  };
}

/** Preserve Orca's failed-mutation code, message, and actionable nextSteps. */
export function extractOrcaError(payload) {
  const error = payload?.error;
  if (!error || typeof error !== 'object') return null;
  const data = error.data && typeof error.data === 'object' ? error.data : {};
  return {
    code: typeof error.code === 'string' ? error.code : null,
    message: typeof error.message === 'string' ? error.message : null,
    nextSteps: Array.isArray(data.nextSteps)
      ? data.nextSteps.filter(step => typeof step === 'string')
      : [],
    taskId: typeof data.taskId === 'string' ? data.taskId : null,
    status: typeof data.status === 'string' ? data.status : null,
    retryOf: typeof data.retryOf === 'string' ? data.retryOf : null,
    unmetDependencies: Array.isArray(data.unmetDependencies) ? data.unmetDependencies : null,
    orchestrationRequestId:
      typeof data.orchestrationRequestId === 'string' ? data.orchestrationRequestId : null,
    originalCommand: Array.isArray(data.originalCommand) ? data.originalCommand : null,
    recovery: data.recovery ?? null,
  };
}

export function applyWorkerStartResult(receipt, payload) {
  const result = payload?.result ?? payload;
  const recovery = extractRecovery(payload);
  const orcaError = extractOrcaError(payload);
  if (recovery) receipt.recovery = recovery;
  if (orcaError) {
    receipt.orcaError = orcaError;
    if (orcaError.taskId) receipt.taskId = orcaError.taskId;
    if (orcaError.message) receipt.lastError = orcaError.message;
  }
  if (result && typeof result === 'object') {
    receipt.dispatchId = result.dispatchId ?? receipt.dispatchId;
    receipt.taskId = result.taskId ?? receipt.taskId;
    receipt.runId = result.runId ?? receipt.runId;
    receipt.terminal = result.terminal ?? receipt.terminal;
    receipt.next = typeof result.next === 'string' ? result.next : receipt.next;
    receipt.lastError = result.lastError ?? result.failedStage ?? receipt.lastError;
    receipt.residualResources = result.residualResources ?? receipt.residualResources;
    if (result.state === 'ready') {
      receipt.status = 'started';
    } else if (
      result.state === 'outcome_unknown' ||
      result.turnStart === 'unobserved' ||
      result.stage === 'turn_start_unobserved'
    ) {
      receipt.status = 'uncertain';
    } else {
      receipt.status = 'failed';
    }
    return receipt;
  }
  if (recovery) {
    receipt.status = 'uncertain';
  } else {
    receipt.status = 'failed';
  }
  return receipt;
}

export function markFailure(receipt, error) {
  receipt.status = 'failed';
  receipt.lastError = error instanceof Error ? error.message : String(error);
  return receipt;
}

export function markUncertain(receipt, message) {
  receipt.status = 'uncertain';
  receipt.lastError = message;
  return receipt;
}

/**
 * The launcher may only call the principal "started" after an actual assistant
 * message proves the model. Input acceptance alone is not proof.
 */
export function applyPrincipalVerification(receipt, verification) {
  if (!verification) return receipt;
  receipt.verification = verification;
  if (verification.status === 'high') {
    receipt.status = 'started';
    receipt.lastError = null;
    return receipt;
  }
  if (verification.status === 'mismatch') {
    receipt.status = 'failed';
    receipt.lastError = `Observed model does not match the expected principal variant: ${verification.reason}`;
    return receipt;
  }
  if (receipt.status === 'started' || receipt.status === 'awaiting_verification') {
    receipt.status = 'awaiting_verification';
    receipt.next = `Run orca-team verify-session --session ${receipt.sessionId} --json after the principal replies; input acceptance is not model proof.`;
  }
  return receipt;
}

export function hasSupportedRecovery(receipt) {
  return Boolean(
    receipt.recovery &&
      (receipt.recovery.queryCommand || receipt.recovery.retryCommand || receipt.recovery.orchestrationRequestId),
  );
}

export function recoveryPlan(receipt) {
  const lines = [];
  if (receipt.orcaError) {
    lines.push(
      `Orca error ${receipt.orcaError.code ?? 'unknown'}: ${receipt.orcaError.message ?? 'no message'}`,
    );
    for (const step of receipt.orcaError.nextSteps ?? []) {
      lines.push(`Orca next step: ${step}`);
    }
    lines.push('Never blind-retry worker-start; inspect the task and dispatch state first.');
  }
  if (receipt.next) {
    lines.push(`Orca next step: ${receipt.next}`);
  }
  if (receipt.recovery?.queryCommand) {
    lines.push(`Inspect first: ${formatArgv(receipt.recovery.queryCommand)}`);
  }
  if (receipt.recovery?.retryCommand) {
    lines.push(
      `Only after inspection, explicit retry: ${formatArgv(receipt.recovery.retryCommand)}`,
    );
    lines.push('Never blind-retry worker-start; verify the dispatch state first.');
  }
  if (receipt.recovery?.orchestrationRequestId) {
    lines.push(`Orchestration request id: ${receipt.recovery.orchestrationRequestId}`);
  }
  if (receipt.recovery?.recoveryBlocked) {
    lines.push('Orca reported recovery blocked; do not rerun worker-start blindly.');
  }
  if (!lines.length) {
    lines.push(
      'No supported retry token was recorded. Inspect `orca orchestration worker-list --json` and the terminal before deciding; never blind-retry worker-start.',
    );
  }
  return lines;
}

export function receiptSummary(receipt) {
  return {
    id: receipt.id,
    role: receipt.role,
    status: receipt.status,
    createdAt: receipt.createdAt,
    updatedAt: receipt.updatedAt,
    worktree: receipt.worktree,
    title: receipt.title,
    sessionId: receipt.sessionId,
    terminal: receipt.terminal,
    dispatchId: receipt.dispatchId,
    taskId: receipt.taskId,
    runId: receipt.runId,
    lastError: receipt.lastError,
    next: receipt.next,
    orcaError: receipt.orcaError ?? null,
    recovery: receipt.recovery,
  };
}
