import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export function nowIso() {
  return new Date().toISOString();
}

export function randomId(prefix = '') {
  const body = crypto.randomBytes(8).toString('hex');
  return prefix ? `${prefix}-${body}` : body;
}

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function canonicalJson(value) {
  return JSON.stringify(sortJson(value));
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [key, sortJson(value[key])]),
    );
  }
  return value;
}

export function truncate(value, max = 4000) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function redactText(value) {
  return String(value ?? '')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer <redacted>')
    .replace(/(TYPESAFE_API_KEY\s*=\s*)[^\s"']+/g, '$1<redacted>')
    .replace(/\b(?:sk|ctx7sk)-[A-Za-z0-9_-]{8,}\b/g, '<redacted>');
}

export function ensurePrivateDir(dir) {
  fs.mkdirSync(dir, {recursive: true, mode: 0o700});
  try {
    fs.chmodSync(dir, 0o700);
  } catch {
    // Best effort; the caller checks the actual mode when it matters.
  }
}

export function writeFileAtomic(file, content, mode = 0o600) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, {recursive: true});
  const temp = path.join(dir, `.${path.basename(file)}.${process.pid}.${randomId()}.tmp`);
  fs.writeFileSync(temp, content, {mode});
  fs.chmodSync(temp, mode);
  fs.renameSync(temp, file);
}

export function writeJsonAtomic(file, value, mode = 0o600) {
  writeFileAtomic(file, `${JSON.stringify(value, null, 2)}\n`, mode);
}

export function readJsonFile(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function readTextFile(file) {
  return fs.readFileSync(file, 'utf8');
}

export function fileMode(file) {
  return fs.statSync(file).mode & 0o777;
}

export function shellQuotePosix(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:@%+,-]+$/.test(text)) return text;
  return `'${text.replaceAll("'", `'\\''`)}'`;
}

/** Bounded synchronous wait for a startup readiness gate; not a polling loop. */
export function sleepSync(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return;
  const buffer = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(buffer), 0, 0, ms);
}

export function formatArgv(argv) {
  return argv.map(shellQuotePosix).join(' ');
}

export function parseJsonOutput(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    // Orca may print human-readable warnings around the JSON object.
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function normalizeOrcaPayload(payload) {
  if (payload && typeof payload === 'object' && 'result' in payload) {
    return payload.result;
  }
  return payload;
}

export function unique(values) {
  return [...new Set(values)];
}
