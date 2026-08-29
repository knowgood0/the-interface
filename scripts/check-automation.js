// Lightweight local validation for the automated-publishing configuration.
import { readFile } from 'node:fs/promises';

const wrangler = await readFile(new URL('../automation/wrangler.toml', import.meta.url), 'utf8');
const required = ['name = "the-interface-publisher"', 'main = "worker.js"', 'crons ='];
for (const item of required) {
  if (!wrangler.includes(item)) throw new Error(`Automation config is missing: ${item}`);
}
console.log('Automation configuration looks valid. API keys are intentionally not stored in the repository.');
