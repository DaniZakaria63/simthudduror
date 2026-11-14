#!/usr/bin/env node
/**
 * Print the private OpenCode config for the principal. See
 * lib/opencode-principal-config.mjs for why MCP is disabled for this process.
 */
import {buildOpencodePrincipalConfig} from '../lib/opencode-principal-config.mjs';

process.stdout.write(JSON.stringify(buildOpencodePrincipalConfig()));
