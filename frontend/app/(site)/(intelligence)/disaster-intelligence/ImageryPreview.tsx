'use client';

import { useEffect, useRef } from 'react';
import maplibregl, { type Map as MLMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { ImageryLayer } from '@/lib/types';

const BASE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png', 'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors © CARTO',
    },
  },
  layers: [{ id: 'carto', type: 'raster', source: 'carto' }],
};

/** Small single-layer preview map for the imagery catalogue. */
export default function ImageryPreview({ layer, tiles }: { layer: ImageryLayer | null; tiles: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (!ref.current) return;
    const map = new maplibregl.Map({
      container: ref.current, style: BASE, center: [84.5, 21.5], zoom: 4.6,
      attributionControl: { compact: true }, cooperativeGestures: true,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.on('load', () => { loaded.current = true; map.fire('volentify:ready'); });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; loaded.current = false; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      if (map.getLayer('overlay')) map.removeLayer('overlay');
      if (map.getSource('overlay')) map.removeSource('overlay');
      if (!layer || tiles.length === 0) return;
      map.addSource('overlay', { type: 'raster', tiles, tileSize: 256, maxzoom: layer.max_zoom, attribution: layer.provider });
      map.addLayer({ id: 'overlay', type: 'raster', source: 'overlay', paint: { 'raster-opacity': layer.id === 'rainviewer' ? 0.75 : 1 } });
    };
    if (loaded.current) apply();
    else map.once('volentify:ready', apply);
  }, [layer, tiles]);

  return <div ref={ref} className="h-full w-full" role="region" aria-label={`Preview of ${layer?.label ?? 'imagery'}`} />;
}
