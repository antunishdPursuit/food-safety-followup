import { buildingMatches, normalizeStreet, parseAddress } from './address.js';

// A location is "verified" only when the street address matches AND the business name looks like Sweetgreen.
// Name alone or address alone is never enough: those become candidates for the manager to confirm.

const NYC_BOUNDS = { latitude: [40.4, 41.0], longitude: [-74.3, -73.6] };

export function looksLikeSweetgreen(name) {
  return /SWEET\s?GREEN/i.test(String(name || ''));
}

export function usableCoordinates(latitude, longitude) {
  const lat = Number.parseFloat(latitude);
  const lng = Number.parseFloat(longitude);
  const inside = (value, [low, high]) => Number.isFinite(value) && value >= low && value <= high;
  return inside(lat, NYC_BOUNDS.latitude) && inside(lng, NYC_BOUNDS.longitude) ? [lat, lng] : null;
}

function describe(establishment, reason) {
  return {
    camis: establishment.camis,
    dba: establishment.dba,
    address: `${establishment.building || ''} ${establishment.street || ''}, ${establishment.zipcode || ''}`.trim(),
    coordinates: usableCoordinates(establishment.latitude, establishment.longitude),
    reason,
  };
}

// location: { street, zip } from the directory. establishments: one entry per CAMIS from the city dataset.
export function matchLocation(location, establishments) {
  const listed = parseAddress(location.street);
  const sameZip = establishments.filter((item) => item.zipcode === location.zip);
  const sameAddress = sameZip.filter((item) =>
    buildingMatches(listed.building, item.building) && normalizeStreet(item.street) === listed.street);
  const strong = sameAddress.filter((item) => looksLikeSweetgreen(item.dba));

  if (strong.length === 1) {
    return { matchStatus: 'verified', camis: strong[0].camis, candidates: [], coordinates: usableCoordinates(strong[0].latitude, strong[0].longitude) };
  }
  const candidates = [];
  const seen = new Set();
  const add = (item, reason) => { if (!seen.has(item.camis)) { seen.add(item.camis); candidates.push(describe(item, reason)); } };
  for (const item of strong) add(item, 'More than one city permit matches this address and name.');
  for (const item of sameAddress) add(item, 'Address matches but the business name differs.');
  for (const item of sameZip) {
    if (looksLikeSweetgreen(item.dba) && buildingMatches(listed.building, item.building)) add(item, 'Name and building number match but the street is spelled differently.');
  }
  return { matchStatus: candidates.length ? 'candidate' : 'unverified', camis: null, candidates, coordinates: null };
}

export function matchLocations(locations, establishments) {
  return Object.fromEntries(locations.map((location) => [location.id, matchLocation(location, establishments)]));
}
