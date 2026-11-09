import { buildingMatches, normalizeStreet, parseAddress } from './address.js';
import { boroughForZip } from './directory.js';

// A location is "verified" only when the street address matches AND the business name looks like Sweetgreen.
// Anything less is a candidate for the manager to confirm. Candidates come from the address, and from the
// location's own published map position and phone number, which still work when the city lists a corner or
// alternate address. A permit in another borough is never offered.

const NYC_BOUNDS = { latitude: [40.4, 41.0], longitude: [-74.3, -73.6] };
// Sweetgreen's own map position and the city's position for the same storefront were 6 to 55 m apart in the
// live data, and 116 m at the widest. 250 m also reaches a corner entrance listed under another street.
const NEARBY_METERS = 250;
const MAX_CANDIDATES = 5;

export function looksLikeSweetgreen(name) {
  return /SWEET\s?GREEN/i.test(String(name || ''));
}

export function usableCoordinates(latitude, longitude) {
  const lat = Number.parseFloat(latitude);
  const lng = Number.parseFloat(longitude);
  const inside = (value, [low, high]) => Number.isFinite(value) && value >= low && value <= high;
  return inside(lat, NYC_BOUNDS.latitude) && inside(lng, NYC_BOUNDS.longitude) ? [lat, lng] : null;
}

// Straight-line distance in whole meters between two [latitude, longitude] pairs.
export function distanceMeters([lat1, lng1], [lat2, lng2]) {
  const rad = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return Math.round(2 * 6371000 * Math.asin(Math.sqrt(a)));
}

const lastTenDigits = (value) => String(value || '').replace(/\D/g, '').slice(-10);
const cityAddress = (item) => [item.building, item.street].filter(Boolean).join(' ').replace(/\s+/g, ' ');

function describe({ item, reasons, distanceMeters: meters, phoneMatch }) {
  return {
    camis: item.camis,
    dba: item.dba,
    boro: item.boro || null,
    address: `${cityAddress(item)}${item.zipcode ? `, ${item.zipcode}` : ''}`,
    coordinates: usableCoordinates(item.latitude, item.longitude),
    distanceMeters: meters,
    phoneMatch,
    reason: reasons.join(' '),
  };
}

// location: { street, zip, listedCoordinates?, listedPhone? } from the directory. establishments: one entry per CAMIS
// from the city dataset. claimed: permits already matched to another location, never offered again.
export function matchLocation(location, establishments, claimed = new Set()) {
  const listed = parseAddress(location.street);
  const borough = boroughForZip(location.zip);
  const sameZip = establishments.filter((item) => item.zipcode === location.zip);
  const sameAddress = sameZip.filter((item) =>
    buildingMatches(listed.building, item.building) && normalizeStreet(item.street) === listed.street);
  const strong = sameAddress.filter((item) => looksLikeSweetgreen(item.dba));

  if (strong.length === 1) {
    return { matchStatus: 'verified', camis: strong[0].camis, candidates: [], coordinates: usableCoordinates(strong[0].latitude, strong[0].longitude) };
  }

  const named = new Map(); // permits with a Sweetgreen name and some evidence they are this location
  const other = new Map(); // another business at this address; offered only when nothing Sweetgreen-named is found
  const note = (pool, item, reason, evidence = {}) => {
    if (claimed.has(item.camis)) return;
    const entry = pool.get(item.camis) || { item, reasons: [], distanceMeters: null, phoneMatch: false };
    if (!entry.reasons.includes(reason)) entry.reasons.push(reason);
    if (evidence.distanceMeters !== undefined) entry.distanceMeters = evidence.distanceMeters;
    if (evidence.phoneMatch) entry.phoneMatch = true;
    pool.set(item.camis, entry);
  };

  for (const item of strong) note(named, item, 'More than one city permit matches this address and name.');
  for (const item of sameAddress) if (!looksLikeSweetgreen(item.dba)) note(other, item, 'Address matches but the business name differs.');

  const here = Array.isArray(location.listedCoordinates) ? location.listedCoordinates : null;
  const phone = lastTenDigits(location.listedPhone);
  for (const item of establishments) {
    if (!looksLikeSweetgreen(item.dba)) continue;
    if (borough && item.boro && String(item.boro).toLowerCase() !== borough.toLowerCase()) continue;

    // City records have wrong or missing ZIP codes and misspelled streets, so a Sweetgreen-named record that
    // agrees on the building number is offered to the manager rather than ignored.
    if (buildingMatches(listed.building, item.building)) {
      const streetMatches = normalizeStreet(item.street) === listed.street;
      if (item.zipcode === location.zip) {
        if (!streetMatches) note(named, item, 'Name and building number match but the street is spelled differently.');
      } else if (streetMatches) {
        note(named, item, 'Name, building number, and street match but the ZIP code is missing or differs.');
      } else if (!item.zipcode) {
        note(named, item, 'Name and building number match but the street is spelled differently and the city record has no ZIP code.');
      }
    }

    const there = usableCoordinates(item.latitude, item.longitude);
    if (here && there) {
      const meters = distanceMeters(here, there);
      if (meters <= NEARBY_METERS) {
        note(named, item, `A Sweetgreen-named permit is ${meters} m from this location's own map position; the city lists ${cityAddress(item)}.`, { distanceMeters: meters });
      }
    }
    if (phone && lastTenDigits(item.phone) === phone) note(named, item, "The phone number matches this location's page.", { phoneMatch: true });
  }

  const pool = named.size ? named : other;
  const candidates = [...pool.values()]
    .sort((a, b) => Number(b.phoneMatch) - Number(a.phoneMatch) || (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity) || a.item.camis.localeCompare(b.item.camis))
    .slice(0, MAX_CANDIDATES)
    .map(describe);
  return { matchStatus: candidates.length ? 'candidate' : 'unverified', camis: null, candidates, coordinates: null };
}

// A permit that verifies one location is not offered to any other.
export function matchLocations(locations, establishments, claimed = new Set()) {
  const first = Object.fromEntries(locations.map((location) => [location.id, matchLocation(location, establishments, claimed)]));
  const taken = new Set([...claimed, ...Object.values(first).map((result) => result.camis).filter(Boolean)]);
  return Object.fromEntries(locations.map((location) => [
    location.id,
    first[location.id].matchStatus === 'verified' ? first[location.id] : matchLocation(location, establishments, taken),
  ]));
}
