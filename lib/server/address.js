// Makes a directory address and a city record comparable. The city writes "EAST 23 STREET" and "3 AVENUE";
// Sweetgreen writes "East 23rd Street" and "3rd Ave". Both sides are reduced to the same plain form.

const ORDINAL_WORDS = { FIRST: '1', SECOND: '2', THIRD: '3', FOURTH: '4', FIFTH: '5', SIXTH: '6', SEVENTH: '7', EIGHTH: '8', NINTH: '9', TENTH: '10' };
const ABBREVIATIONS = { AVE: 'AVENUE', AV: 'AVENUE', BLVD: 'BOULEVARD', RD: 'ROAD', DR: 'DRIVE', PKWY: 'PARKWAY', PLZ: 'PLAZA', SQ: 'SQUARE', CT: 'COURT', LN: 'LANE', TPKE: 'TURNPIKE' };
const DIRECTIONS = { E: 'EAST', W: 'WEST', N: 'NORTH', S: 'SOUTH' };

export function normalizeStreet(text) {
  const words = String(text || '')
    .toUpperCase()
    .replace(/[.,#]/g, ' ')
    .replace(/\b(SUITE|STE|SPACE|UNIT|FLOOR|FL)\b.*$/, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => ORDINAL_WORDS[word] || word.replace(/^(\d+)(ST|ND|RD|TH)$/, '$1'));
  const last = words.length - 1;
  const normalized = words.map((word, index) => {
    if (word === 'ST') return index === last ? 'STREET' : 'SAINT';
    if (word === 'PL') return index === last ? 'PLACE' : word;
    if (index === 0 && DIRECTIONS[word] && words.length > 1) return DIRECTIONS[word];
    return ABBREVIATIONS[word] || word;
  }).join(' ');
  // Manhattan's Sixth Avenue appears in city records under its official name.
  return normalized.replace(/\bAVENUE OF THE AMERICAS\b/, '6 AVENUE');
}

// Splits "76-78 Saint Marks Avenue, suite 2" into { building: "76-78", street: "SAINT MARKS AVENUE" }.
export function parseAddress(streetAddress) {
  const match = String(streetAddress || '').trim().match(/^(\d[\dA-Za-z-]*)\s+(.+)$/);
  if (!match) return { building: '', street: normalizeStreet(streetAddress) };
  return { building: match[1].toUpperCase(), street: normalizeStreet(match[2]) };
}

// Range expansion requires a known non-Queens borough. Queens grid numbers
// such as "25-35", and numbers without borough context, only match exactly.
export function buildingMatches(listed, recorded, borough) {
  const a = String(listed || '').toUpperCase().trim();
  const b = String(recorded || '').toUpperCase().trim();
  if (!a || !b) return false;
  if (a === b) return true;
  const range = borough && borough !== 'Queens' ? a.match(/^(\d+)-(\d+)$/) : null;
  return Boolean(range && /^\d+$/.test(b) && Number(b) >= Number(range[1]) && Number(b) <= Number(range[2]));
}

export function buildingVariants(building, borough) {
  const range = borough && borough !== 'Queens' ? String(building || '').match(/^(\d+)-(\d+)$/) : null;
  return range ? [building, range[1], range[2]] : [building];
}
