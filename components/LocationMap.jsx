'use client';

import { useEffect, useRef } from 'react';

export default function LocationMap({ locations, selectedId, onSelect }) {
  const host = useRef(null);
  const map = useRef(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  useEffect(() => {
    let cancelled = false;
    let markers;
    import('leaflet').then((L) => {
      if (cancelled || !host.current) return;
      map.current = L.map(host.current, { scrollWheelZoom: false }).setView([40.735, -73.975], 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
        maxZoom: 18,
      }).addTo(map.current);
      markers = L.layerGroup().addTo(map.current);
      locations.filter((location) => location.coordinates).forEach((location) => {
        const selected = location.id === selectedId;
        const marker = L.circleMarker(location.coordinates, {
          radius: selected ? 12 : 9,
          color: '#FFFDFA', weight: 3,
          fillColor: selected ? '#0E5A6B' : '#1C1B19', fillOpacity: 1,
        }).addTo(markers);
        marker.bindTooltip(location.name);
        marker.on('click', () => selectRef.current(location.id));
      });
    });
    return () => { cancelled = true; map.current?.remove(); map.current = null; };
  }, [locations, selectedId]);

  return <div className="map" ref={host} role="img" aria-label="Map of sample NYC locations. Use the complete location list beside the map for keyboard navigation." />;
}
