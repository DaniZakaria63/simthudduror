#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {
  ADVISORY_MODEL,
  DEFAULT_ENDPOINT,
  EXAMPLE_STATE,
  redactedEvidence,
  runJevAdvisory,
} from './jev.mjs';
import {
  IMPLEMENTATION,
  PRINCIPAL,
  assertLaunchGuard,
  buildSessionId,
  normalizeEffort,
  planImplementation,
  planPrincipal,
  planResearch,
  resolveOpencodePrincipalWrapper,
  resolveOrcaExecutable,
  roleActivationPrompt,
} from './commands.mjs';
import {installGlobal, INSTRUCTION_TARGETS} from './install-global.mjs';
import {keyFileStatus, resolveTypesafeKey} from './keys.mjs';
import {harnessHome, homeDir, receiptsDir, stateHome} from './paths.mjs';
import {
  applyPrincipalVerification,
  createReceipt,
  listReceipts,
  loadReceipt,
  receiptSummary,
  recoveryPlan,
  saveReceipt,
} from './receipts.mjs';
import {runCommand, runPlan} from './runner.mjs';
import {verifySessionModel} from './session-evidence.mjs';
import {ensurePrivateDir, formatArgv, writeFileAtomic} from './util.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_ROOT = path.resolve(HERE, '..');
const VERSION = '1.1.0';
const localRequire = createRequire(import.meta.url);

const BOOLEAN_FLAGS = new Set([
  'json',
  'dry-run',
  'focus',
  'offline',
  'strict',
  'example',
  'help',
  'version',
  'execute-query',
  'full',
]);

export async function main(argv = process.argv.slice(2), {env = process.env, cwd = process.cwd()} = {}) {
  const {command, args, flags} = parse(argv);
  try {
    if (flags.help) {
      printHelp();
      return 0;
    }
    switch (command) {
      case undefined:
      case 'help':
      case '--help':
      case '-h':
        printHelp();
        return 0;
      case 'version':
      case '--version':
        console.log(VERSION);
        return 0;
      case 'doctor':
        return cmdDoctor({env, cwd, flags});
      case 'install':
        return cmdInstall({env, cwd, flags});
      case 'plan':
        return cmdPlan({env, cwd, flags, args});
      case 'principal':
        return cmdPrincipal({env, cwd, flags});
      case 'implementation':
        return cmdImplementation({env, cwd, flags});
      case 'research':
        return cmdResearch({env, cwd, flags});
      case 'jev':
        return await cmdJev({env, cwd, flags});
      case 'verify-session':
        return cmdVerifySession({env, cwd, flags});
      case 'receipts':
        return cmdReceipts({env, cwd, flags, args});
      default:
        fail(`Unknown command: ${command}`);
    }
  } catch (error) {
    if (flags.json) {
      console.log(JSON.stringify({ok: false, error: error instanceof Error ? error.message : String(error)}, null, 2));
    } else {
      console.error(`orca-team: ${error instanceof Error ? error.message : String(error)}`);
    }
    return 1;
  }
}

function parse(argv) {
  const positional = [];
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const equals = arg.indexOf('=');
    if (equals > 2) {
      flags[arg.slice(2, equals)] = arg.slice(equals + 1);
      continue;
    }
    const name = arg.slice(2);
    if (BOOLEAN_FLAGS.has(name)) {
      flags[name] = true;
      continue;
    }
    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith('--')) {
      flags[name] = next;
      index += 1;
    } else {
      flags[name] = true;
    }
  }
  return {command: positional.shift(), args: positional, flags};
}

function fail(message) {
  const error = new Error(message);
  error.userFacing = true;
  throw error;
}

function printHelp() {
  console.log(`orca-team ${VERSION} — opt-in Orca team harness

Usage:
  orca-team <command> [options]

Commands:
  doctor                         Check Orca, OpenCode, Codex, Antigravity, Jev key, and global install
  install [--dry-run]            Install the opt-in harness globally (roles, launcher, instruction blocks)
  plan <role>                    Print exact commands without launching anything
  principal                      Start the OpenCode DeepSeek principal (run from a plain shell)
  implementation --task-file <f> Dispatch the sole Codex gpt-6.1-sol worker at low or high effort
  research --task-file <f>       Dispatch an Antigravity research worker
  jev [--example|--state-file]   Ask Jev for a typed, advisory-only orchestration judgment
  verify-session --session <id>  Read-only proof of the model variant in an OpenCode principal session
  receipts list|show|resume      Inspect durable launch receipts and recovery commands

Common flags:
  --json                         Machine-readable output
  --worktree <selector>          Orca worktree selector (default: current)
  --effort <low|high>            Codex implementation effort (default: high)
  --dry-run                      Build and print the plan, execute nothing
  --help                         Show this help

Examples:
  orca-team install
  orca-team principal --task-file task.md
  orca-team implementation --task-file task.md --effort low --title "Scoped fix"
  orca-team implementation --task-file task.md --effort high --title "Behavior change"
  orca-team implementation --task-id <failed-task-id> --retry-of <failed-dispatch-id> --title "Retry"
  orca-team research --task-file research.md --title "CLI semantics"
  orca-team jev --example --json
  orca-team verify-session --session <session-id> --json
`);
}

function cmdDoctor({env, cwd, flags}) {
  const orca = tryResolveOrca(env, flags);
  const status = orca.path ? runCommand([orca.path, 'status', '--json'], {cwd, env, timeoutMs: 15_000}) : null;
  const statusPayload = status?.unwrapped ?? status?.payload ?? null;
  const opencode = runCommand(['opencode2', '--version'], {cwd, env, timeoutMs: 10_000});
  const codex = runCommand(['codex', '--version'], {cwd, env, timeoutMs: 10_000});
  const agy = runCommand(['agy', '--version'], {cwd, env, timeoutMs: 10_000});
  const key = keyFileStatus({env});
  const envKey = Boolean(env.TYPESAFE_API_KEY);
  const nodeSqlite = hasNodeSqlite();
  const home = harnessHome(env);
  const localBinDir = env.ORCA_HARNESS_LOCAL_BIN || path.join(homeDir(env), '.local', 'bin');
  const link = env.ORCA_HARNESS_LINK || path.join(localBinDir, 'orca-team');
  const instructions = INSTRUCTION_TARGETS.map(target => {
    const file = target.file(env);
    let managed = false;
    try {
      managed = fs.readFileSync(file, 'utf8').includes('BEGIN orca-harness');
    } catch {
      managed = false;
    }
    return {id: target.id, file, managed};
  });
  const report = {
    ok: true,
    version: VERSION,
    node: process.version,
    cwd,
    orca: {
      path: orca.path,
      source: orca.source,
      runtimeReachable: statusPayload?.runtime?.reachable ?? null,
      appVersion: statusPayload?.app?.version ?? null,
    },
    opencode2: {
      installed: opencode.ok,
      version: firstLine(opencode.stdout) || null,
    },
    codex: {
      installed: codex.ok,
      version: firstLine(codex.stdout) || null,
    },
    agy: {
      installed: agy.ok,
      version: firstLine(agy.stdout) || null,
    },
    typesafe: {
      envKey,
      keyFile: key.keyFile,
      keyFileExists: key.exists,
      keyFileMode: key.mode,
      keyFileSecure: key.secure,
      effectiveSource: envKey ? 'env' : key.exists && key.secure ? 'file' : null,
    },
    nodeSqlite,
    harness: {
      home,
      homeExists: fs.existsSync(home),
      launcherLink: link,
      launcherExists: fs.existsSync(link),
      wrapperExists: fs.existsSync(path.join(home, 'bin', 'opencode-principal.sh')),
      configScriptExists: fs.existsSync(path.join(home, 'bin', 'opencode-principal-config.mjs')),
      instructionTargets: instructions,
    },
    receiptsDir: receiptsDir(env),
    boundary:
      'Orca does not automatically adopt this harness in every plain session. It is opt-in through orca-team or an explicit user request.',
  };
  report.ok =
    report.orca.runtimeReachable === true &&
    report.opencode2.installed &&
    report.codex.installed &&
    report.agy.installed &&
    nodeSqlite &&
    (envKey || (key.exists && key.secure)) &&
    report.harness.launcherExists &&
    report.harness.wrapperExists &&
    report.harness.configScriptExists &&
    instructions.every(target => target.managed);

  if (flags.json) printJson(report);
  else printDoctor(report);
  return report.ok ? 0 : 1;
}

function printDoctor(report) {
  console.log(`orca-team ${report.version}`);
  console.log(`node: ${report.node}`);
  console.log(`cwd: ${report.cwd}`);
  console.log(`orca: ${report.orca.path} (${report.orca.source}) runtime=${report.orca.runtimeReachable}`);
  console.log(`opencode2: ${report.opencode2.installed ? report.opencode2.version : 'MISSING'}`);
  console.log(`codex: ${report.codex.installed ? report.codex.version : 'MISSING'}`);
  console.log(`agy: ${report.agy.installed ? report.agy.version : 'MISSING'}`);
  console.log(
    `TypeSafe: env=${report.typesafe.envKey} file=${report.typesafe.keyFileExists ? `${report.typesafe.keyFileMode}` : 'missing'} secure=${report.typesafe.keyFileSecure}`,
  );
  console.log(`node:sqlite: ${report.nodeSqlite ? 'available' : 'MISSING (verify-session needs it)'}`);
  console.log(`harness: ${report.harness.home} launcher=${report.harness.launcherExists}`);
  console.log(
    `  wrapper=${report.harness.wrapperExists} config-script=${report.harness.configScriptExists}`,
  );
  for (const target of report.harness.instructionTargets) {
    console.log(`  ${target.id}: ${target.managed ? 'managed block present' : 'NO managed block'} (${target.file})`);
  }
  console.log(`receipts: ${report.receiptsDir}`);
  console.log(`boundary: ${report.boundary}`);
  console.log(report.ok ? 'doctor: OK' : 'doctor: NEEDS ATTENTION');
}

function cmdInstall({env, cwd, flags}) {
  const home = harnessHome(env);
  if (path.resolve(SOURCE_ROOT) === path.resolve(home)) {
    fail('Install from the tracked project checkout, not from the installed copy.');
  }
  const result = installGlobal({
    sourceRoot: SOURCE_ROOT,
    env,
    dryRun: Boolean(flags['dry-run']),
  });
  if (flags.json) printJson(result);
  else {
    console.log(`orca-team ${result.version} ${result.dryRun ? 'install plan' : 'installed'}`);
    console.log(`harness: ${result.harnessHome}`);
    console.log(`launcher: ${result.link}`);
    for (const action of result.actions) {
      console.log(`  ${action.action}: ${action.target}${action.changed === false ? ' (unchanged)' : ''}`);
    }
    for (const backup of result.backups) console.log(`  backup: ${backup.target} -> ${backup.backup}`);
    console.log(`boundary: ${result.manifest.boundary}`);
  }
  return 0;
}

function cmdPlan({env, cwd, flags, args}) {
  const role = args[0];
  if (!role) fail('Usage: orca-team plan <principal|implementation|research|jev>');
  const orca = tryResolveOrca(env, flags);
  if (role === 'principal') {
    const taskInput = flags.task
      ? {task: String(flags.task)}
      : flags['task-file']
        ? {taskFile: path.resolve(String(flags['task-file']))}
        : {};
    const plan = planPrincipal({
      orcaPath: orca.path,
      wrapperPath: resolveOpencodePrincipalWrapper({env, sourceRoot: SOURCE_ROOT}),
      worktree: stringFlag(flags, 'worktree', 'current'),
      title: stringFlag(flags, 'title', 'OpenCode principal'),
      sessionId: stringFlag(flags, 'session', buildSessionId()),
      ...taskInput,
      focus: Boolean(flags.focus),
      timeoutMs: numberFlag(flags, 'timeout-ms', 90_000),
    });
    return printPlan(plan, flags);
  }
  if (role === 'implementation') {
    const plan = planImplementation({
      orcaPath: orca.path,
      taskFile: stringFlag(flags, 'task-file', '<task-file>'),
      taskId: optionalString(flags['task-id']),
      retryOf: optionalString(flags['retry-of']),
      worktree: stringFlag(flags, 'worktree', 'current'),
      title: stringFlag(flags, 'title', 'Implementation'),
      effort: stringFlag(flags, 'effort', IMPLEMENTATION.defaultEffort),
      runId: optionalString(flags.run),
    });
    return printPlan(plan, flags);
  }
  if (role === 'research') {
    const plan = planResearch({
      orcaPath: orca.path,
      taskFile: stringFlag(flags, 'task-file', '<task-file>'),
      worktree: stringFlag(flags, 'worktree', 'current'),
      title: stringFlag(flags, 'title', 'Research'),
      model: optionalString(flags.model),
      runId: optionalString(flags.run),
    });
    return printPlan(plan, flags);
  }
  if (role === 'jev') {
    const plan = {
      role: 'jev',
      steps: [{name: 'jev-advisory', argv: ['orca-team', 'jev', '--example', '--json']}],
      notes: ['Advisory only; the OpenCode principal decides. Confidence is not permission.'],
    };
    return printPlan(plan, flags);
  }
  fail(`Unknown plan role: ${role}`);
}

function printPlan(plan, flags) {
  if (flags.json) {
    printJson({
      ok: true,
      role: plan.role,
      model: plan.model ?? null,
      effort: plan.effort ?? null,
      worktree: plan.worktree ?? null,
      taskId: plan.taskId ?? null,
      retryOf: plan.retryOf ?? null,
      notes: plan.notes ?? [],
      steps: plan.steps.map(step => ({
        name: step.name,
        argv: step.argv,
        command: formatArgv(step.argv),
        uses: step.uses ?? null,
      })),
    });
  } else {
    console.log(`Plan: ${plan.role}`);
    if (plan.model) console.log(`model: ${plan.model}${plan.effort ? ` (${plan.effort})` : ''}`);
    for (const step of plan.steps) {
      console.log(`\n[${step.name}]`);
      console.log(formatArgv(step.argv));
    }
    for (const note of plan.notes ?? []) console.log(`\nnote: ${note}`);
  }
  return 0;
}

function cmdPrincipal({env, cwd, flags}) {
  assertLaunchGuard('principal', env);
  const orca = tryResolveOrca(env, flags);
  const task = prepareTask({flags, env, dryRun: Boolean(flags['dry-run'])});
  const plan = planPrincipal({
    orcaPath: orca.path,
    wrapperPath: resolveOpencodePrincipalWrapper({env, sourceRoot: SOURCE_ROOT}),
    worktree: stringFlag(flags, 'worktree', 'current'),
    title: stringFlag(flags, 'title', 'OpenCode principal'),
    prompt: optionalString(flags.prompt),
    task: task?.text ?? null,
    taskFile: task?.path ?? null,
    focus: Boolean(flags.focus),
    sessionId: stringFlag(flags, 'session', buildSessionId()),
    timeoutMs: numberFlag(flags, 'timeout-ms', 90_000),
  });
  if (flags['dry-run']) return printPlan(plan, flags);
  const receipt = createReceipt({role: 'principal', plan, cwd, env, taskFile: task?.path ?? null});
  const completed = runPlan({receipt, plan, cwd, env, timeoutMs: 180_000});
  const verification = verifySessionModel({
    sessionId: completed.sessionId,
    expected: completed.plan.expectedModel,
    dbPath: env.OPENCODE_DB || undefined,
  });
  applyPrincipalVerification(completed, verification);
  saveReceipt(completed, env);
  printLaunchReceipt(completed, flags, env);
  if (verification.status === 'mismatch') return 4;
  if (verification.status !== 'high' && completed.status === 'awaiting_verification') return 2;
  return completed.status === 'failed' ? 1 : 0;
}

function cmdImplementation({env, cwd, flags}) {
  assertLaunchGuard('implementation', env);
  const orca = tryResolveOrca(env, flags);
  const taskId = optionalString(flags['task-id']);
  const retryOf = optionalString(flags['retry-of']);
  if (retryOf && !taskId) fail('--retry-of requires --task-id naming the failed task.');
  if (taskId && !retryOf) fail('--task-id is only used with --retry-of.');
  if (retryOf && (flags['task-file'] || flags.task)) {
    fail('Use --task-id/--retry-of without --task-file or --task; the failed task already has its spec.');
  }
  const effort = normalizeEffort(stringFlag(flags, 'effort', IMPLEMENTATION.defaultEffort));
  const task = retryOf ? null : prepareTask({flags, env, dryRun: Boolean(flags['dry-run'])});
  if (!retryOf && !task) fail('Implementation needs --task-file <path>, --task <text>, or --task-id/--retry-of.');
  const plan = planImplementation({
    orcaPath: orca.path,
    taskFile: task?.path ?? null,
    taskId,
    retryOf,
    worktree: stringFlag(flags, 'worktree', 'current'),
    title: stringFlag(flags, 'title', 'Implementation'),
    effort,
    runId: optionalString(flags.run),
  });
  if (flags['dry-run']) return printPlan(plan, flags);
  const receipt = createReceipt({role: 'implementation', plan, cwd, env, taskFile: task?.path ?? null});
  const completed = runPlan({receipt, plan, cwd, env, timeoutMs: 180_000});
  saveReceipt(completed, env);
  printLaunchReceipt(completed, flags, env);
  if (completed.status === 'failed') return 1;
  if (completed.status === 'uncertain') return 2;
  return 0;
}

function cmdResearch({env, cwd, flags}) {
  assertLaunchGuard('research', env);
  const orca = tryResolveOrca(env, flags);
  const task = prepareTask({flags, env, dryRun: Boolean(flags['dry-run'])});
  if (!task) fail('Research needs --task-file <path> or --task <text>.');
  const plan = planResearch({
    orcaPath: orca.path,
    taskFile: task.path,
    worktree: stringFlag(flags, 'worktree', 'current'),
    title: stringFlag(flags, 'title', 'Research'),
    model: optionalString(flags.model),
    runId: optionalString(flags.run),
  });
  if (flags['dry-run']) return printPlan(plan, flags);
  const receipt = createReceipt({role: 'research', plan, cwd, env, taskFile: task.path});
  const completed = runPlan({receipt, plan, cwd, env, timeoutMs: 180_000});
  saveReceipt(completed, env);
  printLaunchReceipt(completed, flags, env);
  return completed.status === 'failed' ? 1 : 0;
}

async function cmdJev({env, flags}) {
  const state = readAdvisoryState(flags);
  const key = resolveTypesafeKey({env});
  const result = await runJevAdvisory({
    state,
    apiKey: key.ok ? key.key : null,
    keySource: key.ok ? key.source : key.code,
    offline: Boolean(flags.offline),
    endpoint: optionalString(flags.endpoint) || DEFAULT_ENDPOINT,
    model: optionalString(flags.model) || ADVISORY_MODEL,
    timeoutMs: numberFlag(flags, 'timeout-ms', 30_000),
  });
  const evidence = redactedEvidence({
    result,
    endpoint: optionalString(flags.endpoint) || DEFAULT_ENDPOINT,
  });
  if (flags.evidence) {
    writeFileAtomic(path.resolve(flags.evidence), `${JSON.stringify(evidence, null, 2)}\n`, 0o644);
  }
  if (flags.json) {
    printJson({ok: result.status === 'ok', keySource: key.ok ? key.source : key.code, ...evidence});
  } else {
    console.log(`Jev advisory: ${result.status}`);
    console.log(`key source: ${key.ok ? key.source : key.code}`);
    if (result.status === 'ok') {
      console.log(`model: ${result.call.response.model}`);
      const route = result.advisory.route;
      console.log(
        `route: ${route.choice} (confidence ${route.confidence.toFixed(2)}, p=${route.probability.toFixed(2)})`,
      );
      console.log(`research_needed: P(yes)=${result.advisory.researchNeeded.noul.toFixed(2)}`);
      console.log(
        `evidence_sufficient: P(yes)=${result.advisory.evidenceSufficient.noul.toFixed(2)}`,
      );
      console.log(
        `review_risk: ${result.advisory.reviewRisk.score.toFixed(2)} (confidence ${result.advisory.reviewRisk.confidence.toFixed(2)})`,
      );
      console.log(`edits_app: ${result.advisory.editsApp}`);
      console.log(`escalate: ${result.escalate}`);
      if (result.escalationReasons?.length) {
        for (const reason of result.escalationReasons) console.log(`  - ${reason}`);
      }
      console.log(
        'decision: OpenCode principal only. confidence is not permission. no model command was executed.',
      );
    } else {
      console.log(`reason: ${result.reason}`);
      console.log('result: escalate to the OpenCode principal; no decision or command was derived.');
    }
    if (flags.evidence) console.log(`evidence: ${path.resolve(flags.evidence)}`);
  }
  if (result.status !== 'ok' && flags.strict) return 2;
  return 0;
}

function readAdvisoryState(flags) {
  if (flags.example) return EXAMPLE_STATE;
  if (flags['state-file']) {
    const file = path.resolve(flags['state-file']);
    const text = fs.readFileSync(file, 'utf8');
    return parseStateText(text);
  }
  if (flags.state) return parseStateText(String(flags.state));
  fail('Jev needs --example, --state-file <path>, or --state <json|text>.');
}

function parseStateText(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function cmdVerifySession({env, flags}) {
  let sessionId = optionalString(flags.session);
  if (!sessionId && flags.receipt) {
    const receipt = loadReceipt(flags.receipt, env);
    sessionId = receipt.sessionId;
  }
  if (!sessionId) fail('Usage: orca-team verify-session --session <id> [--json]');
  const expected = {
    providerID: env.ORCA_HARNESS_PRINCIPAL_PROVIDER || PRINCIPAL.providerID,
    id: env.ORCA_HARNESS_PRINCIPAL_MODEL || PRINCIPAL.model,
    variant: env.ORCA_HARNESS_PRINCIPAL_VARIANT || PRINCIPAL.variant,
  };
  const result = verifySessionModel({
    sessionId,
    expected,
    dbPath: optionalString(flags['db-path']) || undefined,
  });
  if (flags.json) printJson({ok: result.status === 'high', ...result});
  else {
    console.log(`session: ${sessionId}`);
    console.log(`verification: ${result.status}`);
    console.log(`reason: ${result.reason}`);
    for (const model of result.observed) {
      console.log(`observed: ${model.providerID}/${model.id}#${model.variant}`);
    }
    console.log(`expected: ${expected.providerID}/${expected.id}#${expected.variant}`);
  }
  if (result.status === 'high') return 0;
  if (result.status === 'mismatch') return 1;
  return 2;
}

function cmdReceipts({env, flags, args}) {
  const sub = args[0] || 'list';
  if (sub === 'list') {
    const receipts = listReceipts(env).map(receiptSummary);
    if (flags.json) printJson({ok: true, receipts});
    else {
      if (!receipts.length) console.log('No launch receipts.');
      for (const receipt of receipts) {
        console.log(
          `${receipt.id}  ${receipt.role}  ${receipt.status}  ${receipt.createdAt}  ${receipt.title ?? ''}`,
        );
      }
    }
    return 0;
  }
  const id = args[1];
  if (!id) fail(`Usage: orca-team receipts ${sub} <receipt-id>`);
  const receipt = loadReceipt(id, env);
  if (sub === 'show') {
    if (flags.json) printJson(receipt);
    else {
      console.log(JSON.stringify(receipt, null, 2));
    }
    return 0;
  }
  if (sub === 'resume') {
    const plan = recoveryPlan(receipt);
    if (flags.json) printJson({ok: true, receipt: receiptSummary(receipt), recovery: plan});
    else {
      console.log(`receipt: ${receipt.id} (${receipt.status})`);
      for (const line of plan) console.log(`- ${line}`);
      console.log('No retry was executed. Inspect first; never blind-retry worker-start.');
    }
    if (flags['execute-query']) {
      const query = receipt.recovery?.queryCommand;
      if (!query) fail('This receipt has no recorded query command.');
      const result = runCommand(query, {cwd: process.cwd(), env, timeoutMs: 60_000});
      if (flags.json) printJson({ok: result.ok, query: query, payload: result.payload});
      else console.log(result.stdout || result.stderr);
      return result.ok ? 0 : 1;
    }
    return 0;
  }
  fail(`Unknown receipts subcommand: ${sub}`);
}

function prepareTask({flags, env, dryRun = false}) {
  const taskFile = optionalString(flags['task-file']);
  const inline = optionalString(flags.task);
  if (taskFile && inline) fail('Use either --task-file or --task, not both.');
  if (taskFile) {
    if (dryRun) {
      if (taskFile === '-') {
        const text = fs.readFileSync(0, 'utf8');
        if (!text.trim()) fail('No task text arrived on stdin.');
        return {path: '<stdin-task>', text};
      }
      const file = path.resolve(taskFile);
      const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      if (text && !text.trim()) fail(`Task file is empty: ${file}`);
      return {path: file, text};
    }
    const file = taskFile === '-' ? writeTaskFromStdin(env) : path.resolve(taskFile);
    const text = fs.readFileSync(file, 'utf8');
    if (!text.trim()) fail(`Task file is empty: ${file}`);
    return {path: file, text};
  }
  if (inline) {
    if (dryRun) return {path: '<inline-task>', text: inline};
    const dir = path.join(stateHome(env), 'orca-harness', 'tasks');
    ensurePrivateDir(dir);
    const file = path.join(dir, `task-${Date.now()}-${process.pid}.md`);
    writeFileAtomic(file, `${inline.replace(/\s*$/, '')}\n`, 0o600);
    return {path: file, text: inline};
  }
  return null;
}

function writeTaskFromStdin(env) {
  const text = fs.readFileSync(0, 'utf8');
  if (!text.trim()) fail('No task text arrived on stdin.');
  const dir = path.join(stateHome(env), 'orca-harness', 'tasks');
  ensurePrivateDir(dir);
  const file = path.join(dir, `task-${Date.now()}-${process.pid}.md`);
  writeFileAtomic(file, text, 0o600);
  return file;
}

function tryResolveOrca(env, flags) {
  return resolveOrcaExecutable({
    env,
    explicit: optionalString(flags.orca),
  });
}

function printLaunchReceipt(receipt, flags, env = process.env) {
  if (flags.json) {
    printJson({ok: receipt.status !== 'failed', ...receiptSummary(receipt), receipt});
    return;
  }
  console.log(`receipt: ${receipt.id}`);
  console.log(`status: ${receipt.status}`);
  if (receipt.plan?.model) {
    console.log(
      `model: ${receipt.plan.model}${receipt.plan.effort ? ` (${receipt.plan.effort})` : ''}`,
    );
  }
  if (receipt.sessionId) console.log(`session: ${receipt.sessionId}`);
  if (receipt.terminal) console.log(`terminal: ${receipt.terminal}`);
  if (receipt.dispatchId) console.log(`dispatch: ${receipt.dispatchId}`);
  if (receipt.taskId) console.log(`task: ${receipt.taskId}`);
  if (receipt.runId) console.log(`run: ${receipt.runId}`);
  if (receipt.lastError) console.log(`lastError: ${receipt.lastError}`);
  if (receipt.orcaError) {
    console.log(`orca error: ${receipt.orcaError.code ?? 'unknown'} — ${receipt.orcaError.message ?? 'no message'}`);
    for (const step of receipt.orcaError.nextSteps ?? []) console.log(`next: ${step}`);
  }
  if (receipt.verification) {
    console.log(`verification: ${receipt.verification.status} — ${receipt.verification.reason}`);
    for (const model of receipt.verification.observed) {
      console.log(`observed model: ${model.providerID}/${model.id}#${model.variant}`);
    }
  }
  if (receipt.status === 'failed' || receipt.status === 'uncertain') {
    for (const line of recoveryPlan(receipt)) console.log(`- ${line}`);
    console.log('No retry was executed.');
  }
  if (receipt.status === 'awaiting_verification') {
    console.log(
      `next: orca-team verify-session --session ${receipt.sessionId} --json (input acceptance is not model proof)`,
    );
  }
  console.log(`receipt file: ${path.join(receiptsDir(env), `${receipt.id}.json`)}`);
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function firstLine(text) {
  return String(text ?? '').trim().split(/\r?\n/)[0] ?? '';
}

function hasNodeSqlite() {
  try {
    return typeof localRequire('node:sqlite').DatabaseSync === 'function';
  } catch {
    return false;
  }
}

function optionalString(value) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function stringFlag(flags, name, fallback = null) {
  return optionalString(flags[name]) ?? fallback;
}

function numberFlag(flags, name, fallback) {
  const raw = flags[name];
  if (raw === undefined || raw === true) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) fail(`--${name} must be a positive number`);
  return value;
}
