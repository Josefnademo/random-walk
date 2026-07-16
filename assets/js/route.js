'use strict';
/**
 * Route generation math — clean port from original app.js with improvements.
 * No external dependencies.
 */

const rad = n => n * Math.PI / 180;
const deg = n => n * 180 / Math.PI;

/**
 * Calculate a destination point on a sphere given start, bearing, and distance.
 * Uses Haversine formula (spherical earth approximation).
 */
function destination(lat, lon, bearing, distanceKm) {
  const R  = 6371; // Earth radius km
  const d  = distanceKm / R;
  const b  = rad(bearing);
  const p1 = rad(lat);
  const l1 = rad(lon);

  const p2 = Math.asin(
    Math.sin(p1) * Math.cos(d) +
    Math.cos(p1) * Math.sin(d) * Math.cos(b)
  );
  const l2 = l1 + Math.atan2(
    Math.sin(b) * Math.sin(d) * Math.cos(p1),
    Math.cos(d) - Math.sin(p1) * Math.sin(p2)
  );

  return [deg(p2), ((deg(l2) + 540) % 360) - 180];
}

/**
 * Build a random looping walk route.
 *
 * @param {number} lat      - Start latitude
 * @param {number} lon      - Start longitude
 * @param {number} minutes  - Walk duration
 * @param {string} energy   - 'easy' | 'medium' | 'bold'
 * @returns {{ pts: [number,number][], totalKm: number, calories: number }}
 */
export function buildRoute(lat, lon, minutes, energy) {
  // Realistic walking speeds (km/h) — used to estimate total loop distance
  const speed   = energy === 'easy' ? 4.0 : energy === 'medium' ? 4.8 : 5.5;
  const totalKm = speed * minutes / 60;

  // FIX: The route is a roughly circular loop. The circumference of a circle
  // is 2πr, so r = totalKm / (2π). But each straight leg between waypoints
  // is a chord, not an arc — Google Maps walking routing adds extra distance
  // following actual streets. Dividing by π instead of 2π gives a radius that
  // results in a Google Maps route close to the intended walking distance.
  const radius = Math.max(0.08, totalKm / (Math.PI * 2.2));

  const count        = minutes <= 10 ? 3 : minutes <= 30 ? 4 : 5;
  const startBearing = Math.random() * 360;

  const pts = [[lat, lon]];
  for (let i = 1; i <= count; i++) {
    // Evenly space waypoints around the circle, with slight random angle jitter
    const angle = startBearing + (360 / count) * i + (Math.random() * 20 - 10);
    // Slight radius variation (±10%) for a natural-feeling loop
    const r     = radius * (0.9 + Math.random() * 0.2);
    pts.push(destination(lat, lon, angle, r));
  }
  pts.push([lat, lon]); // close the loop

  // Reported distance: actual street routing is ~20-30% longer than straight lines
  const actualKm = totalKm * (0.95 + Math.random() * 0.1);

  // Calorie estimate: MET 3.5 × 70 kg average × hours
  const calories = Math.round(3.5 * 70 * (minutes / 60));

  return { pts, totalKm: +actualKm.toFixed(2), calories };
}

/**
 * Build Google Maps walking URL from waypoints.
 */
export function googleUrl(points) {
  const origin = points[0].join(',');
  const dest   = points.at(-1).join(',');
  const wps    = points.slice(1, -1).map(p => p.join(',')).join('|');
  return (
    'https://www.google.com/maps/dir/?api=1' +
    `&origin=${encodeURIComponent(origin)}` +
    `&destination=${encodeURIComponent(dest)}` +
    `&waypoints=${encodeURIComponent(wps)}` +
    '&travelmode=walking'
  );
}

/**
 * OpenStreetMap area link centered on start.
 */
export function osmUrl(lat, lon) {
  return `https://www.openstreetmap.org/#map=15/${lat.toFixed(6)}/${lon.toFixed(6)}`;
}

/**
 * Human-readable step directions.
 */
export function directionSteps(points) {
  const waypoints = points.slice(1, -1);
  return waypoints.map((_, i) => {
    const num  = i + 1;
    const last = i === waypoints.length - 1;
    if (last) return `Head toward waypoint ${num}, then loop back to your start`;
    return `Continue to waypoint ${num}`;
  });
}

/**
 * Estimate XP reward for a completed walk.
 */
export function walkXP(minutes, energy) {
  const base        = 50;
  const timeBonus   = Math.floor(minutes * 1.5);
  const energyBonus = energy === 'easy' ? 0 : energy === 'medium' ? 15 : 30;
  return base + timeBonus + energyBonus;
}

/**
 * Format a distance value according to unit preference.
 */
export function fmtDistance(km, units = 'metric') {
  if (units === 'imperial') {
    const miles = km * 0.621371;
    return miles < 0.5
      ? `${Math.round(miles * 5280)} ft`
      : `${miles.toFixed(2)} mi`;
  }
  return km < 1
    ? `${Math.round(km * 1000)} m`
    : `${km.toFixed(2)} km`;
}
