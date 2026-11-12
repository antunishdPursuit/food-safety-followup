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
