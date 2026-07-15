'use strict';
/**
 * Share module — Canvas-based share card generation.
 * Generates Instagram Story (9:16), Square (1:1), and Landscape (16:9) cards.
 * Also handles Web Share API with fallback copy-to-clipboard.
 */

import { SITE_URL, APP_NAME } from './config.js';

// ─── Canvas Utilities ─────────────────────────────────────────────────────────

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line  = '';
  let lineY = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, lineY);
      line  = word;
      lineY += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, lineY);
  return lineY;
}

// ─── Card Painter ─────────────────────────────────────────────────────────────

const FONT = '"Plus Jakarta Sans", "Inter", sans-serif';

/**
 * Draw a share card on an offscreen canvas.
 *
 * @param {Object} stats - { km, minutes, xp, level, levelTitle, calories, achievements }
 * @param {'story'|'square'|'landscape'} type
 * @returns {HTMLCanvasElement}
 */
export async function generateShareCard(stats, type = 'story') {
  // Wait for fonts to be ready
  await document.fonts.ready;

  const sizes = {
    story:     { w: 1080, h: 1920 },
    square:    { w: 1080, h: 1080 },
    landscape: { w: 1920, h: 1080 },
  };

  const { w, h } = sizes[type] || sizes.story;
  const canvas = document.createElement('canvas');
  canvas.width  = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // ── Background gradient ─────────────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0,   '#080b12');
  bg.addColorStop(0.5, '#0f1628');
  bg.addColorStop(1,   '#0b0d1a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // ── Decorative orbs ─────────────────────────────────────────────────────────
  const drawOrb = (cx, cy, r, color) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, color + '40');
    g.addColorStop(1, color + '00');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  };
  drawOrb(w * 0.15, h * 0.15, w * 0.45, '#c7ff55');
  drawOrb(w * 0.85, h * 0.75, w * 0.5,  '#60b8ff');

  // ── Grid pattern ────────────────────────────────────────────────────────────
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  const gridSize = Math.round(w / 14);
  for (let gx = 0; gx <= w; gx += gridSize) {
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
  }
  for (let gy = 0; gy <= h; gy += gridSize) {
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
  }

  const pad = Math.round(w * 0.08);
  const cx  = w / 2;

  if (type === 'story') {
    // ── Brand ──
    ctx.fillStyle = '#c7ff55';
    ctx.font      = `900 ${Math.round(w * 0.055)}px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('RANDOM/WALK', pad, pad + Math.round(w * 0.055));

    // ── Tagline ──
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font      = `500 ${Math.round(w * 0.032)}px ${FONT}`;
    ctx.fillText('Stop deciding. Start walking.', pad, pad + Math.round(w * 0.1));

    // ── Main stat card ──
    const cardY = h * 0.22;
    const cardH = h * 0.28;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    roundRect(ctx, pad, cardY, w - pad * 2, cardH, Math.round(w * 0.06));
    ctx.fill();
    ctx.strokeStyle = 'rgba(199,255,85,0.2)';
    ctx.lineWidth   = 2;
    ctx.stroke();

    // Distance
    ctx.fillStyle = '#c7ff55';
    ctx.font      = `900 ${Math.round(w * 0.24)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(stats.km.toFixed(1), cx, cardY + cardH * 0.54);

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font      = `700 ${Math.round(w * 0.055)}px ${FONT}`;
    ctx.fillText('KILOMETRES', cx, cardY + cardH * 0.75);

    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font      = `500 ${Math.round(w * 0.038)}px ${FONT}`;
    ctx.fillText(`${stats.minutes} MIN  ·  ${stats.calories} KCAL`, cx, cardY + cardH * 0.9);

    // ── XP Row ──
    const xpY = cardY + cardH + h * 0.04;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    roundRect(ctx, pad, xpY, w - pad * 2, h * 0.1, Math.round(w * 0.04));
    ctx.fill();

    ctx.fillStyle = '#60b8ff';
    ctx.font      = `900 ${Math.round(w * 0.065)}px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(`+${stats.xp} XP`, pad + Math.round(w * 0.06), xpY + h * 0.065);

    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font      = `600 ${Math.round(w * 0.038)}px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(`LEVEL ${stats.level} · ${stats.levelTitle}`, w - pad - Math.round(w * 0.06), xpY + h * 0.065);

    // ── Achievements ──
    if (stats.achievements?.length) {
      const achY = xpY + h * 0.14;
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font      = `700 ${Math.round(w * 0.032)}px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.fillText('UNLOCKED TODAY', pad, achY);
      const emojiSize = Math.round(w * 0.1);
      stats.achievements.slice(0, 5).forEach((a, i) => {
        ctx.font = `${emojiSize}px serif`;
        ctx.fillText(a.icon, pad + i * (emojiSize * 1.3), achY + emojiSize * 1.1);
      });
    }

    // ── URL ──
    ctx.fillStyle = 'rgba(199,255,85,0.6)';
    ctx.font      = `600 ${Math.round(w * 0.035)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(SITE_URL.replace('https://', ''), cx, h - pad);

  } else if (type === 'square') {
    const mid = h / 2;

    ctx.fillStyle = '#c7ff55';
    ctx.font      = `900 ${Math.round(w * 0.06)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('RANDOM/WALK', cx, pad + Math.round(w * 0.06));

    ctx.fillStyle = '#c7ff55';
    ctx.font      = `900 ${Math.round(w * 0.22)}px ${FONT}`;
    ctx.fillText(stats.km.toFixed(1) + ' km', cx, mid + Math.round(w * 0.08));

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font      = `600 ${Math.round(w * 0.045)}px ${FONT}`;
    ctx.fillText(`${stats.minutes} min  ·  +${stats.xp} XP  ·  Level ${stats.level}`, cx, mid + Math.round(w * 0.18));

    ctx.fillStyle = 'rgba(199,255,85,0.6)';
    ctx.font      = `500 ${Math.round(w * 0.032)}px ${FONT}`;
    ctx.fillText(SITE_URL.replace('https://', ''), cx, h - pad);
  } else {
    // landscape
    const mid = h / 2;

    ctx.fillStyle = '#c7ff55';
    ctx.font      = `900 ${Math.round(h * 0.1)}px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('RANDOM/WALK', pad, mid - Math.round(h * 0.12));

    ctx.fillStyle = '#fff';
    ctx.font      = `900 ${Math.round(h * 0.18)}px ${FONT}`;
    ctx.fillText(stats.km.toFixed(1) + ' km', pad, mid + Math.round(h * 0.08));

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font      = `600 ${Math.round(h * 0.055)}px ${FONT}`;
    ctx.fillText(`${stats.minutes} min  ·  +${stats.xp} XP  ·  Level ${stats.level}`, pad, mid + Math.round(h * 0.2));
  }

  return canvas;
}

/**
 * Trigger a PNG download from a canvas element.
 */
export function downloadCard(canvas, filename = 'random-walk.png') {
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, 'image/png');
}

/**
 * Share via Web Share API v2 (with file) or fall back to clipboard.
 * @returns {Promise<'shared'|'copied'|'failed'>}
 */
export async function shareNative(canvas, text) {
  const shareText = text || `I just went for a walk with Random Walk! ${SITE_URL}`;

  // Try Web Share API with file
  if (navigator.share && navigator.canShare) {
    try {
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      const file = new File([blob], 'random-walk.png', { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ title: APP_NAME, text: shareText, files: [file] });
        return 'shared';
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        // Fallthrough to text-only share
      } else {
        return 'failed';
      }
    }

    // Text-only share
    try {
      await navigator.share({ title: APP_NAME, text: shareText, url: SITE_URL });
      return 'shared';
    } catch {}
  }

  // Clipboard fallback
  try {
    await navigator.clipboard.writeText(shareText + '\n' + SITE_URL);
    return 'copied';
  } catch {
    return 'failed';
  }
}

/**
 * Generate invite text and copy to clipboard.
 */
export async function copyInviteLink() {
  const text = `Join me on Random Walk — the free walking route generator!\n${SITE_URL}`;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * QR code URL (uses free public QR API — no key needed).
 */
export function qrCodeUrl(data = SITE_URL, size = 200) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&bgcolor=0b0d12&color=c7ff55&margin=10`;
}
