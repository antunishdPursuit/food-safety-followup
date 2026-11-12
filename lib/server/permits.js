import { NYC_DATASET } from './config.js';
import { usableCoordinates } from './matching.js';

// The city pads some street names with runs of spaces ("8 EAST   18 STREET"), so collapse them.
const text = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const phoneDigits = (value) => {
  const digits = text(value).replace(/\D/g, '').slice(-10);
  return digits.length === 10 ? digits : null;
};
const isoDate = (value) => (/^\d{4}-\d{2}-\d{2}/.test(text(value)) ? text(value).slice(0, 10) : null);

// Turns the city's Sweetgreen-named permits (one row per CAMIS, from createNycClient().findSweetgreenEstablishments())
// into a list of permits. Every field comes from the city's own record; nothing comes from Sweetgreen's website.
export function permitDirectory(establishments, { fetchedAt = new Date() } = {}) {
  const permits = establishments
    .filter((row) => /^\d+$/.test(text(row.camis)))
    .map((row) => {
      const building = text(row.building);
      const street = text(row.street);
      const zip = /^\d{5}$/.test(text(row.zipcode)) ? text(row.zipcode) : null;
      const borough = text(row.boro);
      return {
        camis: text(row.camis),
        name: text(row.dba),
        building, street, zip, borough,
        address: `${[building, street].filter(Boolean).join(' ')}, ${borough}, NY${zip ? ` ${zip}` : ''}`,
        phone: phoneDigits(row.phone),
        coordinates: usableCoordinates(row.latitude, row.longitude),
        recordDate: isoDate(row.record_date),
      };
    })
    .sort((a, b) => a.borough.localeCompare(b.borough) || a.street.localeCompare(b.street)
      || a.building.localeCompare(b.building, 'en', { numeric: true }) || a.camis.localeCompare(b.camis));
  return {
    source: `${NYC_DATASET.name}, permits whose name contains SWEETGREEN or SWEET GREEN. City records only; not Sweetgreen's website, and no internal safety data.`,
    sourceUrl: NYC_DATASET.pageUrl,
    fetchedAt: new Date(fetchedAt).toISOString(),
    count: permits.length,
    permits,
  };
}

const SMALL_WORDS = new Set(['of', 'the', 'and']);

// "125 CHAMBERS ST" becomes "125 Chambers St"; ordinals stay lower case ("5th") and small words stay small
// ("Avenue of the Americas"). Only capitalization and spacing change, never the words the city wrote.
export function titleCaseStreet(value) {
  return text(value).toLowerCase().split(' ').map((word, index) => {
    if (/^\d+(st|nd|rd|th)$/.test(word)) return word;
    if (index > 0 && SMALL_WORDS.has(word)) return word;
    return word.replace(/(^|[-'/])([a-z])/g, (match, before, letter) => before + letter.toUpperCase());
  }).join(' ');
}

// The app's location list, built from city records alone: each confirmed match (data/confirmed-matches.json) keeps its
// stable id and takes its name, address, phone, and map position from that permit's city record. A match may carry a
// documented `correction` (street and ZIP where the city record misspells or omits them) and a `pin` with its source.
export function directoryFromPermits({ confirmed, permits }) {
  const byCamis = new Map(permits.permits.map((permit) => [permit.camis, permit]));
  const locations = confirmed.matches.map((match) => {
    const permit = byCamis.get(match.camis);
    if (!permit) throw new Error(`CAMIS ${match.camis} (${match.id}) is not in the city permit list. Run npm run data:permits.`);
    const fixed = { ...permit, ...(match.correction || {}) };
    const street = titleCaseStreet(`${fixed.building} ${fixed.street}`);
    return {
      id: match.id,
      name: `Sweetgreen, ${street}`,
      street,
      locality: fixed.borough,
      zip: fixed.zip,
      address: `${street}, ${fixed.borough}, NY${fixed.zip ? ` ${fixed.zip}` : ''}`,
      sourceUrl: NYC_DATASET.pageUrl,
      camis: match.camis,
      coordinates: match.pin || permit.coordinates,
      coordinatesSource: match.pin ? match.pinSource : permit.coordinates ? 'NYC Open Data inspection record' : null,
      phone: permit.phone,
    };
  }).sort((a, b) => a.id.localeCompare(b.id));
  return { source: 'NYC Open Data permit list, one entry per confirmed location', sourceUrl: NYC_DATASET.pageUrl, fetchedAt: permits.fetchedAt, count: locations.length, locations };
}
