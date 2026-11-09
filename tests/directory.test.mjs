import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isNycZip, parseDirectory } from '../lib/server/directory.js';

function page(items) {
  const list = { '@type': 'ItemList', itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, item })) };
  // A raw line break inside a string mirrors the real page.
  const text = JSON.stringify(list).replace('Union Square', 'Union\nSquare');
  return `<html><script type="application/ld+json">{"@type":"Organization"}</script><script type="application/ld+json">${text}</script></html>`;
}

const place = (slug, name, street, locality, region, zip) => ({
  '@type': 'LocalBusiness', name, url: `https://www.sweetgreen.com/locations/${slug}`,
  address: { streetAddress: street, addressLocality: locality, addressRegion: region, postalCode: zip },
});

test('keeps New York City locations and drops other places, including nearby suburbs', () => {
  const html = page([
    place('union-square', 'Union Square', '870 Broadway', 'New York', 'NY', '10003'),
    place('dumbo', 'DUMBO', '50 Washington St', 'Brooklyn', 'NY', '11201'),
    place('long-island-city', 'Long Island City', '25-35 44th Drive', 'Long Island City', 'NY', '11101'),
    place('chappaqua', 'Chappaqua', '480 North Bedford Road', 'Chappaqua', 'NY', '10514'),
    place('garden-city', 'Garden City', '191 Seventh Street', 'Garden City', 'NY', '11530'),
    place('hoboken', 'Hoboken', '1 Main St', 'Hoboken', 'NJ', '07030'),
  ]);
  const locations = parseDirectory(html);
  assert.deepEqual(locations.map((location) => location.id), ['dumbo', 'long-island-city', 'union-square']);
  assert.equal(locations[2].name, 'Sweetgreen Union Square');
  assert.equal(locations[2].address, '870 Broadway, New York, NY 10003');
});

test('a page without a location list fails loudly instead of returning an empty directory', () => {
  assert.throws(() => parseDirectory('<html><body>Maintenance</body></html>'), /format may have changed/);
});

test('ZIP codes are matched to the five boroughs', () => {
  for (const zip of ['10001', '10282', '10314', '10475', '11201', '11101', '11375']) assert.equal(isNycZip(zip), true, zip);
  for (const zip of ['10514', '10583', '11030', '11530', '11746', '07030']) assert.equal(isNycZip(zip), false, zip);
});

test('the saved directory snapshot has unique ids and NYC addresses only', () => {
  const snapshot = JSON.parse(readFileSync(new URL('../data/sweetgreen-nyc-locations.json', import.meta.url), 'utf8'));
  assert.ok(snapshot.fetchedAt && snapshot.sourceUrl);
  assert.equal(snapshot.count, snapshot.locations.length);
  assert.ok(snapshot.locations.length > 0);
  assert.equal(new Set(snapshot.locations.map((location) => location.id)).size, snapshot.locations.length);
  for (const location of snapshot.locations) assert.equal(isNycZip(location.zip), true, location.id);
});
