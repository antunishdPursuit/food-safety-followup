import test from 'node:test';
import assert from 'node:assert/strict';
import { buildingMatches, normalizeStreet, parseAddress } from '../lib/server/address.js';
import { matchLocation, usableCoordinates } from '../lib/server/matching.js';

const city = (camis, dba, building, street, zipcode, latitude = '40.7', longitude = '-73.99') =>
  ({ camis, dba, building, street, zipcode, latitude, longitude });

test('directory and city spellings reduce to the same street', () => {
  assert.equal(normalizeStreet('East 23rd Street'), normalizeStreet('EAST   23 STREET'));
  assert.equal(normalizeStreet('3rd Ave'), '3 AVENUE');
  assert.equal(normalizeStreet('E 61st Street'), 'EAST 61 STREET');
  assert.equal(normalizeStreet('Saint Marks Avenue'), normalizeStreet('ST MARKS AVENUE'));
  assert.equal(normalizeStreet('6th Avenue'), normalizeStreet('AVENUE OF THE AMERICAS'));
  assert.equal(normalizeStreet('3 World Trade Center space 1300'), '3 WORLD TRADE CENTER');
  assert.deepEqual(parseAddress('76-78 Saint Marks Avenue'), { building: '76-78', street: 'SAINT MARKS AVENUE' });
});

test('a range matches either end, while Queens grid numbers must match exactly', () => {
  assert.equal(buildingMatches('76-78', '76'), true);
  assert.equal(buildingMatches('76-78', '78'), true);
  assert.equal(buildingMatches('76-78', '80'), false);
  assert.equal(buildingMatches('106-24', '106-24'), true);
  assert.equal(buildingMatches('106-24', '106'), false);
});

test('address plus a Sweetgreen name verifies one CAMIS and positions the map pin', () => {
  const result = matchLocation({ street: '870 Broadway', zip: '10003' }, [
    city('50001', 'SWEETGREEN', '870', 'BROADWAY', '10003', '40.7339', '-73.9904'),
    city('50002', 'SWEETGREEN', '12', 'BROADWAY', '10003'),
  ]);
  assert.equal(result.matchStatus, 'verified');
  assert.equal(result.camis, '50001');
  assert.deepEqual(result.coordinates, [40.7339, -73.9904]);
});

test('spelling differences between the two sources still verify', () => {
  const establishments = [
    city('1', 'SWEETGREEN', '27', 'EAST   23 STREET', '10010'),
    city('2', 'SWEET GREEN', '106-24', '71 AVENUE', '11375'),
    city('3', 'SWEETGREEN', '76', 'SAINT MARKS AVENUE', '11217'),
    city('4', 'SWEETGREEN', '1114', 'AVENUE OF THE AMERICAS', '10036'),
  ];
  assert.equal(matchLocation({ street: '27 East 23rd Street', zip: '10010' }, establishments).camis, '1');
  assert.equal(matchLocation({ street: '106-24 71st Avenue', zip: '11375' }, establishments).camis, '2');
  assert.equal(matchLocation({ street: '76-78 Saint Marks Avenue', zip: '11217' }, establishments).camis, '3');
  assert.equal(matchLocation({ street: '1114 6th Avenue', zip: '10036' }, establishments).camis, '4');
});

test('the same address under a different business name is a candidate, never verified', () => {
  const result = matchLocation({ street: '870 Broadway', zip: '10003' }, [city('9', 'JOES PIZZA', '870', 'BROADWAY', '10003')]);
  assert.equal(result.matchStatus, 'candidate');
  assert.equal(result.camis, null);
  assert.match(result.candidates[0].reason, /business name differs/);
  assert.deepEqual(result.candidates[0].coordinates, [40.7, -73.99]);
});

test('two city permits at one address are left for the manager to choose', () => {
  const result = matchLocation({ street: '870 Broadway', zip: '10003' }, [
    city('1', 'SWEETGREEN', '870', 'BROADWAY', '10003'),
    city('2', 'SWEETGREEN', '870', 'BROADWAY', '10003'),
  ]);
  assert.equal(result.matchStatus, 'candidate');
  assert.equal(result.candidates.length, 2);
});

test('a Sweetgreen name at the same building number with a different street spelling is a candidate', () => {
  const result = matchLocation({ street: '870 Broadway', zip: '10003' }, [city('5', 'SWEETGREEN', '870', 'BROADWAY & 18 STREET', '10003')]);
  assert.equal(result.matchStatus, 'candidate');
  assert.match(result.candidates[0].reason, /street is spelled differently/);
});

test('no match leaves the location unverified, with no coordinates', () => {
  const result = matchLocation({ street: '870 Broadway', zip: '10003' }, [city('1', 'SWEETGREEN', '1', 'MAIN STREET', '11201')]);
  assert.deepEqual(result, { matchStatus: 'unverified', camis: null, candidates: [], coordinates: null });
});

test('missing or impossible coordinates are not used for the map', () => {
  assert.equal(usableCoordinates('0', '0'), null);
  assert.equal(usableCoordinates(undefined, undefined), null);
  assert.equal(usableCoordinates('51.5', '-0.12'), null);
  assert.deepEqual(usableCoordinates('40.75', '-73.98'), [40.75, -73.98]);
});
