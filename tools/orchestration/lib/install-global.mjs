import fs from 'node:fs';
import path from 'node:path';
import {harnessHome, homeDir, configHome} from './paths.mjs';
import {ensurePrivateDir, nowIso, writeFileAtomic, writeJsonAtomic} from './util.mjs';

const MANAGED_START = '<!-- BEGIN orca-harness (managed, opt-in) -->';
const MANAGED_END = '<!-- END orca-harness (managed, opt-in) -->';
const VERSION = '1.1.0';

export const INSTRUCTION_TARGETS = Object.freeze([
  {
    id: 'codex',
    file: env => path.join(homeDir(env), '.codex', 'AGENTS.md'),
    role: 'Codex implementation worker',
    roleFile: 'roles/codex.md',
  },
  {
    id: 'opencode',
    file: env => path.join(configHome(env), 'opencode', 'AGENTS.md'),
    role: 'OpenCode principal',
    roleFile: 'roles/opencode.md',
  },
  {
    id: 'antigravity',
    file: env => path.join(homeDir(env), '.gemini', 'GEMINI.md'),
    role: 'Antigravity research worker',
    roleFile: 'roles/antigravity.md',
  },
]);

function managedBlock(target) {
  return [
    MANAGED_START,
    '## Orca team harness (opt-in)',
    '',
    'This block is installed by the reusable Orca team harness. It is deliberately opt-in: apply it only when the user explicitly asks to use the Orca team harness, the `orca-team` launcher, or supervised Orca orchestration.',
    '',
    `Your role is **${target.role}**. Read \`~/.config/orca-harness/AGENTS.md\` and \`~/.config/orca-harness/${target.roleFile}\` before acting.`,
    '',
    'Do not auto-start agents, do not recursively launch the harness, and do not apply this workflow to unrelated tasks. The OpenCode principal decides; only the Codex implementation worker edits app code; Antigravity research never edits app code; Jev is advisory only and its confidence is never permission. Use native Orca mailbox supervision and `worker_done`; never poll or build a custom scheduler.',
    '',
    'Commands: `orca-team doctor`, `orca-team principal`, `orca-team implementation --task-file <file> --effort low|high`, `orca-team research --task-file <file>`, `orca-team jev --example`, `orca-team verify-session --session <id>`.',
    MANAGED_END,
  ].join('\n');
}

export function mergeManagedBlock(existing, target) {
  const block = managedBlock(target);
  const text = String(existing ?? '');
  const start = text.indexOf(MANAGED_START);
  const end = text.indexOf(MANAGED_END);
  if (start >= 0 && end > start) {
    return `${text.slice(0, start)}${block}${text.slice(end + MANAGED_END.length)}`;
  }
  if (!text.trim()) return `${block}\n`;
  return `${text.replace(/\s*$/, '')}\n\n${block}\n`;
}

export function installGlobal({sourceRoot, env = process.env, dryRun = false} = {}) {
  if (!sourceRoot) throw new Error('sourceRoot is required');
  const home = harnessHome(env);
  const bin = path.join(home, 'bin');
  const actions = [];
  const backups = [];

  const files = [
    ['global/AGENTS.md', 'AGENTS.md', 0o644],
    ['bin/orca-team.mjs', 'bin/orca-team.mjs', 0o755],
    ['bin/opencode-principal.sh', 'bin/opencode-principal.sh', 0o755],
    ['bin/opencode-principal-config.mjs', 'bin/opencode-principal-config.mjs', 0o755],
  ];
  for (const name of fs.readdirSync(path.join(sourceRoot, 'lib'))) {
    if (name.endsWith('.mjs')) files.push([path.join('lib', name), path.join('lib', name), 0o644]);
  }
  for (const name of fs.readdirSync(path.join(sourceRoot, 'roles'))) {
    if (name.endsWith('.md')) files.push([path.join('roles', name), path.join('roles', name), 0o644]);
  }
  for (const name of fs.readdirSync(path.join(sourceRoot, 'templates'))) {
    if (name.endsWith('.md')) {
      files.push([path.join('templates', name), path.join('templates', name), 0o644]);
    }
  }

  if (!dryRun) {
    ensurePrivateDir(home);
    ensurePrivateDir(bin);
    ensurePrivateDir(path.join(home, 'lib'));
    ensurePrivateDir(path.join(home, 'roles'));
    ensurePrivateDir(path.join(home, 'templates'));
  }

  for (const [from, to, mode] of files) {
    const source = path.join(sourceRoot, from);
    const target = path.join(home, to);
    if (!fs.existsSync(source)) {
      actions.push({action: 'missing-source', source});
      continue;
    }
    actions.push({action: dryRun ? 'would-copy' : 'copy', source, target, mode: mode.toString(8)});
    if (!dryRun) {
      fs.mkdirSync(path.dirname(target), {recursive: true});
      fs.copyFileSync(source, target);
      fs.chmodSync(target, mode);
    }
  }

  // The previous Codex-principal install shipped an OpenCode implementation
  // wrapper. The implementation role is now Codex, so remove those obsolete
  // private launcher files instead of leaving a misleading copy behind.
  for (const relative of [
    'bin/opencode-implementation.sh',
    'bin/opencode-implementation-config.mjs',
  ]) {
    const target = path.join(home, relative);
    if (!fs.existsSync(target)) continue;
    if (dryRun) {
      actions.push({action: 'would-remove-obsolete', target});
      continue;
    }
    const backup = uniqueBackup(target);
    fs.renameSync(target, backup);
    backups.push({target, backup});
    actions.push({action: 'remove-obsolete', target, backup});
  }

  const versionFile = path.join(home, 'VERSION');
  actions.push({action: dryRun ? 'would-write' : 'write', target: versionFile, value: VERSION});
  if (!dryRun) writeFileAtomic(versionFile, `${VERSION}\n`, 0o644);

  const entry = path.join(home, 'bin', 'orca-team.mjs');
  const localBinDir = env.ORCA_HARNESS_LOCAL_BIN || path.join(homeDir(env), '.local', 'bin');
  const link = env.ORCA_HARNESS_LINK || path.join(localBinDir, 'orca-team');
  actions.push({action: dryRun ? 'would-link' : 'link', target: link, value: entry});
  if (!dryRun) {
    fs.mkdirSync(localBinDir, {recursive: true});
    if (fs.existsSync(link) || isSymlink(link)) {
      const current = fs.lstatSync(link);
      const same = current.isSymbolicLink() && path.resolve(path.dirname(link), fs.readlinkSync(link)) === path.resolve(entry);
      if (!same) {
        const backup = uniqueBackup(link);
        fs.renameSync(link, backup);
        backups.push({target: link, backup});
      }
    }
    if (!fs.existsSync(link)) fs.symlinkSync(entry, link);
  }

  for (const target of INSTRUCTION_TARGETS) {
    const file = target.file(env);
    const exists = fs.existsSync(file);
    const before = exists ? fs.readFileSync(file, 'utf8') : '';
    const after = mergeManagedBlock(before, target);
    actions.push({
      action: dryRun ? 'would-update' : 'update',
      target: file,
      changed: before !== after,
      exists,
    });
    if (!dryRun && before !== after) {
      if (exists) {
        const backup = uniqueBackup(file);
        fs.copyFileSync(file, backup);
        backups.push({target: file, backup});
      }
      fs.mkdirSync(path.dirname(file), {recursive: true});
      writeFileAtomic(file, after, exists ? fs.statSync(file).mode & 0o777 : 0o644);
    }
  }

  const manifest = {
    version: VERSION,
    installedAt: nowIso(),
    sourceRoot: path.resolve(sourceRoot),
    harnessHome: home,
    link,
    backups,
    actions,
    boundary:
      'The harness is opt-in. Orca does not automatically attach a team to every plain agent session; run `orca-team principal` or ask an agent to use the harness.',
  };
  if (!dryRun) writeJsonAtomic(path.join(home, 'install-manifest.json'), manifest, 0o600);
  return {dryRun, harnessHome: home, link, version: VERSION, actions, backups, manifest};
}

function isSymlink(file) {
  try {
    return fs.lstatSync(file).isSymbolicLink();
  } catch {
    return false;
  }
}

function uniqueBackup(file) {
  const base = `${file}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  let candidate = base;
  let index = 1;
  while (fs.existsSync(candidate)) {
    candidate = `${base}-${index++}`;
  }
  return candidate;
}
