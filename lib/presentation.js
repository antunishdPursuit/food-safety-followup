const dateOptions = { day: 'numeric', month: 'short', year: 'numeric' };
const calendarDate = new Intl.DateTimeFormat('en-GB', { ...dateOptions, timeZone: 'UTC' });
const newYorkDate = new Intl.DateTimeFormat('en-GB', { ...dateOptions, timeZone: 'America/New_York' });
const newYorkTime = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });

// Display formatting only; source values and native date inputs stay unchanged.
export function formatDate(value, fallback = 'Date unavailable') {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? fallback : calendarDate.format(date);
}

export function formatTimestamp(value, fallback = 'Not recorded') {
  if (typeof value !== 'string' || !value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : `${newYorkDate.format(date)}, ${newYorkTime.format(date)} (New York)`;
}

export function formatDateMentions(text) {
  return typeof text === 'string' ? text.replace(/\b\d{4}-\d{2}-\d{2}\b/g, (value) => formatDate(value, value)) : '';
}

export function countLabel(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function permitStatusLabel(location) {
  if (location.isSample) return 'Sample location';
  return location.matchStatus === 'verified' ? 'Permit matched' : 'Permit confirmation pending';
}

export function locationCitationLabel(location) {
  if (location.citationCount !== null && location.citationCount !== undefined) return countLabel(location.citationCount, 'recorded citation');
  if (location.isSample) return 'No sample inspections';
  if (location.matchStatus !== 'verified') return '';
  return location.dataState === 'not-imported' ? 'Inspection import pending' : 'No inspection records';
}
