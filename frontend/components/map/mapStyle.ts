import type { StyleSpecification } from 'maplibre-gl';

export const DARK_STYLE_URL =
  process.env.NEXT_PUBLIC_MAPLIBRE_STYLE || 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

/** Raster fallback if the vector style cannot be fetched. */
export const RASTER_FALLBACK: StyleSpecification = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
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

// Terrarium-encoded global DEM (Mapzen / AWS Open Data terrain tiles).
export const DEM_TILES = ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'];
export const DEM_ATTRIBUTION = 'Terrain: Mapzen / AWS Open Data';

export const RAINVIEWER_INDEX = 'https://api.rainviewer.com/public/weather-maps.json';

export const INDIA_VIEW = { center: [80.5, 22.4] as [number, number], zoom: 4.2 };

export function firstSymbolLayer(style: StyleSpecification | undefined): string | undefined {
  return style?.layers.find((l) => l.type === 'symbol')?.id;
}
