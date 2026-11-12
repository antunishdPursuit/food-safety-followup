import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boroughForZip, isNycZip } from '../lib/server/directory.js';
import { directoryFromPermits } from '../lib/server/permits.js';

const data = (name) => JSON.parse(readFileSync(new URL(`../data/${name}`, import.meta.url), 'utf8'));

test('ZIP codes are matched to the five boroughs', () => {
  for (const zip of ['10001', '10282', '10314', '10475', '11201', '11101', '11375']) assert.equal(isNycZip(zip), true, zip);
  for (const zip of ['10514', '10583', '11030', '11530', '11746', '07030']) assert.equal(isNycZip(zip), false, zip);
});

test('boroughs are named as the city dataset names them', () => {
  assert.equal(boroughForZip('10003'), 'Manhattan');
  assert.equal(boroughForZip('11221'), 'Brooklyn');
  assert.equal(boroughForZip('11375'), 'Queens');
  assert.equal(boroughForZip('10451'), 'Bronx');
  assert.equal(boroughForZip('10305'), 'Staten Island');
  assert.equal(boroughForZip('10514'), null);
});

test('the location list built from the permit list has unique ids, city-sourced names, and NYC addresses only', () => {
  const directory = directoryFromPermits({ confirmed: data('confirmed-matches.json'), permits: data('permit-directory.json') });
  assert.ok(directory.fetchedAt && directory.sourceUrl);
  assert.equal(directory.count, directory.locations.length);
  assert.equal(directory.locations.length, 38);
  assert.equal(new Set(directory.locations.map((location) => location.id)).size, 38);
  for (const location of directory.locations) {
    assert.equal(isNycZip(location.zip), true, location.id);
    assert.match(location.name, /^Sweetgreen, \d/, location.id);
    assert.match(location.sourceUrl, /data\.cityofnewyork\.us/, location.id);
    assert.doesNotMatch(JSON.stringify(location), /sweetgreen\.com/i, `${location.id} carries nothing from Sweetgreen's website`);
    assert.ok(location.coordinates, `${location.id} has a map position from the city record or the city geocoder`);
    const [lat, lng] = location.coordinates;
    assert.ok(lat > 40.4 && lat < 41 && lng > -74.3 && lng < -73.6, `${location.id} has a position in New York City`);
    assert.ok(location.coordinatesSource, location.id);
  }
});

test('the one permit with no usable city position gets a documented geocoder pin and a corrected street', () => {
  const directory = directoryFromPermits({ confirmed: data('confirmed-matches.json'), permits: data('permit-directory.json') });
  const penn = directory.locations.find((location) => location.id === 'penn-plaza');
  assert.equal(penn.name, 'Sweetgreen, 7 Pennsylvania Plaza');
  assert.equal(penn.zip, '10001');
  assert.match(penn.coordinatesSource, /NYC Planning Labs geocoder/);
  const others = directory.locations.filter((location) => location.id !== 'penn-plaza');
  assert.ok(others.every((location) => location.coordinatesSource === 'NYC Open Data inspection record'));
});
