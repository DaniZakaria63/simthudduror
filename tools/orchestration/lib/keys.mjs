import fs from 'node:fs';
import {fileMode} from './util.mjs';
import {typesafeKeyFile} from './paths.mjs';

/**
 * Resolve the TypeSafe key without ever logging or returning the key to evidence.
 * Precedence: TYPESAFE_API_KEY, then the private harness .env file.
 */
export function resolveTypesafeKey({env = process.env, keyFile = typesafeKeyFile(env), fsImpl = fs} = {}) {
  const envKey = typeof env.TYPESAFE_API_KEY === 'string' ? env.TYPESAFE_API_KEY.trim() : '';
  if (envKey) {
    return {ok: true, key: envKey, source: 'env', keyFile: null};
  }

  let mode;
  try {
    mode = fsImpl.statSync(keyFile).mode & 0o777;
  } catch (error) {
    return {
      ok: false,
      source: 'file',
      keyFile,
      code: error && error.code === 'ENOENT' ? 'missing_key' : 'key_file_unreadable',
      message:
        error && error.code === 'ENOENT'
          ? `No TYPESAFE_API_KEY in the environment and no private key file at ${keyFile}.`
          : `Could not stat the private key file at ${keyFile}.`,
    };
  }

  if ((mode & 0o077) !== 0) {
    return {
      ok: false,
      source: 'file',
      keyFile,
      code: 'insecure_key_file',
      message: `The private key file ${keyFile} is mode ${mode.toString(8)}; run chmod 600 on it.`,
    };
  }

  let text;
  try {
    text = fsImpl.readFileSync(keyFile, 'utf8');
  } catch {
    return {
      ok: false,
      source: 'file',
      keyFile,
      code: 'key_file_unreadable',
      message: `Could not read the private key file at ${keyFile}.`,
    };
  }

  const key = parseDotEnvValue(text, 'TYPESAFE_API_KEY');
  if (!key) {
    return {
      ok: false,
      source: 'file',
      keyFile,
      code: 'missing_key',
      message: `The private key file ${keyFile} does not define TYPESAFE_API_KEY.`,
    };
  }

  return {ok: true, key, source: 'file', keyFile};
}

export function parseDotEnvValue(text, name) {
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim().replace(/^export\s+/, '');
    if (!line.startsWith(`${name}=`)) continue;
    let value = line.slice(name.length + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return value || null;
  }
  return null;
}

export function keyFileStatus({env = process.env, keyFile = typesafeKeyFile(env), fsImpl = fs} = {}) {
  try {
    const mode = fsImpl.statSync(keyFile).mode & 0o777;
    return {exists: true, mode: mode.toString(8), secure: (mode & 0o077) === 0, keyFile};
  } catch {
    return {exists: false, mode: null, secure: false, keyFile};
  }
}
