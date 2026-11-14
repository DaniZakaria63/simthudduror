import os from 'node:os';
import path from 'node:path';

export function homeDir(env = process.env) {
  return env.HOME || os.homedir();
}

export function configHome(env = process.env) {
  return env.XDG_CONFIG_HOME || path.join(homeDir(env), '.config');
}

export function dataHome(env = process.env) {
  return env.XDG_DATA_HOME || path.join(homeDir(env), '.local', 'share');
}

export function stateHome(env = process.env) {
  return env.XDG_STATE_HOME || path.join(homeDir(env), '.local', 'state');
}

export function harnessHome(env = process.env) {
  return env.ORCA_HARNESS_HOME || path.join(configHome(env), 'orca-harness');
}

export function harnessBinDir(env = process.env) {
  return path.join(harnessHome(env), 'bin');
}

export function receiptsDir(env = process.env) {
  return path.join(stateHome(env), 'orca-harness', 'receipts');
}

export function opencodeDbPath(env = process.env) {
  return env.OPENCODE_DB || path.join(dataHome(env), 'opencode', 'opencode.db');
}

export function typesafeKeyFile(env = process.env) {
  return env.ORCA_HARNESS_TYPESAFE_ENV || path.join(harnessHome(env), 'typesafe.env');
}
