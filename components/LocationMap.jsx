'use client';

import { useEffect, useRef } from 'react';
import { permitStatusLabel } from '../lib/presentation';

export default function LocationMap({ locations, selectedId, selectionRevision, onSelect }) {
  const host = useRef(null);
  const map = useRef(null);
  const markerRefs = useRef(new Map());
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
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
      const colors = getComputedStyle(host.current);
      const positions = locations.filter((location) => location.coordinates).map((location) => location.coordinates);
      if (positions.length) map.current.fitBounds(positions, { padding: [24, 24], maxZoom: 13 });
      locations.filter((location) => location.coordinates).forEach((location) => {
        const selected = location.id === selectedRef.current;
        const marker = L.circleMarker(location.coordinates, {
          radius: selected ? 12 : 9,
          color: colors.getPropertyValue('--surface').trim(), weight: 3,
          fillColor: colors.getPropertyValue('--primary').trim(), fillOpacity: 1,
        }).addTo(markers);
        const label = document.createElement('span');
        label.textContent = `${location.name} · ${permitStatusLabel(location)}`;
        marker.bindTooltip(label);
        const popup = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = location.name;
        const address = document.createElement('p');
        address.textContent = location.address;
        const link = document.createElement('a');
        link.href = `/locations/${encodeURIComponent(location.id)}`;
        link.className = 'primary-button';
        link.textContent = 'Open location';
        popup.append(title, address, link);
        marker.bindPopup(popup);
        markerRefs.current.set(location.id, marker);
        marker.on('click', () => selectRef.current(location.id));
        if (selected) marker.openPopup();
      });
    });
    return () => { cancelled = true; markerRefs.current.clear(); map.current?.remove(); map.current = null; };
  }, [locations]);

  useEffect(() => {
    markerRefs.current.forEach((marker, id) => {
      marker.setRadius(id === selectedId ? 12 : 9);
      if (id === selectedId) {
        marker.openPopup();
        map.current?.panInside(marker.getLatLng(), { padding: [24, 24] });
      }
    });
    if (!markerRefs.current.has(selectedId)) map.current?.closePopup();
  }, [selectedId, selectionRevision]);

  return <div className="map" ref={host} role="region" aria-label="Map of NYC locations. The location list provides keyboard access to every record." />;
}
