// Builds the NYC restaurant list from Sweetgreen's public locations page.
// The page embeds its directory as JSON-LD; it carries names and addresses only, no coordinates and no safety data.

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

function jsonLdBlocks(html) {
  const blocks = [];
  for (const match of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      // The page puts raw line breaks inside some strings, which strict JSON rejects.
      blocks.push(JSON.parse(match[1].replace(/[\u0000-\u001f]/g, ' ')));
    } catch {
      // Ignore a block that is not valid JSON; the list block is checked for below.
    }
  }
  return blocks;
}

// Each location's own page publishes its map position and phone number as JSON-LD. Both are independent of the
// street address, so they can tie a location to a city permit that lists a different address (a corner entrance).
export function parseLocationPage(html) {
  const place = jsonLdBlocks(html).find((block) => block.geo);
  if (!place) return { coordinates: null, phone: null };
  const lat = Number(place.geo.latitude);
  const lng = Number(place.geo.longitude);
  const phone = String(place.telephone || '').replace(/\D/g, '').slice(-10);
  return {
    coordinates: Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null,
    phone: phone.length === 10 ? phone : null,
  };
}

export function parseDirectory(html) {
  const list = jsonLdBlocks(html).find((block) => block['@type'] === 'ItemList' && Array.isArray(block.itemListElement));
  if (!list || list.itemListElement.length === 0) {
    throw new Error('Sweetgreen locations page has no location list. The page format may have changed.');
  }
  const locations = [];
  for (const entry of list.itemListElement) {
    const item = entry.item || entry;
    const address = item.address || {};
    const slug = String(item.url || '').split('/').filter(Boolean).pop();
    if (!slug || address.addressRegion !== 'NY' || !isNycZip(address.postalCode)) continue;
    const street = String(address.streetAddress || '').trim();
    const locality = String(address.addressLocality || '').trim();
    locations.push({
      id: slug,
      name: `Sweetgreen ${String(item.name || slug).trim()}`,
      street,
      locality,
      zip: String(address.postalCode),
      address: `${street}, ${locality}, NY ${address.postalCode}`,
      sourceUrl: item.url,
    });
  }
  return locations.sort((a, b) => a.id.localeCompare(b.id));
}
