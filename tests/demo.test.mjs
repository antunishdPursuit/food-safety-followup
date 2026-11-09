import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { seedDemoChecks } from '../lib/server/demo.js';
import { matchLocationsToCity, refreshInspections, syncDirectory } from '../lib/server/importer.js';
import { getLocationDetail } from '../lib/server/service.js';
import { setCheckLink } from '../lib/server/mutations.js';

const snapshot = {
  fetchedAt: '2026-11-09T12:00:00.000Z', sourceUrl: 'https://www.sweetgreen.com/locations',
  locations: [
    { id: 'union-square', name: 'Sweetgreen Union Square', street: '870 Broadway', zip: '10003', address: 'a', sourceUrl: 'u' },
    { id: 'dumbo', name: 'Sweetgreen DUMBO', street: '50 Washington St', zip: '11201', address: 'b', sourceUrl: 'u' },
  ],
};
const establishments = [
  { camis: '1', dba: 'SWEETGREEN', building: '870', street: 'BROADWAY', zipcode: '10003', latitude: '40.73', longitude: '-73.99' },
  { camis: '2', dba: 'SWEETGREEN', building: '50', street: 'WASHINGTON STREET', zipcode: '11201', latitude: '40.70', longitude: '-73.99' },
];
const row = (camis, date, code, description = `Finding ${code}`) => ({ camis, inspection_date: `${date}T00:00:00.000`, inspection_type: 'Cycle', violation_code: code, violation_description: description, critical_flag: 'Critical' });
const client = (rows) => ({ findSweetgreenEstablishments: async () => establishments, findEstablishmentsAtAddress: async () => [], fetchInspectionRows: async () => rows });

async function store(rows) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fsf-demo-'));
  await syncDirectory({ snapshot, dir });
  await matchLocationsToCity({ client: client(rows), dir });
  await refreshInspections({ client: client(rows), dir });
  return dir;
}

test('demo checks are added only where real citations exist, and say they are fictional', async () => {
  const dir = await store([row('1', '2026-09-18', '10F'), row('1', '2026-10-08', '06D')]);
  const result = await seedDemoChecks({ dir, now: new Date('2026-11-09T12:00:00Z') });
  assert.deepEqual(result, { locations: ['union-square'], created: 2 });
  const detail = await getLocationDetail('union-square', { dir });
  assert.equal(detail.internalChecks.length, 2);
  assert.ok(detail.internalChecks.every((check) => check.source === 'Fictional demo check' && /Fictional/.test(check.note)));
  assert.equal((await getLocationDetail('dumbo', { dir })).internalChecks.length, 0);
});

test('the temperature check suggests the most recent citation by its explicit code, and the manager can link it', async () => {
  const dir = await store([row('1', '2026-09-18', '10F'), row('1', '2026-10-08', '06D')]);
  await seedDemoChecks({ dir });
  const before = await getLocationDetail('union-square', { dir });
  const temperature = before.internalChecks.find((check) => check.id.endsWith('-coded'));
  const walkthrough = before.internalChecks.find((check) => check.type === 'Walkthrough');
  assert.match(temperature.suggestedCitationId, /--06D$/);
  assert.equal(walkthrough.suggestedCitationId, undefined, 'a concern with no code suggests nothing');
  await setCheckLink(temperature.id, { decision: 'linked' }, { dir });
  const after = await getLocationDetail('union-square', { dir });
  assert.equal(after.internalChecks.find((check) => check.id === temperature.id).link.decision, 'linked');
  assert.ok(after.flags.find((flag) => flag.id === `unlinked-${temperature.suggestedCitationId}`).checkIds.includes(temperature.id));
});

test('the kind of check follows the citation, so a temperature check never pairs with a pest finding', async () => {
  const kindFor = async (description) => {
    const dir = await store([row('1', '2026-10-08', '99X', description)]);
    await seedDemoChecks({ dir });
    return (await getLocationDetail('union-square', { dir })).internalChecks.find((check) => check.id.endsWith('-coded')).type;
  };
  assert.equal(await kindFor('Cold TCS food item held above 41 F'), 'Temperature check');
  assert.equal(await kindFor('Evidence of mice or live mice present in food areas'), 'Pest activity check');
  assert.equal(await kindFor('Filth flies present in facility'), 'Pest activity check');
  assert.equal(await kindFor('Food contact surface not properly washed'), 'Audit');
});

test('seeding twice changes nothing, and with no city records it adds nothing', async () => {
  const dir = await store([row('1', '2026-09-18', '06D')]);
  await seedDemoChecks({ dir });
  assert.equal((await seedDemoChecks({ dir })).created, 0);
  const empty = await store([]);
  assert.deepEqual(await seedDemoChecks({ dir: empty }), { locations: [], created: 0 });
});
