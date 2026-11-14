import fs from 'node:fs';
import path from 'node:path';
import {PRINCIPAL} from './commands.mjs';

/**
 * Build the private OpenCode config for the principal.
 *
 * Keep the user's real HOME/XDG data and credentials. Disable MCP servers only
 * for this process because a failing MCP startup modal blocks the composer.
 * Never copy headers, environment, or other secret-bearing server fields.
 */
export function buildOpencodePrincipalConfig({env = process.env, fsImpl = fs} = {}) {
  const home = env.HOME || '';
  const configHome = env.XDG_CONFIG_HOME || path.join(home, '.config');
  const configDir =
    env.OPENCODE_CONFIG_DIR || env.ORCA_OPENCODE_CONFIG_DIR || path.join(configHome, 'opencode');
  const configPath = env.OPENCODE_CONFIG || path.join(configDir, 'opencode.json');

  let globalConfig = {};
  try {
    globalConfig = JSON.parse(fsImpl.readFileSync(configPath, 'utf8'));
  } catch {
    globalConfig = {};
  }

  const disabledServers = {};
  for (const [name, server] of Object.entries(globalConfig?.mcp?.servers ?? {})) {
    if (!server || typeof server !== 'object') continue;
    if (server.type === 'remote' && typeof server.url === 'string') {
      disabledServers[name] = {type: 'remote', url: server.url, disabled: true};
    } else if (server.type === 'local' && Array.isArray(server.command)) {
      disabledServers[name] = {type: 'local', command: server.command, disabled: true};
    }
  }

  return {
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
    ...(Object.keys(disabledServers).length > 0 ? {mcp: {servers: disabledServers}} : {}),
  };
}
