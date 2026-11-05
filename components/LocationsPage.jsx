'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import LocationMap from './LocationMap';
import { Badge } from './Badges';
import { usePreview } from './PreviewProvider';

export default function LocationsPage() {
  const router = useRouter();
  const { locationsResponse, actionsByLocation } = usePreview();
  const { locations, importStatus } = locationsResponse;

  return <>
    <section className="intro">
      <div><p className="eyebrow">NYC REGION · WORKSPACE</p><h1>Stay ahead of every follow-up.</h1><p>Choose a location to review its findings, compare sources, and record the next step.</p></div>
      <div className="intro-meta"><span>Data connection</span><strong>Not connected</strong><small>Last successful refresh: unavailable</small></div>
    </section>
    <section className="overview" aria-labelledby="locations-title">
      <div className="section-heading"><div><h2 id="locations-title">Locations</h2><p>{locations.length} sample locations · {importStatus.coverage}</p></div><Badge kind="review">Inspection matches unverified</Badge></div>
      <div className="overview-grid">
        <div className="location-list" aria-label="Sample locations">
          {locations.map((location) => <Link className="location-row" href={`/locations/${location.id}`} key={location.id}>
            <span className="location-main"><strong>{location.name}</strong><small>{location.address}</small><span className="row-meta"><span>{location.citationCount === null ? 'Inspection data missing' : `${location.citationCount} sample citations`}</span><span>{actionsByLocation[location.id].filter((action) => action.status !== 'Complete').length} open follow-ups</span></span></span>
            <span className="row-end" aria-hidden="true">View</span>
          </Link>)}
        </div>
        <div className="map-wrap"><LocationMap locations={locations} selectedId={null} onSelect={(id) => router.push(`/locations/${id}`)} /><p className="map-caption">Illustrative positions only. One location has no coordinates and remains in the list.</p></div>
      </div>
    </section>
    <section className="summary-strip" aria-label="Data status"><div><strong>0 of 3</strong><span>sample locations verified</span></div><div><strong>Unavailable</strong><span>last city-data refresh</span></div><div><strong>Sample only</strong><span>inspections and checks</span></div></section>
  </>;
}
