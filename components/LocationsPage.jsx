'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import LocationMap from './LocationMap';
import { Badge } from './Badges';
import { usePreview } from './PreviewProvider';

export default function LocationsPage() {
  const router = useRouter();
  const { locationsResponse } = usePreview();
  const { locations, importStatus } = locationsResponse;

  return <>
    <section className="intro">
      <div><p className="eyebrow">NYC REGION · WORKSPACE</p><h1>Stay ahead of every follow-up.</h1><p>Choose a location to review its findings, compare sources, and record the next step.</p></div>
      <div className="intro-meta"><span>Data connection</span><strong>{importStatus.state === 'ok' ? 'Imported city data' : importStatus.state === 'not-connected' ? 'Sample mode' : importStatus.state}</strong><small>Last successful refresh: {importStatus.lastSuccess ? new Date(importStatus.lastSuccess).toLocaleString() : 'unavailable'}</small></div>
    </section>
    {importStatus.state !== 'ok' && importStatus.state !== 'not-connected' && <p className="source-note" role="status">City import: {importStatus.state}. {importStatus.error || 'Stored records remain available; review their refresh dates.'}</p>}
    <section className="overview" aria-labelledby="locations-title">
      <div className="section-heading"><div><h2 id="locations-title">Locations</h2><p>{locations.length} locations · {importStatus.coverage}</p></div><Badge kind="review">{importStatus.coverage}</Badge></div>
      <div className="overview-grid">
        <div className="location-list" aria-label="NYC locations">{!locations.length && <p className="empty-state">No locations loaded. Import the saved directory to begin.</p>}
          {locations.map((location) => <Link className="location-row" href={`/locations/${location.id}`} key={location.id}>
            <span className="location-main"><strong>{location.name}</strong><small>{location.address}</small><span className="row-meta"><span>{location.citationCount === null ? (location.matchStatus !== 'verified' ? 'Inspection match unverified' : location.dataState === 'not-imported' ? 'Not imported' : 'No inspection records') : `${location.citationCount} ${location.isSample ? 'sample ' : ''}citations`}</span><span>{location.openFollowUpCount} open follow-ups</span></span></span>
            <span className="row-end" aria-hidden="true">View</span>
          </Link>)}
        </div>
        <div className="map-wrap"><LocationMap locations={locations} selectedId={null} onSelect={(id) => router.push(`/locations/${id}`)} /><p className="map-caption">{locations.filter((location) => location.coordinates).length} of {locations.length} locations have pins. Pins use city coordinates or the directory position; locations without coordinates remain in the list.</p></div>
      </div>
    </section>
    <section className="summary-strip" aria-label="Data status"><div><strong>{importStatus.verifiedCount} of {importStatus.totalCount}</strong><span>locations verified</span></div><div><strong>{importStatus.lastSuccess ? new Date(importStatus.lastSuccess).toLocaleDateString() : 'Unavailable'}</strong><span>last city-data refresh</span></div><div><strong>{importStatus.state === 'not-connected' ? 'Sample mode' : 'Public city records'}</strong><span>Internal company data unavailable</span></div></section>
  </>;
}
