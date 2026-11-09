// Preloaded by `npm test` (node --import). Tests never contact the NYC Open Data service or sweetgreen.com:
// that service is slow and unreliable, and a test run must give the same answer with or without a network.
// Tests that need a client pass in a fake one. Anything that reaches the live hosts fails loudly instead.
const blocked = ['data.cityofnewyork.us', 'www.sweetgreen.com', 'sweetgreen.com'];
const realFetch = globalThis.fetch;

globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (blocked.includes(url.hostname)) {
    return Promise.reject(new Error(`Live lookups are blocked in tests (${url.hostname}). Pass a fake client or fetch instead.`));
  }
  return realFetch(input, init);
};
