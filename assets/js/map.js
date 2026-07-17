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
 * @param {string} containerId
 * @returns {boolean} true if Leaflet is available and init succeeded
 */
export function initMap(containerId) {
  if (typeof L === 'undefined') {
    console.warn('[map] Leaflet (L) is not loaded — map unavailable');
    return false;
  }

  const container = document.getElementById(containerId);
  if (!container) return false;

  // Destroy previous instance to avoid "already initialized" error
  if (leafletMap) {
    try {
      clearUserMarker();
      leafletMap.remove();
    } catch {}
    leafletMap = null;
    routeLayer  = null;
    markerGroup = null;
  }

  // Remove any stale _leaflet_id that prevents re-use of the same div
  if (container._leaflet_id) {
    container._leaflet_id = undefined;
  }

  try {
    leafletMap = L.map(container, {
      zoomControl:       true,
      attributionControl: true,
      scrollWheelZoom:   true,
    });

    // Store reference on DOM element so inline scripts can call invalidateSize
    container._leaflet_map = leafletMap;

    // Primary tile layer — CartoDB Dark Matter (no API key, free, HTTPS)
    const cartoDB = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
        subdomains:  'abcd',
        maxZoom:     19,
      }
    );

    // Fallback tile layer — standard OSM tiles (most widely available)
    const osmFallback = L.tileLayer(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom:     19,
      }
    );

    // Try CartoDB first; fall back to OSM if tiles don't load in 5 s
    let cartoLoaded = false;
    const fallbackTimer = setTimeout(() => {
      if (!cartoLoaded) {
        console.info('[map] CartoDB tiles timeout — switching to OSM fallback');
        leafletMap.removeLayer(cartoDB);
        osmFallback.addTo(leafletMap);
      }
    }, 5000);

    cartoDB.on('tileload', () => {
      cartoLoaded = true;
      clearTimeout(fallbackTimer);
    });

    cartoDB.addTo(leafletMap);

    // Add custom tracking control button
    if (typeof L.Control.Track === 'undefined') {
      L.Control.Track = L.Control.extend({
        options: { position: 'topright' },
        onAdd: function() {
          const btn = L.DomUtil.create('button', 'leaflet-bar leaflet-control leaflet-control-track');
          btn.innerHTML = '🎯';
          btn.title = 'Center on My Location';
          L.DomEvent.on(btn, 'click', (e) => {
            L.DomEvent.stopPropagation(e);
            if (window.onMapTrackClick) window.onMapTrackClick();
          });
          return btn;
        }
      });
    }
    new L.Control.Track().addTo(leafletMap);

    return true;
  } catch (err) {
    console.error('[map] Leaflet init error:', err);
    return false;
  }
}

// Track marker instance
let userMarker = null;

/**
 * Update or draw the user's live pulsing position marker on the Leaflet map.
 */
export function updateUserLocationOnMap(lat, lon, accuracy = 0) {
  if (!leafletMap) return;

  const iconHtml = `<div class="user-position-marker"><div class="user-position-pulse"></div></div>`;
  const icon = L.divIcon({
    className: '',
    html:      iconHtml,
    iconSize:   [24, 24],
    iconAnchor: [12, 12],
  });

  if (userMarker) {
    userMarker.setLatLng([lat, lon]);
  } else {
    userMarker = L.marker([lat, lon], { icon, title: 'Your Location' }).addTo(leafletMap);
  }
}

export function clearUserMarker() {
  if (userMarker && leafletMap) {
    try { leafletMap.removeLayer(userMarker); } catch {}
    userMarker = null;
  }
}

/**
 * Draw the generated route on the Leaflet map with animated markers.
 * @param {Array<[number,number]>} points
 */
export function drawRouteOnMap(points) {
  if (!leafletMap) return;

  // Clear previous
  if (routeLayer)  { try { leafletMap.removeLayer(routeLayer);  } catch {} routeLayer  = null; }
  if (markerGroup) { try { leafletMap.removeLayer(markerGroup); } catch {} markerGroup = null; }

  markerGroup = L.layerGroup().addTo(leafletMap);

  // Markers for each waypoint (skip the closing duplicate of start)
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

    const marker = L.marker(pt, { icon, title: isStart ? 'Start' : `Waypoint ${i}` })
      .addTo(markerGroup);

    if (isStart) {
      marker.on('click', () => {
        const btn = document.getElementById('map-fullscreen-btn');
        if (btn) btn.click();
      });
    }
  });

  // Fit map to route bounds
  const bounds = L.latLngBounds(points);
  leafletMap.fitBounds(bounds, { padding: [50, 50], animate: true, duration: 0.8 });
}

export function invalidateMapSize() {
  if (leafletMap) {
    leafletMap.invalidateSize({ animate: false });
  }
}

export function isLeafletReady() {
  return typeof L !== 'undefined';
}

// ─── Preview (2nd Leaflet instance — read-only, no GPS tracking) ─────────────

let previewMap        = null;
let previewRouteLayer = null;

/**
 * Initialize a static Leaflet map for the Preview tab.
 * No tracking controls, no GPS marker — just tiles + route.
 */
export function initPreviewMap(containerId) {
  if (typeof L === 'undefined') return false;

  const container = document.getElementById(containerId);
  if (!container) return false;

  // Destroy stale instance
  if (previewMap) {
    try { previewMap.remove(); } catch {}
    previewMap = null;
    previewRouteLayer = null;
  }
  if (container._leaflet_id) container._leaflet_id = undefined;

  try {
    previewMap = L.map(container, {
      zoomControl:        true,
      attributionControl: false,
      scrollWheelZoom:    false,
      dragging:           true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom:    19,
    }).addTo(previewMap);

    return true;
  } catch (err) {
    console.error('[map] Preview map init error:', err);
    return false;
  }
}

/**
 * Draw the route on the preview map (lime dashed polyline + numbered markers).
 */
export function drawRouteOnPreviewMap(points) {
  if (!previewMap || !points?.length) return;

  if (previewRouteLayer) {
    try { previewMap.removeLayer(previewRouteLayer); } catch {}
    previewRouteLayer = null;
  }

  const group = L.layerGroup().addTo(previewMap);

  L.polyline(points, {
    color:     '#c7ff55',
    weight:    4,
    opacity:   0.9,
    dashArray: '10 5',
    lineCap:   'round',
  }).addTo(group);

  points.slice(0, -1).forEach((pt, i) => {
    const isStart = i === 0;
    const html = isStart
      ? `<div class="map-marker map-marker-start"><span>GO</span></div>`
      : `<div class="map-marker map-marker-wp"><span>${i}</span></div>`;

    L.marker(pt, {
      icon: L.divIcon({
        className: '',
        html,
        iconSize:   isStart ? [44, 44] : [30, 30],
        iconAnchor: isStart ? [22, 22] : [15, 15],
      }),
    }).addTo(group);
  });

  previewRouteLayer = group;
  previewMap.fitBounds(L.latLngBounds(points), { padding: [40, 40], animate: false });
}

export function invalidatePreviewMapSize() {
  if (previewMap) previewMap.invalidateSize({ animate: false });
}

// ─── SVG Preview Map ──────────────────────────────────────────────────────────

/**
 * Render an animated SVG route preview (used as the "Preview" tab).
 * @param {Array<[number,number]>} points - [lat, lon] pairs
 * @param {string} svgId
 */
export function drawSVGRoute(points, svgId = 'route-map') {
  const svg = document.getElementById(svgId);
  if (!svg || points.length < 2) return;

  const W = 700, H = 440, PAD = 55;

  const lats = points.map(p => p[0]);
  const lons  = points.map(p => p[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLon  = Math.min(...lons),  maxLon  = Math.max(...lons);

  const spanLat = maxLat - minLat || 0.001;
  const spanLon  = maxLon  - minLon  || 0.001;

  const scaleX = (W - PAD * 2) / spanLon;
  const scaleY = (H - PAD * 2) / spanLat;
  const scale  = Math.min(scaleX, scaleY);

  const toX = lon => PAD + (lon - minLon) * scale + (W - PAD * 2 - spanLon * scale) / 2;
  const toY = lat => H - PAD - (lat - minLat) * scale - (H - PAD * 2 - spanLat * scale) / 2;

  const svgPts = points.map(p => [toX(p[1]), toY(p[0])]);

  // Smooth bezier path
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

  // Background grid
  const gridEl = svg.querySelector('#grid');
  if (gridEl && !gridEl.children.length) {
    gridEl.innerHTML = Array.from({ length: 11 }, (_, i) =>
      `<path d="M ${i * 70} 0 V 440" stroke="#fff" opacity=".04"/>` +
      `<path d="M 0 ${i * 44} H 700" stroke="#fff" opacity=".04"/>`
    ).join('');
  }

  if (routePath) {
    routePath.setAttribute('d', d);
    const len = routePath.getTotalLength?.() || 1200;
    routePath.style.strokeDasharray  = len;
    routePath.style.strokeDashoffset = len;
    void routePath.getBoundingClientRect(); // force reflow
    routePath.style.transition = 'stroke-dashoffset 2s cubic-bezier(0.4,0,0.2,1)';
    routePath.style.strokeDashoffset = '0';
  }
  if (routeShadow) {
    routeShadow.setAttribute('d', d);
  }

  // Waypoint dots with pop-in animation
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
