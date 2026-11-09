import test from 'node:test';
import assert from 'node:assert/strict';
import { buildingMatches, normalizeStreet, parseAddress } from '../lib/server/address.js';
import { distanceMeters, matchLocation, matchLocations, usableCoordinates } from '../lib/server/matching.js';

const city = (camis, dba, building, street, zipcode, latitude = '40.7', longitude = '-73.99', extra = {}) =>
  ({ camis, dba, building, street, zipcode, latitude, longitude, ...extra });

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

test('city records with a wrong or missing ZIP code are offered as candidates, never verified', () => {
  const wrongZip = matchLocation({ street: '1153 Broadway', zip: '10001' }, [city('7', 'SWEETGREEN', '1153', 'BROADWAY', '11221')]);
  assert.equal(wrongZip.matchStatus, 'candidate');
  assert.match(wrongZip.candidates[0].reason, /ZIP code is missing or differs/);
  const typoNoZip = matchLocation({ street: '7 Pennsylvania Plaza', zip: '10001' }, [city('8', 'SWEETGREEN', '7', 'PENNSLYVANIA PLAZA', undefined)]);
  assert.equal(typoNoZip.matchStatus, 'candidate');
  assert.match(typoNoZip.candidates[0].reason, /no ZIP code/);
  const otherBusiness = matchLocation({ street: '1153 Broadway', zip: '10001' }, [city('9', 'JOES PIZZA', '1153', 'BROADWAY', '11221')]);
  assert.equal(otherBusiness.matchStatus, 'unverified');
});

const hudsonYards = { street: '10 Hudson Yards', zip: '10001', listedCoordinates: [40.752599, -74.001377] };

test('a Sweetgreen-named permit near the location’s own map position is offered with its distance', () => {
  const result = matchLocation(hudsonYards, [
    city('50080064', 'SWEETGREEN', '501', 'WEST   30 STREET', '10001', '40.752131', '-74.001148', { boro: 'Manhattan' }),
    city('1', 'THE RAMBLE', '10', 'HUDSON YARDS', '10001', '40.7526', '-74.0014', { boro: 'Manhattan' }),
  ]);
  assert.equal(result.matchStatus, 'candidate');
  assert.deepEqual(result.candidates.map((candidate) => candidate.camis), ['50080064'], 'other tenants of the building are not offered once a Sweetgreen permit is found');
  assert.ok(result.candidates[0].distanceMeters > 40 && result.candidates[0].distanceMeters < 70);
  assert.match(result.candidates[0].reason, /m from this location's own map position; the city lists 501 WEST 30 STREET/);
  assert.equal(result.camis, null, 'a nearby permit is never verified automatically');
});

test('a matching phone number offers a permit that has no coordinates or ZIP code', () => {
  const result = matchLocation(
    { street: '7 Pennsylvania Plaza', zip: '10001', listedCoordinates: [40.75158, -73.99371], listedPhone: '6469924200' },
    [city('50098725', 'SWEETGREEN', '7', 'PENNSLYVANIA PLAZA', undefined, '0', '0', { boro: 'Manhattan', phone: '6469924200' })],
  );
  assert.equal(result.candidates[0].camis, '50098725');
  assert.equal(result.candidates[0].phoneMatch, true);
  assert.equal(result.candidates[0].coordinates, null);
});

test('a permit in another borough is never offered, even with the same street number', () => {
  const nomad = { street: '1153 Broadway', zip: '10001', listedCoordinates: [40.744326, -73.989222] };
  const establishments = [
    city('50178824', 'SWEETGREEN', '1153', 'BROADWAY', '11221', '40.693127', '-73.92843', { boro: 'Brooklyn' }),
    city('50001790', 'SWEETGREEN', '1164', 'BROADWAY', '10001', '40.744814', '-73.988805', { boro: 'Manhattan' }),
  ];
  const result = matchLocation(nomad, establishments);
  assert.deepEqual(result.candidates.map((candidate) => candidate.camis), ['50001790']);
  assert.equal(matchLocation(nomad, [establishments[0]]).matchStatus, 'unverified');
});

test('permits too far away, or under another name, are not offered on distance', () => {
  const far = city('2', 'SWEETGREEN', '99', 'FAR STREET', '10001', '40.7600', '-74.0014', { boro: 'Manhattan' });
  const neighbor = city('3', 'JOE COFFEE', '501', 'WEST 30 STREET', '10001', '40.7526', '-74.0014', { boro: 'Manhattan' });
  assert.equal(matchLocation(hudsonYards, [far, neighbor]).matchStatus, 'unverified');
});

test('candidates list a phone match first, then the nearest permit', () => {
  const location = { ...hudsonYards, listedPhone: '6468324350' };
  const result = matchLocation(location, [
    city('near', 'SWEETGREEN', '1', 'A STREET', '10001', '40.7527', '-74.0014', { boro: 'Manhattan' }),
    city('phone', 'SWEETGREEN', '2', 'B STREET', '10001', '40.7540', '-74.0014', { boro: 'Manhattan', phone: '(646) 832-4350' }),
  ]);
  assert.deepEqual(result.candidates.map((candidate) => candidate.camis), ['phone', 'near']);
});

test('a permit that verifies one location, or was already confirmed, is not offered to another', () => {
  const listings = [
    { id: 'a', street: '870 Broadway', zip: '10003', listedCoordinates: [40.7339, -73.9904] },
    { id: 'b', street: '8 East 18th Street', zip: '10003', listedCoordinates: [40.7383, -73.9913] },
  ];
  const establishments = [
    city('x', 'SWEETGREEN', '870', 'BROADWAY', '10003', '40.7339', '-73.9904', { boro: 'Manhattan' }),
    city('y', 'SWEETGREEN', '1', 'NEAR STREET', '10003', '40.7384', '-73.9913', { boro: 'Manhattan' }),
  ];
  const results = matchLocations(listings, establishments);
  assert.equal(results.a.camis, 'x');
  assert.deepEqual(results.b.candidates.map((candidate) => candidate.camis), ['y'], 'x is taken, y is offered');
  assert.equal(matchLocations(listings, establishments, new Set(['y'])).b.matchStatus, 'unverified', 'a confirmed permit is taken');
});

test('distance is the straight-line meters between two positions', () => {
  assert.equal(distanceMeters([40.7, -74], [40.7, -74]), 0);
  assert.ok(Math.abs(distanceMeters([40.7, -74], [40.71, -74]) - 1112) < 5, 'a hundredth of a degree of latitude is about 1,112 m');
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
