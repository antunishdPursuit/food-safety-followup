'use client';

import Link from 'next/link';
import { usePreview } from './PreviewProvider';

export default function AppShell({ children }) {
  const { locationsResponse, loading, error, reload, notice } = usePreview();
  const sample = locationsResponse?.importStatus.state === 'not-connected';
  return <main className="shell">
    <header className="masthead">
      <Link className="brand" href="/"><span className="brand-mark" aria-hidden="true">◆</span><span>Food Safety Follow-Up</span></Link>
      <div className="header-status"><span className="header-tag">Manager workspace</span><span className="connection-dot" aria-hidden="true" /> <span>{sample ? 'Sample data' : 'Saved city records'}</span></div>
    </header>
    {sample && <div className="preview-banner" role="status"><strong>Sample data.</strong> The locations, citations and internal checks in this mode are fictional. Follow-ups are saved in the local sample store.</div>}
    {notice && <p className="save-message" role="status">{notice}</p>}
    {error ? <section className="page-error" role="alert"><h1>{error.status === 404 ? 'Location unavailable' : 'Records could not be loaded'}</h1><p>{error.message}</p><button className="secondary-button" onClick={reload}>Retry</button> <Link href="/">Back to locations</Link></section> : loading ? <section className="page-error" role="status">Loading records…</section> : children}
    <footer>Independent course prototype · {locationsResponse?.importStatus.coverage || 'Loading coverage'} · No connection to Sweetgreen internal systems · <button className="text-button" onClick={reload}>Reload data</button></footer>
  </main>;
}
