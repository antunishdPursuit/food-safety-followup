'use client';

export default function Error({ reset }) {
  return <section className="page-error" role="alert"><h1>This view could not load</h1><p>Previously entered follow-ups may still be available in this browser session.</p><button className="secondary-button" onClick={reset}>Try again</button></section>;
}
