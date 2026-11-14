import {spawnSync} from 'node:child_process';
import {
  applyWorkerStartResult,
  extractRecovery,
  markFailure,
  markUncertain,
  recordCommandResult,
  saveReceipt,
} from './receipts.mjs';
import {normalizeOrcaPayload, parseJsonOutput, sleepSync} from './util.mjs';

export function runCommand(argv, {cwd = process.cwd(), env = process.env, timeoutMs = 180_000} = {}) {
  const startedAt = new Date().toISOString();
  let result;
  try {
    result = spawnSync(argv[0], argv.slice(1), {
      cwd,
      env,
      encoding: 'utf8',
      timeout: timeoutMs,
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (error) {
    return {
      ok: false,
      exitCode: null,
      signal: null,
      timedOut: false,
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
      argv,
      startedAt,
      finishedAt: new Date().toISOString(),
      payload: null,
      unwrapped: null,
    };
  }

  const payload = parseJsonOutput(result.stdout);
  const unwrapped = normalizeOrcaPayload(payload);
  const finishedAt = new Date().toISOString();
  const timedOut = result.error && result.error.code === 'ETIMEDOUT';
  const ok =
    !timedOut &&
    result.status === 0 &&
    (payload === null || payload.ok !== false);
  return {
    ok,
    exitCode: result.status,
    signal: result.signal ?? null,
    timedOut: Boolean(timedOut),
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    argv,
    startedAt,
    finishedAt,
    payload,
    unwrapped,
    error: result.error ?? null,
  };
}

export function substituteTerminal(argv, terminal) {
  return argv.map(value => (value === '{terminal}' ? terminal : value));
}

/**
 * Execute a plan step by step. Every step is recorded before the next one.
 * There is no retry loop here; recovery tokens go into the receipt for the
 * coordinator to inspect.
 */
export function runPlan({receipt, plan, cwd = process.cwd(), env = process.env, timeoutMs = 180_000} = {}) {
  for (const step of plan.steps) {
    if (step.uses === 'terminal' && !receipt.terminal) {
      markFailure(receipt, `Step ${step.name} needs a terminal handle, but terminal creation did not provide one.`);
      saveReceipt(receipt, env);
      return receipt;
    }
    if (step.delayMs) sleepSync(step.delayMs);
    const argv = substituteTerminal(step.argv, receipt.terminal);
    const result = runCommand(argv, {cwd, env, timeoutMs});
    recordCommandResult(receipt, {
      name: step.name,
      argv,
      result,
      startedAt: result.startedAt,
      finishedAt: result.finishedAt,
      cwd,
    });

    if (step.readyCheck === 'opencode') {
      const readiness = inspectOpenCodeReady(result);
      if (!readiness.ok) {
        markFailure(receipt, readiness.reason);
        saveReceipt(receipt, env);
        return receipt;
      }
    }

    if (step.name === 'worker-start' || step.name === 'worker-start-research') {
      applyWorkerStartResult(receipt, result.payload);
      if (receipt.status === 'started') {
        receipt.lastError = null;
      }
      saveReceipt(receipt, env);
      if (!result.ok && receipt.status !== 'uncertain') {
        receipt.status = 'failed';
      }
      saveReceipt(receipt, env);
      return receipt;
    }

    if (step.name === 'send-principal-prompt') {
      // Terminal send separates input acceptance from observed submission and
      // turn start. The command's success only proves acceptance; the CLI
      // verifies the actual assistant-message model afterwards.
      receipt.status = 'started';
      receipt.lastError = null;
      saveReceipt(receipt, env);
      return receipt;
    }

    if (!result.ok) {
      const recovery = extractRecovery(result.payload);
      if (recovery) {
        receipt.recovery = recovery;
        markUncertain(receipt, result.stderr || `Step ${step.name} did not complete.`);
      } else {
        const retryLaunch = extractAgentLaunchRetry(result.payload, argv);
        if (retryLaunch) {
          receipt.recovery = retryLaunch;
          markUncertain(receipt, result.stderr || `Step ${step.name} did not complete.`);
        } else {
          markFailure(receipt, result.stderr || result.stdout || `Step ${step.name} failed.`);
        }
      }
      saveReceipt(receipt, env);
      return receipt;
    }

    saveReceipt(receipt, env);
  }

  if (receipt.status === 'intent') {
    receipt.status = 'failed';
    receipt.lastError = 'The plan finished without a terminal worker-start result.';
    saveReceipt(receipt, env);
  }
  return receipt;
}

export function inspectOpenCodeReady(result) {
  const terminal = result?.unwrapped?.terminal ?? result?.payload?.result?.terminal ?? null;
  if (!terminal) {
    return {ok: false, reason: 'Could not read the OpenCode TUI screen; refusing to send the task blind.'};
  }
  if (terminal.status === 'exited') {
    return {ok: false, reason: 'OpenCode exited before it became ready for a task.'};
  }
  const lines = Array.isArray(terminal.tail) ? terminal.tail : [];
  const screen = lines.join('\n');
  if (!screen.trim()) {
    return {ok: false, reason: 'OpenCode returned no rendered screen; refusing to send the task blind.'};
  }
  const blockers = [
    ['Connect an integration', 'OpenCode is not authenticated; connect an integration before dispatch.'],
    ['MCP server failed', 'An OpenCode MCP startup modal is blocking the composer.'],
    ['Open MCP servers', 'An OpenCode MCP startup modal is blocking the composer.'],
  ];
  for (const [marker, reason] of blockers) {
    if (screen.includes(marker)) return {ok: false, reason};
  }
  const composerReady =
    screen.includes('Build ·') &&
    (screen.includes('Ask anything') ||
      screen.includes('shift+tab agents') ||
      screen.includes('ctrl+p commands'));
  if (!composerReady) {
    return {ok: false, reason: 'OpenCode composer was not ready on the rendered screen.'};
  }
  if (!screen.includes('DeepSeek V4.1 Flash') || !screen.includes('OpenCode Go')) {
    return {
      ok: false,
      reason:
        'OpenCode is not showing the expected OpenCode Go DeepSeek V4.1 Flash principal model. Select it before dispatch.',
    };
  }
  if (!screen.includes('OpenCode Go · high')) {
    return {
      ok: false,
      reason:
        'OpenCode is not at the high variant. Use ctrl+x m / Switch model variant and select high before dispatch.',
    };
  }
  return {ok: true, reason: 'OpenCode composer is ready and no auth/MCP blocker is visible.'};
}

function extractAgentLaunchRetry(payload, originalArgv) {
  const data = payload?.error?.data ?? payload?.data ?? null;
  const operationId =
    data?.operationId ??
    data?.retryLaunch ??
    data?.recovery?.operationId ??
    null;
  if (!operationId) return null;
  const retryArgv = [
    ...originalArgv.filter(arg => arg !== '--json' && !arg.startsWith('--retry-launch')),
    '--retry-launch',
    operationId,
    '--json',
  ];
  return {
    orchestrationRequestId: null,
    dispatchId: null,
    queryCommand: null,
    retryCommand: retryArgv,
    recoveryBlocked: false,
    disposition: 'outcome_unknown',
    operationId,
  };
}
