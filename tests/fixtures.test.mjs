import test from 'node:test';
import assert from 'node:assert/strict';
import { detailResponses, locationsResponse } from '../lib/fixtures.js';

test('every listed location opens a matching detail record, including locations without map coordinates', () => {
  assert.ok(locationsResponse.locations.some((location) => location.coordinates === null));
  for (const location of locationsResponse.locations) {
    assert.equal(detailResponses[location.id]?.locationId, location.id);
  }
});
