export default function SourceDetails({ location, sourceName }) {
  return <details className="source-details">
    <summary>Source and import details</summary>
    <p>{location.isSample ? 'Fictional sample records.' : sourceName}</p>
    {location.camis && <p>City permit (CAMIS): {location.camis}</p>}
    {!location.isSample && (location.lastRefreshed ? <p>Last city refresh: {new Date(location.lastRefreshed).toLocaleString()}</p> : <p>{location.matchStatus === 'verified' ? 'City import pending for the matched permit.' : 'City import awaits permit confirmation.'}</p>)}
    {location.coordinatesSource && <p>Map position source: {location.coordinatesSource}</p>}
  </details>;
}
