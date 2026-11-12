import test from 'node:test';
import assert from 'node:assert/strict';
import { permitDirectory } from '../lib/server/permits.js';

const row = (overrides) => ({ camis: '50098726', dba: 'SWEETGREEN', building: '348', street: 'BOWERY', zipcode: '10012', boro: 'Manhattan', phone: '9175551234', latitude: '40.7265', longitude: '-73.9926', record_date: '2026-11-09T06:00:00.000', ...overrides });

test('a permit list takes every field from the city record and builds the address from it', () => {
  const directory = permitDirectory([row()], { fetchedAt: '2026-11-12T12:00:00Z' });
  assert.equal(directory.count, 1);
  assert.equal(directory.fetchedAt, '2026-11-12T12:00:00.000Z');
  assert.deepEqual(directory.permits[0], {
    camis: '50098726', name: 'SWEETGREEN', building: '348', street: 'BOWERY', zip: '10012', borough: 'Manhattan',
    address: '348 BOWERY, Manhattan, NY 10012', phone: '9175551234', coordinates: [40.7265, -73.9926], recordDate: '2026-11-09',
  });
  assert.match(directory.source, /City records only/);
});

test('missing or unusable city fields become null instead of invented values', () => {
  const [permit] = permitDirectory([row({ zipcode: '', phone: '123', latitude: '0', longitude: '0', record_date: '' })]).permits;
  assert.equal(permit.zip, null);
  assert.equal(permit.phone, null);
  assert.equal(permit.coordinates, null);
  assert.equal(permit.recordDate, null);
  assert.equal(permit.address, '348 BOWERY, Manhattan, NY');
});

test('rows without a numeric CAMIS are dropped and the order is stable regardless of input order', () => {
  const a = row({ camis: '1', boro: 'Brooklyn', street: 'WILLOUGHBY ST', building: '100' });
  const b = row({ camis: '2', boro: 'Manhattan', street: 'BROADWAY', building: '9' });
  const c = row({ camis: '3', boro: 'Manhattan', street: 'BROADWAY', building: '10' });
  const junk = row({ camis: 'n/a' });
  const first = permitDirectory([c, junk, a, b]).permits.map((permit) => permit.camis);
  const second = permitDirectory([b, a, c]).permits.map((permit) => permit.camis);
  assert.deepEqual(first, ['1', '2', '3']);
  assert.deepEqual(second, first);
});

test('building the list does not change the rows it was given', () => {
  const rows = [row()];
  const before = structuredClone(rows);
  permitDirectory(rows);
  assert.deepEqual(rows, before);
});

test('runs of spaces in the city street name collapse to one space', () => {
  const [permit] = permitDirectory([row({ building: '8', street: 'EAST   18 STREET' })]).permits;
  assert.equal(permit.street, 'EAST 18 STREET');
  assert.equal(permit.address, '8 EAST 18 STREET, Manhattan, NY 10012');
});

test('street names are title-cased without changing the words the city wrote', async () => {
  const { titleCaseStreet } = await import('../lib/server/permits.js');
  assert.equal(titleCaseStreet('125 CHAMBERS ST'), '125 Chambers St');
  assert.equal(titleCaseStreet('8 EAST   18 STREET'), '8 East 18 Street');
  assert.equal(titleCaseStreet('AVENUE OF THE AMERICAS'), 'Avenue of the Americas');
  assert.equal(titleCaseStreet('1ST AVENUE'), '1st Avenue');
  assert.equal(titleCaseStreet("O'BRIEN ST"), "O'Brien St");
});

test('a location entry takes everything from its permit, applies a documented correction, and prefers a documented pin', async () => {
  const { directoryFromPermits } = await import('../lib/server/permits.js');
  const permits = { fetchedAt: '2026-11-12T12:00:00.000Z', permits: [
    { camis: '1', name: 'SWEETGREEN', building: '7', street: 'PENNSLYVANIA PLAZA', zip: null, borough: 'Manhattan', phone: '6469924200', coordinates: null },
    { camis: '2', name: 'SWEETGREEN', building: '125', street: 'CHAMBERS ST', zip: '10007', borough: 'Manhattan', phone: null, coordinates: [40.7, -74.0] },
  ] };
  const confirmed = { matches: [
    { id: 'penn', camis: '1', correction: { street: 'PENNSYLVANIA PLAZA', zip: '10001' }, pin: [40.7489, -73.9925], pinSource: 'NYC Planning Labs geocoder' },
    { id: 'chambers', camis: '2' },
  ] };
  const { locations } = directoryFromPermits({ confirmed, permits });
  const [chambers, penn] = locations;
  assert.deepEqual([chambers.name, chambers.address, chambers.coordinates, chambers.coordinatesSource], ['Sweetgreen, 125 Chambers St', '125 Chambers St, Manhattan, NY 10007', [40.7, -74.0], 'NYC Open Data inspection record']);
  assert.deepEqual([penn.name, penn.address, penn.coordinates, penn.coordinatesSource], ['Sweetgreen, 7 Pennsylvania Plaza', '7 Pennsylvania Plaza, Manhattan, NY 10001', [40.7489, -73.9925], 'NYC Planning Labs geocoder']);
  assert.throws(() => directoryFromPermits({ confirmed: { matches: [{ id: 'x', camis: '9' }] }, permits }), /not in the city permit list/);
});
