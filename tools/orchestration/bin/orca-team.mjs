#!/usr/bin/env node
import {main} from '../lib/cli.mjs';

const code = await main();
process.exitCode = code;
