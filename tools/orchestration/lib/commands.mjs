import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomId, shellQuotePosix} from './util.mjs';
import {harnessBinDir} from './paths.mjs';

export const PRINCIPAL = Object.freeze({
  orcaAgent: 'opencode2',
  providerID: 'opencode-go',
  model: 'deepseek-v4.1-flash',
  variant: 'high',
});

export const IMPLEMENTATION = Object.freeze({
  orcaAgent: 'codex',
  model: 'gpt-6.1-sol',
  defaultEffort: 'high',
  efforts: Object.freeze(['low', 'high']),
});

export const RESEARCH = Object.freeze({
  orcaAgent: 'antigravity',
  defaultModel: null,
});

export function buildSessionId() {
  return `ses_orcah${randomId()}`.replaceAll('-', '');
}

export function expectedPrincipalModel() {
  return {
    providerID: PRINCIPAL.providerID,
    id: PRINCIPAL.model,
    variant: PRINCIPAL.variant,
  };
}

export function principalConfigContent() {
  return JSON.stringify({
    default_agent: 'build',
    agents: {
      build: {
        model: {
          providerID: PRINCIPAL.providerID,
          model: PRINCIPAL.model,
          variant: PRINCIPAL.variant,
        },
      },
    },
  });
}

/**
 * Resolve the Orca CLI once, following the orchestration skill's rules.
 * Selection is final: a missing or broken selected executable must stop the
 * command rather than falling through to a different Orca build.
 */
export function resolveOrcaExecutable({env = process.env, explicit = null} = {}) {
  if (explicit) return {path: explicit, source: 'explicit'};
  if (env.ORCA_CLI_COMMAND) return {path: env.ORCA_CLI_COMMAND, source: 'ORCA_CLI_COMMAND'};
  if (env.ORCA_DEV_REPO_ROOT) return {path: 'orca-dev', source: 'ORCA_DEV_REPO_ROOT'};
  if (process.platform === 'linux' && !env.ORCA_TERMINAL_HANDLE) {
    return {path: 'orca-ide', source: 'linux-outside-orca'};
  }
  return {path: 'orca', source: 'orca'};
}

export function resolveOpencodePrincipalWrapper({env = process.env, explicit = null, sourceRoot = null} = {}) {
  if (explicit) return explicit;
  const installed = path.join(harnessBinDir(env), 'opencode-principal.sh');
  if (fs.existsSync(installed)) return installed;
  if (sourceRoot) {
    const tracked = path.join(sourceRoot, 'bin', 'opencode-principal.sh');
    if (fs.existsSync(tracked)) return tracked;
  }
  const sibling = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'opencode-principal.sh');
  return path.resolve(sibling);
}

/**
 * Identify the calling agent from explicit session markers, not from generic
 * model-selection settings. In particular, ORCA_OPENCODE_AGENT is a host-wide
 * default and is not proof that the caller is an OpenCode process.
 */
export function callerIdentity(env = process.env) {
  const explicit = String(env.AI_AGENT || '').toLowerCase();
  if (explicit === 'codex') return {kind: 'codex', source: 'AI_AGENT'};
  if (explicit === 'opencode' || explicit === 'opencode2') {
    return {kind: 'opencode', source: 'AI_AGENT'};
  }
  if (explicit === 'antigravity' || explicit === 'agy') {
    return {kind: 'antigravity', source: 'AI_AGENT'};
  }
  if (env.CODEX_THREAD_ID) return {kind: 'codex', source: 'CODEX_THREAD_ID'};
  if (env.CODEX_SESSION_ID) return {kind: 'codex', source: 'CODEX_SESSION_ID'};
  if (env.CODEX_ROLLOUT_ID) return {kind: 'codex', source: 'CODEX_ROLLOUT_ID'};
  if (env.OPENCODE_SESSION_ID) {
    return {kind: 'opencode', source: 'OPENCODE_SESSION_ID'};
  }
  if (env.OPENCODE === '1' || env.OPENCODE === 'true') {
    return {kind: 'opencode', source: 'OPENCODE'};
  }
  if (env.AGY_SESSION_ID || env.AGY_CONVERSATION_ID || env.ANTIGRAVITY_SESSION_ID) {
    return {kind: 'antigravity', source: 'AGY_SESSION_ID'};
  }
  return {kind: 'unknown', source: null};
}

export function agentEnvironment(env = process.env) {
  const identity = callerIdentity(env);
  return {
    kind: identity.kind,
    source: identity.source,
    codex: identity.kind === 'codex',
    opencode: identity.kind === 'opencode',
    antigravity: identity.kind === 'antigravity',
  };
}

/**
 * Prevent automatic recursion or launching a copy of the calling worker.
 * The OpenCode principal may dispatch Codex implementation and Antigravity
 * research; a Codex implementation worker may not dispatch another Codex
 * implementation, and Antigravity research may not dispatch a copy of itself.
 */
export function assertLaunchGuard(role, env = process.env) {
  const agents = agentEnvironment(env);
  const harnessRole = String(env.ORCA_HARNESS_ACTIVE_ROLE || '').toLowerCase();

  if (role === 'principal' && agents.kind !== 'unknown') {
    throw new Error(
      'Refusing to start a principal from an existing agent session. Run `orca-team principal` from a plain shell (not inside OpenCode, Codex, or Antigravity) so the current session is not duplicated.',
    );
  }
  if (role === 'implementation' && (agents.codex || harnessRole === 'implementation')) {
    throw new Error(
      'Refusing to start a Codex implementation worker from a Codex implementation session; this would launch a copy of the current worker. The OpenCode principal must dispatch implementation.',
    );
  }
  if (role === 'research' && (agents.antigravity || harnessRole === 'research')) {
    throw new Error(
      'Refusing to start a research worker from an Antigravity research session; this would launch a copy of the current worker. The OpenCode principal must dispatch research.',
    );
  }
}

export function normalizeEffort(value = IMPLEMENTATION.defaultEffort) {
  const effort = String(value ?? IMPLEMENTATION.defaultEffort).toLowerCase();
  if (!IMPLEMENTATION.efforts.includes(effort)) {
    throw new Error(
      `Unsupported Codex effort "${value}". Use one of: ${IMPLEMENTATION.efforts.join(', ')}.`,
    );
  }
  return effort;
}

export function roleActivationPrompt(role) {
  const shared = '~/.config/orca-harness/AGENTS.md';
  if (role === 'principal') {
    return [
      'You are the OpenCode principal for the opt-in Orca team harness in this workspace.',
      `Read ${shared} and ~/.config/orca-harness/roles/opencode.md before proceeding.`,
      'You are the main model and own systems analysis, architecture, delegation, review, and final acceptance.',
      'Do not edit app code: dispatch scoped implementation to the Codex worker with orca-team implementation --effort low|high.',
      'Do not start another principal or another copy of this session. Use native Orca mailbox supervision and worker_done; do not poll.',
    ].join(' ');
  }
  if (role === 'implementation') {
    return [
      'You are the sole Codex implementation worker for this task.',
      `Read ${shared} and ~/.config/orca-harness/roles/codex.md before proceeding.`,
      'Edit only the scoped app files named by the task, run the required checks, and report with worker_done.',
      'Do not launch agents, do not act as principal, and do not treat Jev confidence as permission.',
    ].join(' ');
  }
  return [
    'You are the Antigravity research worker for this task.',
    `Read ${shared} and ~/.config/orca-harness/roles/antigravity.md before proceeding.`,
    'Research, web search, and analytics only. Do not edit app code and do not launch agents.',
    'Report sourced findings to the OpenCode principal with worker_done; escalate uncertainty instead of guessing.',
  ].join(' ');
}

export function planPrincipal({
  orcaPath,
  wrapperPath,
  sessionId = buildSessionId(),
  worktree = 'current',
  title = 'OpenCode principal',
  prompt = null,
  task = null,
  taskFile = null,
  extraPrompt = null,
  focus = false,
  timeoutMs = 90_000,
}) {
  const parts = [roleActivationPrompt('principal')];
  if (extraPrompt) parts.push(extraPrompt);
  if (taskFile) parts.push(`Task file: ${taskFile}`);
  else if (task) parts.push(`Task:\n${task}`);
  const finalPrompt = prompt || parts.join('\n\n');
  const terminalCommand = [wrapperPath, '--session', sessionId].map(shellQuotePosix).join(' ');
  const createArgv = [
    orcaPath,
    'terminal',
    'create',
    '--worktree',
    worktree,
    '--title',
    title,
    '--command',
    terminalCommand,
    ...(focus ? ['--focus'] : []),
    '--json',
  ];
  const waitArgv = [
    orcaPath,
    'terminal',
    'wait',
    '--terminal',
    '{terminal}',
    '--for',
    'tui-idle',
    '--timeout-ms',
    String(timeoutMs),
    '--json',
  ];
  const readyArgv = [
    orcaPath,
    'terminal',
    'read',
    '--terminal',
    '{terminal}',
    '--screen',
    '--json',
  ];
  const sendArgv = [
    orcaPath,
    'terminal',
    'send',
    '--terminal',
    '{terminal}',
    '--text',
    finalPrompt,
    '--enter',
    '--wait-submit',
    '30',
    '--json',
  ];
  return {
    role: 'principal',
    receiptRole: 'principal',
    steps: [
      {name: 'create-principal-terminal', argv: createArgv, expect: 'json'},
      {name: 'wait-tui-idle', argv: waitArgv, expect: 'json', uses: 'terminal'},
      {
        name: 'check-opencode-ready',
        argv: readyArgv,
        expect: 'json',
        uses: 'terminal',
        delayMs: 4000,
        readyCheck: 'opencode',
      },
      {name: 'send-principal-prompt', argv: sendArgv, expect: 'json', uses: 'terminal'},
    ],
    sessionId,
    expectedModel: expectedPrincipalModel(),
    model: `${PRINCIPAL.providerID}/${PRINCIPAL.model}`,
    effort: PRINCIPAL.variant,
    worktree,
    title,
    terminalCommand,
    notes: [
      'Orca does not accept launch-time --model or --effort for opencode2.',
      'The private wrapper sets OPENCODE_CONFIG_CONTENT to disable MCP for this process and pin the build agent model without changing global configuration.',
      'The readiness gate requires the TUI to show DeepSeek V4.1 Flash on OpenCode Go at the high variant before the prompt is sent.',
      'After the prompt is accepted, verify the actual assistant-message model with: orca-team verify-session --session <id>.',
      'Input acceptance is not model proof; a pending assistant message stays awaiting_verification.',
    ],
  };
}

export function planImplementation({
  orcaPath,
  taskFile,
  taskId = null,
  retryOf = null,
  worktree = 'current',
  title = 'Implementation',
  effort = IMPLEMENTATION.defaultEffort,
  runId = null,
}) {
  const selectedEffort = normalizeEffort(effort);
  const taskArgs = retryOf
    ? ['--task', taskId, '--retry-of', retryOf]
    : ['--spec-file', taskFile];
  const argv = [
    orcaPath,
    'orchestration',
    'worker-start',
    '--agent',
    IMPLEMENTATION.orcaAgent,
    '--worktree',
    worktree,
    ...taskArgs,
    '--task-title',
    title,
    '--model',
    IMPLEMENTATION.model,
    '--effort',
    selectedEffort,
    ...(runId ? ['--run', runId] : []),
    '--full',
    '--json',
  ];
  return {
    role: 'implementation',
    receiptRole: 'implementation',
    steps: [{name: 'worker-start', argv, expect: 'json'}],
    model: IMPLEMENTATION.model,
    effort: selectedEffort,
    expectedModel: null,
    worktree,
    title,
    retryOf,
    taskId,
    notes: [
      'Codex supports launch-time --model and --effort through orca orchestration worker-start.',
      `Use low for narrow mechanical edits and high for behavior, architecture, or review-sensitive work (default ${IMPLEMENTATION.defaultEffort}).`,
      'The OpenCode principal owns review and acceptance; the Codex worker edits only the scoped files.',
      'No worker-start retry is automatic; --retry-of is only used for an explicit retry of an already-settled failed task.',
    ],
  };
}

export function planResearch({
  orcaPath,
  taskFile,
  worktree = 'current',
  title = 'Research',
  model = null,
  runId = null,
}) {
  const argv = [
    orcaPath,
    'orchestration',
    'worker-start',
    '--agent',
    RESEARCH.orcaAgent,
    '--worktree',
    worktree,
    '--spec-file',
    taskFile,
    '--task-title',
    title,
    ...(model ? ['--model', model] : []),
    ...(runId ? ['--run', runId] : []),
    '--full',
    '--json',
  ];
  return {
    role: 'research',
    receiptRole: 'research',
    steps: [{name: 'worker-start-research', argv, expect: 'json'}],
    model: model ?? 'antigravity-default',
    worktree,
    title,
    notes: [
      'Antigravity accepts any model from `agy models`; omit --model to use the agy setting.',
      'The task spec must say research never edits app code. Prefer a read-only scope and sourced findings.',
      'Research reports evidence to the OpenCode principal, never directly to implementation.',
    ],
  };
}

export function planVerify({sessionId, orcaTeamPath = 'orca-team', json = true}) {
  return {
    role: 'verify',
    steps: [
      {
        name: 'verify-session',
        argv: [orcaTeamPath, 'verify-session', '--session', sessionId, ...(json ? ['--json'] : [])],
      },
    ],
    sessionId,
  };
}
