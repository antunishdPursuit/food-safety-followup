import { NYC_DATASET } from './config.js';

const PAGE_SIZE = 5000;
const CAMIS_CHUNK = 20;
const ESTABLISHMENT_FIELDS = 'camis,dba,building,street,zipcode,boro,phone,latitude,longitude,record_date';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;

// Client for the NYC Open Data (Socrata) inspection dataset. Temporary failures (timeouts, 429, 5xx) are
// retried with a growing pause; anything else fails at once. Every failure surfaces as an Error, so the
// importer can keep the records it already has.
export function createNycClient({ fetchImpl = globalThis.fetch, appToken = process.env.NYC_OPEN_DATA_APP_TOKEN, attempts = 5, timeoutMs = 90000, wait = sleep } = {}) {
  async function request(params) {
    const url = new URL(`/resource/${NYC_DATASET.id}.json`, NYC_DATASET.host);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const headers = { accept: 'application/json', ...(appToken ? { 'x-app-token': appToken } : {}) };
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      let response = null;
      try {
        response = await fetchImpl(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
      } catch (error) {
        lastError = error;
      }
      if (response?.ok) {
        const rows = await response.json().catch(() => null);
        if (!Array.isArray(rows)) throw new Error('NYC Open Data returned an unexpected response.');
        return rows;
      }
      if (response) {
        lastError = new Error(`NYC Open Data returned ${response.status}.`);
        if (response.status < 500 && response.status !== 429) break;
      }
      // The city service has gone down for tens of seconds at a time, so wait longer between tries.
      if (attempt < attempts) await wait(Math.min(30000, 2000 * 3 ** (attempt - 1)));
    }
    throw new Error(`NYC Open Data request failed. ${lastError?.message || ''}`.trim());
  }

  async function getAll(params) {
    const rows = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const page = await request({ ...params, $limit: String(PAGE_SIZE), $offset: String(offset) });
      rows.push(...page);
      if (page.length < PAGE_SIZE) return rows;
    }
  }

  // One entry per CAMIS, taking the most recent record's address and coordinates.
  const oneEstablishmentPerCamis = (rows) => [...new Map([...rows].reverse().map((row) => [row.camis, row])).values()];

  return {
    async findSweetgreenEstablishments() {
      const rows = await getAll({
        $select: ESTABLISHMENT_FIELDS,
        $where: "upper(dba) like '%SWEETGREEN%' OR upper(dba) like '%SWEET GREEN%'",
        $order: 'record_date DESC, camis',
      });
      return oneEstablishmentPerCamis(rows);
    },

    async findEstablishmentsAtAddress(zip, building) {
      if (!/^\d{5}$/.test(String(zip)) || !/^[0-9A-Za-z-]+$/.test(String(building))) return [];
      const rows = await getAll({
        $select: ESTABLISHMENT_FIELDS,
        $where: `zipcode=${quote(zip)} AND building=${quote(String(building).toUpperCase())}`,
        $order: 'record_date DESC, camis',
      });
      return oneEstablishmentPerCamis(rows);
    },

    async fetchInspectionRows(camisIds) {
      const rows = [];
      for (let start = 0; start < camisIds.length; start += CAMIS_CHUNK) {
        const chunk = camisIds.slice(start, start + CAMIS_CHUNK);
        if (!chunk.every((id) => /^\d+$/.test(String(id)))) throw new Error('A CAMIS ID must contain digits only.');
        rows.push(...await getAll({
          $where: `camis in(${chunk.map(quote).join(',')})`,
          $order: 'camis, inspection_date, violation_code, violation_description',
        }));
      }
      return rows;
    },
  };
}

const slug = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const numberOrNull = (value) => (value === undefined || value === null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value));

// The city stores "not yet inspected" as the year 1900.
function cityDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match && match[1] !== '1900' ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

const CRITICAL = { Critical: true, 'Not Critical': false };

// The dataset has one row per citation, or one row for an inspection with no citations. Rows are grouped into
// inspections with ids built from CAMIS, date, and type, so a re-import produces the same ids.
export function groupInspections(rows) {
  const inspections = new Map();
  for (const row of rows) {
    const date = cityDate(row.inspection_date);
    const type = String(row.inspection_type || 'Inspection type not stated').trim();
    const id = `i-${row.camis}-${date ? date.replaceAll('-', '') : 'none'}-${slug(type)}`;
    if (!inspections.has(id)) {
      inspections.set(id, {
        id, camis: row.camis, date, type,
        source: 'Public NYC inspection',
        sourceUrl: NYC_DATASET.pageUrl,
        action: row.action || null,
        grade: row.grade || null,
        score: numberOrNull(row.score),
        gradeDate: cityDate(row.grade_date),
        recordDate: cityDate(row.record_date),
        citations: [],
      });
    }
    const inspection = inspections.get(id);
    if (row.violation_code) {
      const code = String(row.violation_code).trim();
      const description = String(row.violation_description || '').trim();
      const duplicate = inspection.citations.some((item) => item.code === code && item.description === description && item.criticalFlag === (row.critical_flag || null));
      if (!duplicate) {
        const sameCode = inspection.citations.filter((item) => item.code === code).length;
        inspection.citations.push({
          id: `${id}--${code}${sameCode ? `-${sameCode + 1}` : ''}`,
          code, description,
          critical: CRITICAL[row.critical_flag] ?? null,
          criticalFlag: row.critical_flag || null,
        });
      }
    }
  }
  return [...inspections.values()].map((inspection) => {
    const { citations, action, date } = inspection;
    let outcome = 'unknown';
    let result = 'Result not stated in the city record';
    if (!date) { outcome = 'not-yet-inspected'; result = 'Not yet inspected'; }
    else if (citations.length) { outcome = 'citations'; result = `${citations.length} ${citations.length === 1 ? 'citation' : 'citations'} recorded`; }
    else if (/no violations/i.test(action || '')) { outcome = 'no-violations'; result = 'No violations recorded by the city'; }
    return { ...inspection, outcome, result };
  }).sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.id.localeCompare(b.id));
}
