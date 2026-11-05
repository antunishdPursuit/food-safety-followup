import Link from 'next/link';
import { detailResponses, locationsResponse } from '../../../lib/fixtures';

export const metadata = { title: 'Location review | Food Safety Follow-Up' };

export default async function Page({ params }) {
  const { id } = await params;
  const location = locationsResponse.locations.find((item) => item.id === id);
  const detail = detailResponses[id];
  if (!location || !detail) return <section className="page-error"><h1>Location unavailable</h1><p>This location ID is not in the preview.</p><Link href="/">Back to locations</Link></section>;

  return <>
    <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">Locations</Link><span aria-hidden="true">/</span><span>{location.name}</span></nav>
    <header className="page-heading"><div><p className="eyebrow">LOCATION OVERVIEW</p><h1>{location.name}</h1><p>{location.address}</p></div></header>
    <div className="source-note"><strong>Sample records only.</strong> City data is not connected, and this location has no verified CAMIS match.</div>
    <section className="page-section"><h2>Available sample records</h2><p>{detail.inspections.length} inspections · {detail.internalChecks.length} internal checks · {detail.followUps.length} follow-ups</p><Link className="text-button" href={`/locations/${id}/compare`}>Review sample findings</Link></section>
  </>;
}
