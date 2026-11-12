import { readFile } from 'node:fs/promises';
import path from 'node:path';

// A static export needs every dynamic page listed at build time. These helpers read the snapshot files that
// npm run build:snapshot wrote, and return nothing in the normal app, where pages are rendered on demand.
const snapshotDir = () => path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', 'snapshot');
const snapshotBuild = () => process.env.NEXT_PUBLIC_SNAPSHOT === '1';

export async function snapshotLocationParams() {
  if (!snapshotBuild()) return [];
  const list = JSON.parse(await readFile(path.join(snapshotDir(), 'locations.json'), 'utf8'));
  return list.locations.map((location) => ({ id: location.id }));
}

export async function snapshotFollowUpParams() {
  if (!snapshotBuild()) return [];
  const params = [];
  for (const { id } of await snapshotLocationParams()) {
    const detail = JSON.parse(await readFile(path.join(snapshotDir(), 'locations', `${id}.json`), 'utf8'));
    for (const followUp of detail.followUps) params.push({ id, followUpId: followUp.id });
  }
  // A static export must generate at least one page for every dynamic route. A snapshot with no saved follow-ups
  // gets one page that shows "Follow-up unavailable".
  return params.length ? params : [{ id: (await snapshotLocationParams())[0]?.id ?? 'none', followUpId: 'none' }];
}
