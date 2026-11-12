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
