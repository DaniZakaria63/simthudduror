#!/usr/bin/env node
/**
 * Reproduce the Jev (TypeSafe) architecture review that drove this migration.
 *
 *   export TYPESAFE_API_KEY="..."
 *   node tools/jev/run.mjs            # all request files
 *   node tools/jev/run.mjs architecture
 *
 * Each request file is a full System One payload (state + questions). The script
 * prints the typed answers (Choice/Noul probabilities) and the recorded answers
 * live in docs/evidence/. No credential is ever stored in the repository.
 */
import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REQUESTS = path.join(HERE, 'requests');
const API = 'https://api.typesafe.ai/v1/systemone';

const apiKey = process.env.TYPESAFE_API_KEY;
if (!apiKey) {
  console.error('TYPESAFE_API_KEY is not set (create a key at https://console.typesafe.ai/keys).');
  process.exit(1);
}

const only = process.argv[2];
const files = (await readdir(REQUESTS))
  .filter(name => name.endsWith('.json'))
  .filter(name => !only || name.includes(only))
  .sort();

for (const file of files) {
  const payload = JSON.parse(await readFile(path.join(REQUESTS, file), 'utf8'));
  const response = await fetch(API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    console.error(`${file}: HTTP ${response.status}`);
    console.error((await response.text()).slice(0, 2000));
    process.exitCode = 1;
    continue;
  }

  const result = await response.json();
  console.log(`\n=== ${file} (model: ${result.model}) ===`);
  for (const [name, answer] of Object.entries(result.answers)) {
    if (answer.type === 'choice') {
      const probabilities = Object.entries(answer.probabilities)
        .map(([option, p]) => `${option}=${(p * 100).toFixed(0)}%`)
        .join(' ');
      console.log(`${name}: ${answer.choice} (confidence ${answer.confidence.toFixed(2)}) — ${probabilities}`);
    } else if (answer.type === 'noul') {
      console.log(`${name}: P(yes)=${answer.noul.toFixed(2)}`);
    } else if (answer.type === 'score') {
      console.log(`${name}: score=${answer.score} (confidence ${answer.confidence.toFixed(2)})`);
    } else {
      console.log(`${name}: ${JSON.stringify(answer)}`);
    }
  }
}
