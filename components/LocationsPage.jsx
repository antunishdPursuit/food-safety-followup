'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import LocationMap from './LocationMap';
import { Badge } from './Badges';
import { usePreview } from './PreviewProvider';
import { countLabel, permitStatusLabel, locationCitationLabel } from '../lib/presentation';

export default function LocationsPage() {
  const [selection, setSelection] = useState({ id: null, revision: 0 });
  const selectedId = selection.id;
  const mapRegion = useRef(null);
  const selectLocation = (id) => {
    setSelection((previous) => ({ id, revision: previous.revision + 1 }));
    mapRegion.current?.scrollIntoView({ block: 'nearest' });
  };
  const { locationsResponse } = usePreview();
  const { locations } = locationsResponse;

  return <>
    <header className="workspace-heading"><h1 id="locations-title">NYC locations</h1><span className="quiet">{countLabel(locations.length, 'location')}</span></header>
    <section className="overview map-workspace" aria-labelledby="locations-title">
      <div className="overview-grid">
        <div className="location-list" role="region" tabIndex="0" aria-label="NYC locations">{!locations.length && <p className="empty-state">No locations loaded. Import the saved directory to begin.</p>}
          {locations.map((location) => <div className={`location-row${selectedId === location.id ? ' selected' : ''}`} key={location.id}>
            <Link className="location-select" href={`/locations/${location.id}`}><strong>{location.name}</strong><small>{location.address}</small>{location.matchStatus !== 'verified' && !location.isSample && <Badge kind="review">{permitStatusLabel(location)}</Badge>}<small>{[locationCitationLabel(location), countLabel(location.openFollowUpCount, 'open follow-up')].filter(Boolean).join(' · ')}</small>{!location.coordinates && <small>Map position unavailable</small>}</Link>
            {location.coordinates && <button className="location-open" onClick={() => selectLocation(location.id)} aria-pressed={selectedId === location.id} aria-label={`Show ${location.name} on map`}>Map</button>}
          </div>)}
        </div>
        <div className="map-wrap" ref={mapRegion}><LocationMap locations={locations} selectedId={selectedId} selectionRevision={selection.revision} onSelect={selectLocation} /></div>
      </div>
    </section>
  </>;
}
