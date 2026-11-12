import path from 'node:path';

// Where the backend keeps its records. Set FSF_DATA_DIR to use a different store (for example the sample store).
export function dataDir() {
  // The store lives outside the build, so Next must not trace it into the deployed server code.
  return path.resolve(/*turbopackIgnore: true*/ process.env.FSF_DATA_DIR || '.data');
}

// City data older than this is shown as stale. Follow-ups stay available either way.
export function staleAfterHours() {
  const hours = Number(process.env.FSF_STALE_AFTER_HOURS);
  return Number.isFinite(hours) && hours > 0 ? hours : 72;
}

export const NYC_DATASET = {
  name: 'NYC DOHMH Restaurant Inspection Results',
  id: '43nn-pn8j',
  host: 'https://data.cityofnewyork.us',
  pageUrl: 'https://data.cityofnewyork.us/Health/DOHMH-New-York-City-Restaurant-Inspection-Results/43nn-pn8j',
};
