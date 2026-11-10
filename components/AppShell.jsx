'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePreview } from './PreviewProvider';
import ImportWarning from './ImportWarning';

export default function AppShell({ children }) {
  const pathname = usePathname();
  const { locationsResponse, loading, error, reload, notice } = usePreview();
  const sample = locationsResponse?.importStatus.state === 'not-connected';
  return <main className="shell">
    <header className="masthead">
      <Link className="brand" href="/"><span className="brand-mark" aria-hidden="true">◆</span><span>Food Safety Follow-Up</span></Link>
      <nav className="main-nav" aria-label="Main navigation"><Link href="/" aria-current={pathname === '/' ? 'page' : undefined}>Home</Link><Link href="/locations" aria-current={pathname.startsWith('/locations') ? 'page' : undefined}>Locations</Link></nav>
    </header>
    {sample && <div className="preview-banner" role="status"><strong>Sample data.</strong> The locations, citations and internal checks in this mode are fictional. Follow-ups are saved in the local sample store.</div>}
    <ImportWarning status={locationsResponse?.importStatus} />
    {locationsResponse && ['failed', 'stale', 'never-run'].includes(locationsResponse.importStatus.state) && <div className="preview-banner" role="status"><strong>City import: {locationsResponse.importStatus.state}.</strong> {locationsResponse.importStatus.error || 'Review the record dates before acting.'} Stored findings and saved follow-ups remain available.</div>}
    {notice && <p className="save-message" role="status">{notice}</p>}
    {error ? <section className="page-error" role="alert"><h1>{error.status === 404 ? 'Location unavailable' : 'Records could not be loaded'}</h1><p>{error.message}</p><button className="secondary-button" onClick={reload}>Retry</button> <Link href="/locations">Back to locations</Link></section> : loading ? <section className="page-error" role="status">Loading records…</section> : children}
    <footer>Independent project · NYC Open Data · <button className="text-button" onClick={reload}>Reload data</button></footer>
  </main>;
}
