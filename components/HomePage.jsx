'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePreview } from './PreviewProvider';
import { formatTimestamp } from '../lib/presentation';

export default function HomePage() {
  const { locationsResponse } = usePreview();
  const { importStatus } = locationsResponse;
  const sample = importStatus.state === 'not-connected';
  const pending = Math.max(0, importStatus.totalCount - importStatus.verifiedCount);
  const importedAt = importStatus.lastSuccess && formatTimestamp(importStatus.lastSuccess);

  return <>
    <section className="home-intro">
      <h1>Inspection findings.<br />Documented follow-ups.</h1>
      <p>For food safety managers reviewing Sweetgreen’s NYC locations and documenting follow-ups linked to their source.</p>
      <Link href="/locations" className="primary-button">Open locations</Link>
    </section>
    <Image className="home-photo" src="/restaurant-review.png" width={2172} height={724} priority alt="Illustrative generated scene of two restaurant colleagues reviewing a tablet." />
    <section className="home-coverage" aria-label="Data coverage">
      <div>{sample ? <p>Fictional sample records for exploring the workflow.</p> : <><p><strong>{importStatus.verifiedCount}</strong> {importStatus.verifiedCount === 1 ? 'location' : 'locations'} matched to city permits.</p><p><strong>{pending}</strong> {pending === 1 ? 'location' : 'locations'} awaiting permit confirmation.</p></>}
        <p className="quiet">Last city import: {sample ? 'Not connected in sample mode' : importedAt || 'No successful import yet'}</p>
      </div>
      <a href="#about-data">About the data</a>
    </section>
    <section id="about-data" className="home-about">
      <h2>From inspection to next step</h2>
      <p>Find a restaurant on the map, review its dated inspections, and record a follow-up with an owner, due date and completion note.</p>
      <p>Permit confirmation connects a directory location to its city records. Different addresses may need manual confirmation; a pending match is not a safety rating.</p>
      <p>NYC Open Data supplies public inspection findings. An older finding does not establish whether a correction happened. Company internal checks are unavailable unless separately supplied; your saved follow-ups document decisions made here.</p>
      <a href="https://data.cityofnewyork.us/Health/DOHMH-New-York-City-Restaurant-Inspection-Results/43nn-pn8j" target="_blank" rel="noreferrer">NYC inspection dataset</a>
    </section>
  </>;
}
