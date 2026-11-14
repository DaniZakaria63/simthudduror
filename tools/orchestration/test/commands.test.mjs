import assert from 'node:assert/strict';
import test from 'node:test';
import {
  IMPLEMENTATION,
  PRINCIPAL,
  assertLaunchGuard,
  buildSessionId,
  callerIdentity,
  normalizeEffort,
  planImplementation,
  planPrincipal,
  planResearch,
  principalConfigContent,
  resolveOrcaExecutable,
} from '../lib/commands.mjs';

test('principal plan launches a private OpenCode DeepSeek high terminal and sends the prompt', () => {
  const plan = planPrincipal({
    orcaPath: '/opt/orca',
    wrapperPath: '/home/me/.config/orca-harness/bin/opencode-principal.sh',
    task: 'Do the task',
  });
  assert.equal(plan.steps.length, 4);
  assert.equal(plan.steps[0].name, 'create-principal-terminal');
  assert.equal(plan.steps[1].name, 'wait-tui-idle');
  assert.equal(plan.steps[2].name, 'check-opencode-ready');
  assert.equal(plan.steps[2].readyCheck, 'opencode');
  assert.equal(plan.steps[2].delayMs, 4000);
  assert.equal(plan.steps[3].name, 'send-principal-prompt');

  const create = plan.steps[0].argv;
  assert.equal(create.includes('--agent'), false);
  assert.equal(create.includes('--command'), true);
  const terminalCommand = create[create.indexOf('--command') + 1];
  assert.match(terminalCommand, /opencode-principal\.sh/);
  assert.match(terminalCommand, /--session ses_orcah/);

  assert.equal(plan.steps[1].argv.includes('{terminal}'), true);
  assert.equal(plan.steps[1].argv[plan.steps[1].argv.indexOf('--for') + 1], 'tui-idle');
  assert.equal(plan.steps[2].argv.includes('--screen'), true);
  assert.equal(plan.steps[3].argv.includes('{terminal}'), true);
  assert.equal(plan.steps[3].argv.includes('--text'), true);
  assert.equal(plan.steps[3].argv[plan.steps[3].argv.indexOf('--text') + 1].includes('OpenCode principal'), true);
  assert.equal(plan.expectedModel.variant, 'high');
  assert.equal(plan.expectedModel.providerID, PRINCIPAL.providerID);
  assert.equal(plan.expectedModel.id, PRINCIPAL.model);
  assert.equal(PRINCIPAL.orcaAgent, 'opencode2');
  assert.equal(PRINCIPAL.model, 'deepseek-v4.1-flash');
  assert.match(plan.notes.join(' '), /verify the actual assistant-message model/i);
});

test('implementation plan uses Codex model and effort through worker-start', () => {
  const plan = planImplementation({
    orcaPath: '/opt/orca',
    taskFile: '/tmp/task.md',
    title: 'Scoped change',
    effort: 'low',
  });
  assert.equal(plan.steps.length, 1);
  assert.equal(plan.steps[0].name, 'worker-start');
  const argv = plan.steps[0].argv;
  assert.equal(argv[argv.indexOf('--agent') + 1], 'codex');
  assert.equal(argv[argv.indexOf('--model') + 1], 'gpt-6.1-sol');
  assert.equal(argv[argv.indexOf('--effort') + 1], 'low');
  assert.equal(argv.includes('--spec-file'), true);
  assert.equal(argv.includes('--terminal'), false);
  assert.equal(argv.includes('--full'), true);
  assert.equal(plan.model, IMPLEMENTATION.model);
  assert.equal(plan.effort, 'low');
  assert.equal(plan.expectedModel, null);
  assert.match(plan.notes.join(' '), /low for narrow mechanical edits/i);
});

test('implementation defaults to high effort and rejects unsupported effort values', () => {
  const plan = planImplementation({orcaPath: '/opt/orca', taskFile: '/tmp/task.md'});
  assert.equal(plan.effort, 'high');
  assert.equal(plan.steps[0].argv[plan.steps[0].argv.indexOf('--effort') + 1], 'high');
  assert.throws(() => normalizeEffort('max'), /Unsupported Codex effort/);
});

test('an explicit retry uses the failed task identity and retry-of, not a fresh spec', () => {
  const plan = planImplementation({
    orcaPath: '/opt/orca',
    taskFile: null,
    taskId: 'task_failed',
    retryOf: 'ctx_failed',
    effort: 'high',
  });
  const argv = plan.steps[0].argv;
  assert.equal(argv[argv.indexOf('--task') + 1], 'task_failed');
  assert.equal(argv[argv.indexOf('--retry-of') + 1], 'ctx_failed');
  assert.equal(argv.includes('--spec-file'), false);
  assert.equal(plan.retryOf, 'ctx_failed');
  assert.equal(plan.taskId, 'task_failed');
});

test('principal config content pins the build agent to the high variant only', () => {
  const config = JSON.parse(principalConfigContent());
  assert.equal(config.default_agent, 'build');
  assert.deepEqual(config.agents.build.model, {
    providerID: 'opencode-go',
    model: 'deepseek-v4.1-flash',
    variant: 'high',
  });
  assert.equal(Object.keys(config).sort().join(','), 'agents,default_agent');
});

test('research plan uses Antigravity and omits a model unless one is named', () => {
  const plan = planResearch({orcaPath: '/opt/orca', taskFile: '/tmp/research.md'});
  const argv = plan.steps[0].argv;
  assert.equal(argv[argv.indexOf('--agent') + 1], 'antigravity');
  assert.equal(argv.includes('--model'), false);
  const named = planResearch({
    orcaPath: '/opt/orca',
    taskFile: '/tmp/research.md',
    model: 'gemini-3.8-flash-high',
  });
  assert.equal(named.steps[0].argv[named.steps[0].argv.indexOf('--model') + 1], 'gemini-3.8-flash-high');
});

test('session ids are OpenCode-compatible and unique enough', () => {
  const left = buildSessionId();
  const right = buildSessionId();
  assert.match(left, /^ses_orcah[0-9a-f]+$/);
  assert.notEqual(left, right);
});

test('Orca resolution follows the skill precedence and never probes for a fallback', () => {
  assert.deepEqual(
    resolveOrcaExecutable({env: {ORCA_CLI_COMMAND: '/managed/orca'}, explicit: '/explicit/orca'}),
    {path: '/explicit/orca', source: 'explicit'},
  );
  assert.deepEqual(
    resolveOrcaExecutable({env: {ORCA_CLI_COMMAND: '/managed/orca'}}),
    {path: '/managed/orca', source: 'ORCA_CLI_COMMAND'},
  );
  assert.deepEqual(
    resolveOrcaExecutable({env: {ORCA_DEV_REPO_ROOT: '/dev/orca'}}),
    {path: 'orca-dev', source: 'ORCA_DEV_REPO_ROOT'},
  );
  assert.deepEqual(
    resolveOrcaExecutable({env: {HOME: '/home/example'}}),
    {path: 'orca-ide', source: 'linux-outside-orca'},
  );
  assert.deepEqual(
    resolveOrcaExecutable({env: {ORCA_TERMINAL_HANDLE: 'term_1'}}),
    {path: 'orca', source: 'orca'},
  );
});

test('caller identity ignores generic ORCA_OPENCODE_AGENT selection', () => {
  assert.deepEqual(callerIdentity({ORCA_OPENCODE_AGENT: 'opencode2'}), {kind: 'unknown', source: null});
  assert.deepEqual(
    callerIdentity({ORCA_OPENCODE_AGENT: 'opencode2', CODEX_THREAD_ID: 'thread-1'}),
    {kind: 'codex', source: 'CODEX_THREAD_ID'},
  );
  assert.deepEqual(
    callerIdentity({ORCA_OPENCODE_AGENT: 'opencode2', CODEX_SESSION_ID: 'session-1'}),
    {kind: 'codex', source: 'CODEX_SESSION_ID'},
  );
  assert.deepEqual(
    callerIdentity({ORCA_OPENCODE_AGENT: 'opencode2', OPENCODE_SESSION_ID: 'ses_1'}),
    {kind: 'opencode', source: 'OPENCODE_SESSION_ID'},
  );
  assert.deepEqual(
    callerIdentity({ORCA_OPENCODE_AGENT: 'opencode2', OPENCODE: '1'}),
    {kind: 'opencode', source: 'OPENCODE'},
  );
  assert.deepEqual(
    callerIdentity({AI_AGENT: 'codex', OPENCODE_SESSION_ID: 'ses_1'}),
    {kind: 'codex', source: 'AI_AGENT'},
  );
});

test('the OpenCode principal can dispatch Codex implementation and research', () => {
  const opencodePrincipal = {
    ORCA_OPENCODE_AGENT: 'opencode2',
    OPENCODE_SESSION_ID: 'ses_principal',
    OPENCODE: '1',
    ORCA_HARNESS_ACTIVE_ROLE: 'principal',
  };
  assert.doesNotThrow(() => assertLaunchGuard('implementation', opencodePrincipal));
  assert.doesNotThrow(() => assertLaunchGuard('research', opencodePrincipal));
  assert.throws(
    () => assertLaunchGuard('principal', opencodePrincipal),
    /Refusing to start a principal/,
  );
});

test('a Codex implementation session cannot dispatch a copy of itself', () => {
  assert.throws(
    () => assertLaunchGuard('implementation', {AI_AGENT: 'codex'}),
    /copy of the current worker/,
  );
  assert.throws(
    () => assertLaunchGuard('implementation', {CODEX_THREAD_ID: 'thread-1'}),
    /copy of the current worker/,
  );
  assert.throws(
    () => assertLaunchGuard('implementation', {ORCA_HARNESS_ACTIVE_ROLE: 'implementation'}),
    /copy of the current worker/,
  );
  assert.throws(
    () => assertLaunchGuard('research', {AI_AGENT: 'antigravity'}),
    /copy of the current worker/,
  );
  assert.doesNotThrow(() => assertLaunchGuard('research', {AI_AGENT: 'codex'}));
  assert.doesNotThrow(() => assertLaunchGuard('principal', {}));
  assert.doesNotThrow(() => assertLaunchGuard('implementation', {ORCA_OPENCODE_AGENT: 'opencode2'}));
});
