import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {buildOpencodePrincipalConfig} from '../lib/opencode-principal-config.mjs';

function envWithConfig(content) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'orca-harness-opencode-config-'));
  const file = path.join(root, 'opencode.json');
  if (content !== undefined) fs.writeFileSync(file, content);
  return {env: {HOME: root, XDG_CONFIG_HOME: path.join(root, '.config'), OPENCODE_CONFIG: file}, file};
}

test('private principal config pins high and disables MCP without copying secrets', () => {
  const {env} = envWithConfig(
    JSON.stringify({
      mcp: {
        servers: {
          context7: {
            type: 'remote',
            url: 'https://mcp.example.test/mcp',
            headers: {CONTEXT7_API_KEY: 'must-not-appear'},
          },
          localTool: {
            type: 'local',
            command: ['local-tool', 'mcp'],
            environment: {SECRET: 'must-not-appear'},
          },
          ignored: {type: 'remote'},
        },
      },
    }),
  );
  const config = buildOpencodePrincipalConfig({env});
  assert.deepEqual(config.agents.build.model, {
    providerID: 'opencode-go',
    model: 'deepseek-v4.1-flash',
    variant: 'high',
  });
  assert.deepEqual(config.mcp.servers.context7, {
    type: 'remote',
    url: 'https://mcp.example.test/mcp',
    disabled: true,
  });
  assert.deepEqual(config.mcp.servers.localTool, {
    type: 'local',
    command: ['local-tool', 'mcp'],
    disabled: true,
  });
  assert.equal(config.mcp.servers.ignored, undefined);
  const text = JSON.stringify(config);
  assert.equal(text.includes('must-not-appear'), false);
  assert.equal(text.includes('CONTEXT7_API_KEY'), false);
  assert.equal(text.includes('SECRET'), false);
});

test('missing or malformed global config still produces the high agent config', () => {
  const missing = buildOpencodePrincipalConfig({env: envWithConfig(undefined).env});
  assert.equal(missing.mcp, undefined);
  assert.equal(missing.agents.build.model.variant, 'high');

  const malformed = buildOpencodePrincipalConfig({env: envWithConfig('{not json').env});
  assert.equal(malformed.mcp, undefined);
  assert.equal(malformed.default_agent, 'build');
});

test('OPENCODE_CONFIG_DIR is honored when selecting the real global config', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'orca-harness-opencode-dir-'));
  const dir = path.join(root, 'profile');
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(
    path.join(dir, 'opencode.json'),
    JSON.stringify({mcp: {servers: {tool: {type: 'remote', url: 'https://example.test/mcp'}}}}),
  );
  const config = buildOpencodePrincipalConfig({
    env: {HOME: root, XDG_CONFIG_HOME: path.join(root, '.config'), OPENCODE_CONFIG_DIR: dir},
  });
  assert.equal(config.mcp.servers.tool.disabled, true);
});
