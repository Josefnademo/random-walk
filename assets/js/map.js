'use strict';
/**
 * Map module — Leaflet real map with animated route drawing.
 * Falls back to SVG preview gracefully if Leaflet is not loaded.
 */

let leafletMap  = null;
let routeLayer  = null;
let markerGroup = null;

// ─── Leaflet Map ─────────────────────────────────────────────────────────────

/**
 * Initialize (or reinitialize) the Leaflet map.
 * @param {string} containerId - ID of the map container element
 * @returns {boolean} true if Leaflet is available and init succeeded
 */
export function initMap(containerId) {
  if (typeof L === 'undefined') return false;

  // Remove existing map instance to avoid "Map container is already initialized"
  if (leafletMap) {
    try { leafletMap.remove(); } catch {}
    leafletMap = null;
  }

  leafletMap = L.map(containerId, {
    zoomControl: true,
    attributionControl: true,
    scrollWheelZoom: true,
  });

  // CartoDB Dark Matter — no API key required
  L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, © <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }
  ).addTo(leafletMap);

  return true;
}

/**
 * Draw the generated route on the Leaflet map with animated markers.
 * @param {Array<[number,number]>} points - Array of [lat, lon] pairs
 */
export function drawRouteOnMap(points) {
  if (!leafletMap) return;

  // Clear previous route
  if (routeLayer)  { try { routeLayer.remove();  } catch {} routeLayer  = null; }
  if (markerGroup) { try { markerGroup.remove(); } catch {} markerGroup = null; }

  markerGroup = L.layerGroup().addTo(leafletMap);

  // Draw dashed route polyline
  routeLayer = L.polyline(points, {
    color:     '#c7ff55',
    weight:    5,
    opacity:   0.9,
    lineCap:   'round',
    lineJoin:  'round',
    dashArray: '12 6',
  }).addTo(leafletMap);

  // Draw markers for each point (skip closing point which equals start)
  points.slice(0, -1).forEach((pt, i) => {
    const isStart = i === 0;
    const html = isStart
      ? `<div class="map-marker map-marker-start" aria-label="Start"><span>GO</span></div>`
      : `<div class="map-marker map-marker-wp" aria-label="Waypoint ${i}"><span>${i}</span></div>`;

    const icon = L.divIcon({
      className: '',
      html,
      iconSize:   isStart ? [44, 44] : [30, 30],
      iconAnchor: isStart ? [22, 22] : [15, 15],
    });

    L.marker(pt, { icon, title: isStart ? 'Start' : `Waypoint ${i}` })
      .addTo(markerGroup);
  });

  // Fit the map to the route bounds with padding
  const bounds = L.latLngBounds(points);
  leafletMap.fitBounds(bounds, { padding: [50, 50], animate: true, duration: 1.0 });
}

export function invalidateMapSize() {
  if (leafletMap) {
    setTimeout(() => leafletMap.invalidateSize(), 100);
  }
}

export function isLeafletReady() {
  return typeof L !== 'undefined';
}

// ─── SVG Fallback Map ─────────────────────────────────────────────────────────

/**
 * Render an animated SVG route preview.
 * Used when Leaflet is not available or as a secondary preview.
 *
 * @param {Array<[number,number]>} points - [lat, lon] pairs
 * @param {string} svgId - ID of the root SVG element
 */
export function drawSVGRoute(points, svgId = 'route-map') {
  const svg = document.getElementById(svgId);
  if (!svg) return;

  const W = 700, H = 440, PAD = 55;

  // Map real-world coords to SVG viewport
  const lats = points.map(p => p[0]);
  const lons  = points.map(p => p[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLon  = Math.min(...lons),  maxLon  = Math.max(...lons);

  const spanLat = maxLat - minLat || 0.001;
  const spanLon  = maxLon  - minLon  || 0.001;

  // Maintain aspect ratio
  const scaleX = (W - PAD * 2) / spanLon;
  const scaleY = (H - PAD * 2) / spanLat;
  const scale  = Math.min(scaleX, scaleY);

  const toX = lon => PAD + (lon - minLon) * scale + (W - PAD * 2 - spanLon * scale) / 2;
  const toY = lat => H - PAD - (lat - minLat) * scale - (H - PAD * 2 - spanLat * scale) / 2;

  const svgPts = points.map(p => [toX(p[1]), toY(p[0])]);

  // Build smooth quadratic bezier path
  let d = `M ${svgPts[0][0].toFixed(1)} ${svgPts[0][1].toFixed(1)}`;
  for (let i = 1; i < svgPts.length; i++) {
    const prev = svgPts[i - 1];
    const curr = svgPts[i];
    const cx   = (prev[0] + curr[0]) / 2;
    const cy   = (prev[1] + curr[1]) / 2;
    d += ` Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${curr[0].toFixed(1)} ${curr[1].toFixed(1)}`;
  }

  const routePath   = svg.querySelector('#route-path');
  const routeShadow = svg.querySelector('#route-shadow');

  // Render background grid
  const gridEl = svg.querySelector('#grid');
  if (gridEl && !gridEl.children.length) {
    gridEl.innerHTML = Array.from({ length: 11 }, (_, i) =>
      `<path d="M ${i * 70} 0 V 440" stroke="#fff" opacity=".03"/>` +
      `<path d="M 0 ${i * 44} H 700" stroke="#fff" opacity=".03"/>`
    ).join('');
  }

  if (routePath) {
    routePath.setAttribute('d', d);
    // Animate the stroke drawing
    const len = routePath.getTotalLength?.() || 1200;
    routePath.style.strokeDasharray  = len;
    routePath.style.strokeDashoffset = len;
    // Force reflow then animate
    void routePath.getBoundingClientRect();
    routePath.style.transition = 'stroke-dashoffset 2s cubic-bezier(0.4,0,0.2,1)';
    routePath.style.strokeDashoffset = '0';
  }
  if (routeShadow) {
    routeShadow.setAttribute('d', d);
  }

  // Render waypoint dots
  const group = svg.querySelector('#route-points');
  if (group) {
    group.innerHTML = svgPts.slice(0, -1).map((p, i) => {
      const isStart = i === 0;
      const delay   = (i * 0.15).toFixed(2);
      return `<g transform="translate(${p[0].toFixed(1)},${p[1].toFixed(1)})"
                 class="svg-wp" style="animation-delay:${delay}s">
        <circle r="${isStart ? 18 : 12}"
                fill="${isStart ? '#c7ff55' : '#1a2035'}"
                stroke="${isStart ? '#c7ff55' : '#60b8ff'}"
                stroke-width="2.5"/>
        <text y="5" text-anchor="middle"
              font-size="${isStart ? 9 : 10}"
              font-weight="900"
              fill="${isStart ? '#0b0d12' : '#f0f1f5'}"
              font-family="inherit">
          ${isStart ? 'GO' : i}
        </text>
      </g>`;
    }).join('');
  }
}
