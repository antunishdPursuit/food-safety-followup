// Borough helpers for the location list: the five boroughs by ZIP range.

// ZIP ranges of the five boroughs. Nearby Westchester and Long Island ZIP codes fall outside them.
const BOROUGH_ZIP_RANGES = {
  Manhattan: [[10001, 10282]],
  'Staten Island': [[10301, 10314]],
  Bronx: [[10451, 10475]],
  Brooklyn: [[11201, 11256]],
  Queens: [[11004, 11005], [11101, 11109], [11351, 11451], [11691, 11697]],
};

// The borough name the city dataset uses, or null when the ZIP code is outside New York City.
export function boroughForZip(zip) {
  const value = Number.parseInt(zip, 10);
  for (const [borough, ranges] of Object.entries(BOROUGH_ZIP_RANGES)) {
    if (ranges.some(([low, high]) => value >= low && value <= high)) return borough;
  }
  return null;
}

export function isNycZip(zip) {
  return boroughForZip(zip) !== null;
}
