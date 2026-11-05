'use client';

import Link from 'next/link';
import { usePreview } from './PreviewProvider';

export default function AppShell({ children }) {
  const { locationsResponse } = usePreview();
  return <main className="shell">
    <header className="masthead">
      <Link className="brand" href="/"><span className="brand-mark" aria-hidden="true">◆</span><span>Food Safety Follow-Up</span></Link>
      <div className="header-status"><span className="header-tag">Manager preview</span><span className="connection-dot" aria-hidden="true" /> <span>Data not connected</span></div>
    </header>
    <div className="preview-banner" role="status"><strong>Interface preview with sample data.</strong> No live NYC inspection feed or saved backend is connected. All locations, citations, checks, and actions shown here are illustrative. Changes reset on refresh.</div>
    {children}
    <footer>Independent course prototype · {locationsResponse.importStatus.coverage} · No connection to Sweetgreen internal systems</footer>
  </main>;
}
