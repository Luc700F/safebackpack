/**
 * Runs a command with the variables from .env.local in its environment.
 *
 *   tsx scripts/with-env.ts vitest run …
 *
 * Next.js loads .env.local by itself; test runners and one-off scripts do not.
 * Rather than teaching each of them, this puts the values in place and hands
 * over. Nothing is printed, so a secret never reaches the terminal scrollback.
 */

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

function loadEnvFile(path: string): Record<string, string> {
  const values: Record<string, string> = {};

  let contents: string;
  try {
    contents = readFileSync(path, 'utf8');
  } catch {
    return values;
  }

  for (const line of contents.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;

    values[trimmed.slice(0, separator).trim()] = trimmed
      .slice(separator + 1)
      .trim();
  }

  return values;
}

const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error('Usage: tsx scripts/with-env.ts <command> [args…]');
  process.exit(1);
}

const child = spawn(command, args, {
  stdio: 'inherit',
  // Real environment wins, so CI can override without editing a file.
  env: { ...loadEnvFile('.env.local'), ...process.env },
  shell: process.platform === 'win32',
});

child.on('exit', (code) => process.exit(code ?? 1));
