import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SAMPLE_DIR, nextDevCommand } from '../scripts/sample.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

test('the sample store path is a real file path, not a URL pathname', () => {
  assert.equal(SAMPLE_DIR, path.join(root, '.data-sample'));
  assert.ok(path.isAbsolute(SAMPLE_DIR));
  assert.doesNotMatch(SAMPLE_DIR, /^\/[A-Za-z]:/, 'a leading slash before a drive letter is the Windows URL pathname mistake');
});

test('the sample server starts through Node with the store location in the environment, not through shell syntax', () => {
  const { command, args, env } = nextDevCommand(SAMPLE_DIR);
  assert.equal(command, process.execPath);
  assert.ok(existsSync(args[0]), 'Next’s command file exists');
  assert.ok(args[0].endsWith(path.join('next', 'dist', 'bin', 'next')));
  assert.deepEqual(args.slice(1), ['dev']);
  assert.equal(env.FSF_DATA_DIR, SAMPLE_DIR);
});

test('no npm script needs Unix-only shell syntax', () => {
  const { scripts } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  for (const [name, command] of Object.entries(scripts)) {
    assert.doesNotMatch(command, /^[A-Za-z_][A-Za-z0-9_]*=/, `${name} sets an environment variable inline, which Windows shells do not support`);
    assert.ok(!command.includes('*'), `${name} uses a wildcard that Windows shells do not expand`);
  }
});
