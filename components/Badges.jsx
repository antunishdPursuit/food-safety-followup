export function Badge({ kind = 'muted', children }) {
  return <span className={`badge badge-${kind}`}>{children}</span>;
}

export function SourceBadge({ source }) {
  const kind = source === 'Fictional demo check' ? 'demo' : ['Manager follow-up', 'Sample follow-up'].includes(source) ? 'muted' : 'public';
  return <Badge kind={kind}>{source}</Badge>;
}
