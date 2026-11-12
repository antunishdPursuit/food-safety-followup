import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getLocationDetail, listLocations } from './service.js';

// Writes what the app's two read endpoints return, as plain files, so a static site can show the same screens:
//   <outDir>/locations.json            the list (GET /api/locations)
//   <outDir>/locations/<id>.json       one location (GET /api/locations/:id?regionalMonths=12)
export async function writeSnapshot({ dir, outDir, now = new Date() }) {
  const list = await listLocations({ dir, now });
  await rm(outDir, { recursive: true, force: true });
  await mkdir(path.join(outDir, 'locations'), { recursive: true });
  await writeFile(path.join(outDir, 'locations.json'), JSON.stringify(list));
  for (const location of list.locations) {
    const detail = await getLocationDetail(location.id, { dir, now, regionalMonths: 12 });
    await writeFile(path.join(outDir, 'locations', `${location.id}.json`), JSON.stringify(detail));
  }
  return { locations: list.locations.length, builtAt: now.toISOString() };
}
