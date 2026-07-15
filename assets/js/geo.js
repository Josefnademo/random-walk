'use strict';
/**
 * Geolocation module — real GPS with retry, accuracy feedback, and graceful errors.
 */

const HIGH_OPTS = { enableHighAccuracy: true,  timeout: 15_000, maximumAge: 30_000 };
const LOW_OPTS  = { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 };

/**
 * Human-readable error messages for each GeolocationPositionError code.
 */
function errorMsg(err) {
  if (!navigator.geolocation)
    return 'Your browser does not support location services. Try Chrome or Firefox.';
  switch (err?.code) {
    case 1:
      return 'Location access was denied. Allow location in your browser settings, then try again.';
    case 2:
      return 'Your device cannot determine a position. Move to an open area or check GPS settings.';
    case 3:
      return 'Location request timed out. Check that GPS/Wi-Fi is enabled and try again.';
    default:
      return 'Location is unavailable. Make sure you are on HTTPS with location enabled.';
  }
}

/**
 * Get current GPS position with automatic fallback from high → low accuracy.
 *
 * @param {Function} onProgress - (message: string, percent: number) => void
 * @returns {Promise<GeolocationPosition>}
 */
export async function getPosition(onProgress) {
  if (!navigator.geolocation) {
    throw new Error(errorMsg(null));
  }

  onProgress?.('Requesting location permission…', 10);

  return new Promise((resolve, reject) => {
    let resolved = false;

    const tryLow = (err) => {
      // High-accuracy timed out — retry with low accuracy
      if (err?.code === 3) {
        onProgress?.('Retrying with network location…', 55);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (resolved) return;
            resolved = true;
            const acc = Math.round(pos.coords.accuracy);
            onProgress?.(`Location found (±${acc} m)`, 100);
            resolve(pos);
          },
          (err2) => {
            if (!resolved) reject(new Error(errorMsg(err2)));
          },
          LOW_OPTS
        );
      } else {
        reject(new Error(errorMsg(err)));
      }
    };

    onProgress?.('Acquiring GPS signal…', 30);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (resolved) return;
        resolved = true;
        const acc = Math.round(pos.coords.accuracy);
        onProgress?.(`Location found (±${acc} m)`, 100);
        resolve(pos);
      },
      tryLow,
      HIGH_OPTS
    );
  });
}

/**
 * Non-blocking permission check.
 * @returns {Promise<'granted'|'denied'|'prompt'|'unsupported'>}
 */
export async function checkPermission() {
  if (!navigator.geolocation) return 'unsupported';
  if (!navigator.permissions)  return 'prompt';
  try {
    const { state } = await navigator.permissions.query({ name: 'geolocation' });
    return state;
  } catch {
    return 'prompt';
  }
}

/**
 * Accuracy quality label + color for the GPS indicator.
 */
export function accuracyLabel(meters) {
  if (meters < 15)  return { label: 'Excellent GPS', color: '#c7ff55' };
  if (meters < 50)  return { label: 'Good GPS',      color: '#60b8ff' };
  if (meters < 100) return { label: 'Fair GPS',      color: '#fbbf24' };
  return                   { label: 'Weak GPS',      color: '#f87171' };
}
