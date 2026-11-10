import Link from 'next/link';

export default function NotFound() {
  return <section className="page-error"><h1>Page not found</h1><p>The requested screen is unavailable.</p><Link href="/locations">Back to locations</Link></section>;
}
