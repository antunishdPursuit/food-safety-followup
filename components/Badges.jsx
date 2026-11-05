export function Badge({ kind = 'muted', children }) {
  return <span className={`badge badge-${kind}`}>{children}</span>;
}

export function SourceBadge({ source }) {
  const kind = source === 'Fictional demo check' ? 'demo' : source === 'Prototype follow-up' ? 'muted' : 'public';
  return <Badge kind={kind}>{source}</Badge>;
}
