import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// fileURLToPath, not URL.pathname: on Windows the pathname is "/C:/Users/..." and is not a usable path.
export const SAMPLE_DIR = fileURLToPath(new URL('../.data-sample', import.meta.url));

// The command that starts the app on the sample store. It runs Next through Node with the store location in the
// environment, so it needs no shell syntax that differs between Windows and macOS or Linux.
export function nextDevCommand(dir) {
  const nextBin = createRequire(import.meta.url).resolve('next/dist/bin/next');
  return { command: process.execPath, args: [nextBin, 'dev'], env: { ...process.env, FSF_DATA_DIR: dir } };
}
