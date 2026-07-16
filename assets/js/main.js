'use strict';
/**
 * main.js — Application entry point.
 * Orchestrates all modules: GPS → route → map → gamification → share.
 */

import { SITE_URL } from './config.js';
import { Storage  } from './storage.js';
import { getPosition, checkPermission, accuracyLabel } from './geo.js';
import { buildRoute, googleUrl, osmUrl, directionSteps, walkXP, fmtDistance } from './route.js';
import { initMap, drawRouteOnMap, drawSVGRoute, invalidateMapSize, isLeafletReady } from './map.js';
import { getDailyChallenges, getChallengeState, completeChallenge, isChallengeCompleted, RARITY } from './challenges.js';
import { addXP, getLevelFromXP, getProgressInfo, getTitle, checkAchievements, ACHIEVEMENTS } from './gamification.js';
import { generateShareCard, downloadCard, shareNative, copyInviteLink, qrCodeUrl } from './share.js';
import {
  showToast, showAchievement, showLevelUp, triggerConfetti, floatXP,
  animateCounter, animateXPBar, openModal, closeModal,
  initHamburger, initRevealAnimations, setGPSState, initSlider,
  prefersReducedMotion,
} from './ui.js';

// ─── App State ────────────────────────────────────────────────────────────────

const state = {
  position:      null,  // GeolocationCoordinates
  route:         null,  // { pts, totalKm, calories }
  minutes:       20,
  energy:        'easy',
  missionOn:     true,
  mission:       '',
  lastShareCard: null,  // HTMLCanvasElement
};

// ─── Session persistence ──────────────────────────────────────────────────────
// Saves the active walk to sessionStorage so navigating away and back
// restores the map and game state.

const SESSION_KEY = 'rw2_activeWalk';

function saveSession() {
  if (!state.route) return;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      route:    state.route,
      minutes:  state.minutes,
      energy:   state.energy,
      missionOn: state.missionOn,
      mission:  state.mission,
      position: state.position ? {
        latitude:  state.position.latitude,
        longitude: state.position.longitude,
        accuracy:  state.position.accuracy,
      } : null,
    }));
  } catch {}
}

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (!s?.route?.pts) return false;
    state.route    = s.route;
    state.minutes  = s.minutes  ?? 20;
    state.energy   = s.energy   ?? 'easy';
    state.missionOn = s.missionOn ?? true;
    state.mission  = s.mission  ?? '';
    state.position = s.position  ?? null;
    return true;
  } catch { return false; }
}

function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch {}
}

// ─── Photo Missions ───────────────────────────────────────────────────────────

const MISSIONS = [
  'Find a yellow door.',
  'Photograph a reflection.',
  'Find something shaped like a face.',
  'Spot three different birds.',
  'Find a tiny piece of street art.',
  'Photograph the oldest-looking building you see.',
  'Find a red bicycle.',
  'Spot a round window.',
  'Find three objects of the same color.',
  'Notice a tree taller than the nearest building.',
  'Find a sign with an unusual word.',
  'Photograph an interesting shadow.',
  'Find a tiny garden.',
  'Spot a building with an animal symbol.',
  'Find something that appears very old.',
  'Photograph letters formed by shadows.',
  'Find a free public viewpoint.',
  'Look for a surprising color combination.',
  'Find a door that tells a story.',
  'Spot a street name that makes you smile.',
];

function randomMission() {
  return MISSIONS[Math.floor(Math.random() * MISSIONS.length)];
}

// ─── XP / Level UI Updates ───────────────────────────────────────────────────

function updateXPUI(xp, animate = false) {
  const info = getProgressInfo(xp);

  const xpBar  = document.getElementById('xp-bar-fill');
  const xpAmt  = document.getElementById('xp-amount');
  const lvlBdg = document.getElementById('level-badge');
  const lvlTtl = document.getElementById('level-title');

  if (lvlBdg) lvlBdg.textContent = `Lv ${info.level}`;
  if (lvlTtl) lvlTtl.textContent = info.title;
  if (xpAmt)  xpAmt.textContent  = xp.toLocaleString() + ' XP';

  if (xpBar) {
    if (animate) {
      animateXPBar(xpBar, info.progress);
    } else {
      xpBar.style.width = `${info.progress}%`;
    }
    xpBar.setAttribute('aria-valuenow', Math.round(info.progress));
    xpBar.setAttribute('title', info.isMax ? 'Max level reached!' : `${info.needed} XP to next level`);
  }

  const statsXP  = document.getElementById('stats-xp');
  const statsLvl = document.getElementById('stats-level');
  if (statsXP)  statsXP.textContent  = xp.toLocaleString();
  if (statsLvl) statsLvl.textContent = info.level;
}

// ─── Daily Challenges ────────────────────────────────────────────────────────

function renderChallenges() {
  const container = document.getElementById('challenges-list');
  if (!container) return;

  const challenges  = getDailyChallenges();
  const chState     = getChallengeState();
  const acceptedId  = sessionStorage.getItem('acceptedChallenge');

  container.innerHTML = challenges.map(ch => {
    const r    = RARITY[ch.rarity];
    const done = !!chState.completed[ch.id];
    const isAccepted = acceptedId === ch.id;

    return `
      <article class="challenge-card ${done ? 'challenge-done' : ''} ${isAccepted ? 'challenge-accepted' : ''}"
               data-id="${ch.id}"
               data-rarity="${ch.rarity}"
               style="--rarity-color:${r.color};--rarity-bg:${r.bg};--rarity-border:${r.border}">
        <header class="challenge-header">
          <span class="challenge-rarity">${r.label}</span>
          ${done ? '<span class="challenge-checkmark" aria-label="Completed">✓</span>' : ''}
          ${isAccepted && !done ? '<span class="challenge-active-badge">ACTIVE ▶</span>' : ''}
        </header>
        <div class="challenge-icon" aria-hidden="true">${ch.icon}</div>
        <h3 class="challenge-title">${ch.title}</h3>
        <p class="challenge-desc">${ch.desc}</p>
        <footer class="challenge-footer">
          <span class="challenge-xp">+${ch.xp} XP</span>
          ${ch.est ? `<span class="challenge-est">~${ch.est} min</span>` : ''}
        </footer>
        ${done
          ? '<div class="challenge-complete-label">Completed! ✓</div>'
          : isAccepted
            ? '<div class="challenge-active-label">Challenge active — complete your walk to earn XP</div>'
            : `<button class="challenge-accept-btn" data-id="${ch.id}" aria-label="Accept ${ch.title}">Accept Challenge</button>`
        }
      </article>`;
  }).join('');

  // Accept buttons
  container.querySelectorAll('.challenge-accept-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const ch = challenges.find(c => c.id === id);

      // Save accepted challenge
      sessionStorage.setItem('acceptedChallenge', id);

      // Instant visual feedback — re-render challenges
      renderChallenges();

      showToast(`✓ "${ch?.title}" accepted! Generate a walk to start.`, 'success', 4500);

      // Scroll to generator smoothly
      setTimeout(() => {
        document.getElementById('generator')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 400);
    });
  });
}

// ─── Achievements Gallery ────────────────────────────────────────────────────

function renderAchievements() {
  const container = document.getElementById('achievements-grid');
  if (!container) return;

  const unlocked = Storage.getAchievements();

  container.innerHTML = ACHIEVEMENTS.map(a => {
    const done = unlocked.includes(a.id);
    return `
      <div class="achievement-badge ${done ? 'badge-unlocked' : 'badge-locked'}"
           title="${a.title}: ${a.desc}"
           aria-label="${a.title}${done ? ' (unlocked)' : ' (locked)'}">
        <span class="badge-icon">${done ? a.icon : '🔒'}</span>
        <span class="badge-name">${a.title}</span>
        ${done ? `<span class="badge-xp">+${a.xpBonus} XP</span>` : ''}
      </div>`;
  }).join('');
}

// ─── Stats Section ────────────────────────────────────────────────────────────

function renderStats() {
  const s  = Storage.getStats();
  const st = Storage.getStreaks();

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  set('stats-walks',    s.walkCount);
  set('stats-km',       s.totalKm.toFixed(1));
  set('stats-streak',   st.current);
  set('stats-longest',  st.longest);
  set('stats-xp',       s.xp.toLocaleString());
  set('stats-level',    s.level);
  set('stats-level-2',  s.level);
}

// ─── Result Section ───────────────────────────────────────────────────────────

function showResult(route, minutes, energy, missionOn, skipMapInit = false) {
  const resultSection = document.getElementById('result');
  if (!resultSection) return;

  // Fill stats
  const set = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  set('stat-time',     minutes);
  set('stat-distance', route.totalKm.toFixed(2));
  set('stat-turns',    route.pts.length - 2);
  set('stat-calories', route.calories);

  // Directions
  const dirList = document.getElementById('directions');
  if (dirList) {
    dirList.innerHTML = directionSteps(route.pts)
      .map((step, i) => `<li><span class="dir-num">${i + 1}</span>${step}</li>`)
      .join('');
  }

  // Map links
  const gmLink  = document.getElementById('google-link');
  const osmLink = document.getElementById('osm-link');
  if (gmLink)  gmLink.href  = googleUrl(route.pts);
  if (osmLink) osmLink.href = osmUrl(route.pts[0][0], route.pts[0][1]);

  // Photo mission
  const missionBox  = document.getElementById('mission-box');
  const missionText = document.getElementById('mission-text');
  if (missionBox)  missionBox.hidden  = !missionOn;
  if (missionText) missionText.textContent = state.mission;

  // ── FIX: Show section FIRST so the map container has real dimensions ──
  resultSection.hidden = false;
  resultSection.setAttribute('aria-hidden', 'false');

  // Always draw SVG fallback (instant, no tiles needed)
  drawSVGRoute(route.pts, 'route-map');

  // Then init Leaflet — now the container is visible and has real size
  if (!skipMapInit && isLeafletReady()) {
    // Small delay so the browser completes layout before Leaflet measures
    setTimeout(() => {
      const mapReady = initMap('leaflet-map');
      if (mapReady) {
        drawRouteOnMap(route.pts);
        invalidateMapSize();
      }
    }, 80);
  }

  // Smooth scroll
  setTimeout(() => {
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);

  // Save session so navigating away and back restores the game
  saveSession();

  // Award generation XP (only on new generate, not on session restore)
  if (!skipMapInit) {
    const { newXP, leveledUp, newLevel, newAchievements } = addXP(10);
    updateXPUI(newXP, true);
    Storage.incrementGenerates();

    if (leveledUp) {
      setTimeout(() => showLevelUp(newLevel, getTitle(newLevel)), 800);
    }
    newAchievements.forEach((a, i) => {
      setTimeout(() => showAchievement(a), i * 800 + 500);
    });
  }
}

// ─── Walk Completion ──────────────────────────────────────────────────────────

async function completeWalk() {
  if (!state.route) return;

  const { pts, totalKm, calories } = state.route;
  const { minutes, energy, missionOn } = state;

  // Update streaks + storage
  const streakData = Storage.updateStreak();
  const { count, totalKm: cumKm } = Storage.addWalk({
    km: totalKm,
    xpEarned: walkXP(minutes, energy),
    missionEnabled: missionOn,
  });

  // XP calculation
  const xpEarned = walkXP(minutes, energy)
    + (streakData.current > 1 ? 15 * Math.min(streakData.current, 10) : 0);

  const ctx = {
    walkCount: count,
    totalKm:   cumKm,
    sessionKm: totalKm,
    streak:    streakData.current,
    energy,
    hour:      new Date().getHours(),
    missions:  Storage.getStats().missions,
    shares:    Storage.getStats().shares,
  };

  const { newXP, leveledUp, newLevel, newAchievements } = addXP(xpEarned, ctx);

  // Check accepted challenge
  const acceptedId = sessionStorage.getItem('acceptedChallenge');
  if (acceptedId) {
    const didComplete = completeChallenge(acceptedId);
    sessionStorage.removeItem('acceptedChallenge');
    if (didComplete) {
      const challenges = getDailyChallenges();
      const ch = challenges.find(c => c.id === acceptedId);
      if (ch) {
        addXP(ch.xp);
        showToast(`Challenge "${ch.title}" completed! +${ch.xp} XP`, 'success');
      }
    }
  }

  // Clear session — walk is done
  clearSession();

  // Hide result, show reward
  const resultSection = document.getElementById('result');
  const rewardSection = document.getElementById('reward');
  if (resultSection) resultSection.hidden = true;

  if (rewardSection) {
    const set = (id, val) => { const e = rewardSection.querySelector(`#${id}`); if (e) e.textContent = val; };
    set('reward-km',       totalKm.toFixed(2));
    set('reward-minutes',  minutes);
    set('reward-calories', calories);
    set('reward-xp',       `+${xpEarned}`);
    set('reward-streak',   streakData.current);
    set('reward-walks',    count);

    // Achievements in reward
    const achContainer = rewardSection.querySelector('#reward-achievements');
    if (achContainer && newAchievements.length) {
      achContainer.innerHTML = newAchievements
        .map(a => `<div class="reward-ach"><span>${a.icon}</span><span>${a.title}</span></div>`)
        .join('');
      achContainer.hidden = false;
    } else if (achContainer) {
      achContainer.hidden = true;
    }

    rewardSection.hidden = false;
    rewardSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  updateXPUI(newXP, true);
  floatXP(xpEarned, document.getElementById('xp-bar-fill'));

  if (!prefersReducedMotion()) {
    triggerConfetti(rewardSection || document.body, 100);
  }

  if (leveledUp) {
    setTimeout(() => showLevelUp(newLevel, getTitle(newLevel)), 1200);
  }

  newAchievements.forEach((a, i) => {
    setTimeout(() => showAchievement(a), i * 900 + 1000);
  });

  renderAchievements();
  renderStats();
  renderChallenges();

  // Generate share card in background
  try {
    const shareStats = {
      km:           totalKm,
      minutes,
      xp:           xpEarned,
      level:        newLevel,
      levelTitle:   getTitle(newLevel),
      calories,
      achievements: newAchievements,
    };
    state.lastShareCard = await generateShareCard(shareStats, 'story');
  } catch (e) {
    console.warn('Share card generation failed:', e);
  }
}

// ─── Form Submit / Generate ───────────────────────────────────────────────────

async function generate(e) {
  e?.preventDefault();

  const form      = document.getElementById('walk-form');
  const data      = new FormData(form);
  state.minutes   = Number(data.get('minutes'))  || 20;
  state.energy    = data.get('energy')           || 'easy';
  state.missionOn = document.getElementById('mission-enabled')?.checked ?? true;
  state.mission   = randomMission();

  setGPSState('loading', 'Requesting location permission…', 10);

  // Hide previous result/reward
  const resultEl = document.getElementById('result');
  const rewardEl = document.getElementById('reward');
  if (resultEl) resultEl.hidden = true;
  if (rewardEl) rewardEl.hidden = true;

  try {
    const pos      = await getPosition((msg, pct) => setGPSState('loading', msg, pct));
    state.position = pos.coords;

    setGPSState('idle');

    const route = buildRoute(
      state.position.latitude,
      state.position.longitude,
      state.minutes,
      state.energy
    );
    state.route = route;

    showResult(route, state.minutes, state.energy, state.missionOn, false);

  } catch (err) {
    setGPSState('error', err.message);
  }
}

// ─── Share Flow ───────────────────────────────────────────────────────────────

async function handleShare(type = 'story') {
  if (!state.route) return;

  const stats = {
    km:         state.route.totalKm,
    minutes:    state.minutes,
    xp:         walkXP(state.minutes, state.energy),
    level:      getLevelFromXP(Storage.getXP()),
    levelTitle: getTitle(getLevelFromXP(Storage.getXP())),
    calories:   state.route.calories,
    achievements: [],
  };

  try {
    const canvas = await generateShareCard(stats, type);

    const preview = document.getElementById('share-preview');
    if (preview) {
      preview.innerHTML = '';
      const img = canvas.toDataURL('image/png');
      const el  = document.createElement('img');
      el.src = img;
      el.alt = 'Share card preview';
      el.className = 'share-preview-img';
      preview.appendChild(el);
    }
    state.lastShareCard = canvas;
    openModal('share-modal');

    Storage.incrementShares();
    checkAchievements({ shares: Storage.getStats().shares });
  } catch (err) {
    showToast('Could not generate share card. Try again.', 'error');
  }
}

// ─── PWA Service Worker ───────────────────────────────────────────────────────

function registerSW() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(e => {
        console.info('SW registration skipped:', e.message);
      });
    });
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function init() {
  Storage.init();
  registerSW();

  const stats = Storage.getStats();
  updateXPUI(stats.xp);
  renderStats();
  renderChallenges();
  renderAchievements();

  // ── Restore active walk session if user navigated away ──
  if (loadSession()) {
    // Re-render form to match restored state
    const minutesInput = document.querySelector(`input[name="minutes"][value="${state.minutes}"]`);
    const energyInput  = document.querySelector(`input[name="energy"][value="${state.energy}"]`);
    if (minutesInput) minutesInput.checked = true;
    if (energyInput)  energyInput.checked  = true;
    const missionToggle = document.getElementById('mission-enabled');
    if (missionToggle) missionToggle.checked = state.missionOn;

    // Show the result section with skipMapInit=true (map init runs after 80ms delay inside showResult)
    showResult(state.route, state.minutes, state.energy, state.missionOn, true);

    // Then initialize the map (skipMapInit avoids XP award but still draws the map)
    setTimeout(() => {
      if (isLeafletReady()) {
        const mapReady = initMap('leaflet-map');
        if (mapReady) {
          drawRouteOnMap(state.route.pts);
          invalidateMapSize();
        }
      }
    }, 150);

    showToast('Walk restored! Your route is still active.', 'info', 3000);
  }

  // Wire form
  const form = document.getElementById('walk-form');
  form?.addEventListener('submit', generate);

  // Map view tabs (Live Map ↔ Preview SVG)
  const tabLive    = document.getElementById('tab-live');
  const tabPreview = document.getElementById('tab-preview');
  const liveWrap   = document.getElementById('leaflet-map-wrap');
  const svgWrap    = document.getElementById('svg-map-wrap');

  tabLive?.addEventListener('click', () => {
    tabLive.classList.add('active');
    tabPreview?.classList.remove('active');
    tabLive.setAttribute('aria-selected', 'true');
    tabPreview?.setAttribute('aria-selected', 'false');
    if (liveWrap) liveWrap.hidden = false;
    if (svgWrap)  svgWrap.hidden  = true;
    // Leaflet needs its container to be visible before tiles load
    invalidateMapSize();
  });

  tabPreview?.addEventListener('click', () => {
    tabPreview.classList.add('active');
    tabLive?.classList.remove('active');
    tabPreview.setAttribute('aria-selected', 'true');
    tabLive?.setAttribute('aria-selected', 'false');
    if (svgWrap)  svgWrap.hidden  = false;
    if (liveWrap) liveWrap.hidden = true;
  });

  // Regenerate button
  document.getElementById('regenerate')?.addEventListener('click', () => {
    if (state.position) {
      const route = buildRoute(
        state.position.latitude,
        state.position.longitude,
        state.minutes,
        state.energy
      );
      state.route   = route;
      state.mission = randomMission();
      showResult(route, state.minutes, state.energy, state.missionOn, false);
    } else {
      generate();
    }
  });

  // Complete walk button
  document.getElementById('complete')?.addEventListener('click', completeWalk);

  // New walk (from reward screen)
  document.getElementById('new-walk')?.addEventListener('click', () => {
    const rewardEl = document.getElementById('reward');
    if (rewardEl) rewardEl.hidden = true;
    document.getElementById('generator')?.scrollIntoView({ behavior: 'smooth' });
  });

  // Retry GPS
  document.getElementById('gps-retry')?.addEventListener('click', generate);

  // Result section "Share" button → open modal with story card
  document.getElementById('result-share-btn')?.addEventListener('click', () => handleShare('story'));

  // Reward screen share button
  document.getElementById('reward-share-btn')?.addEventListener('click', () => handleShare('story'));

  // Modal type-tab buttons → switch card type in-place (no modal re-open)
  document.querySelectorAll('.share-type-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const type = btn.dataset.type;
      if (!type) return;

      document.querySelectorAll('.share-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (!state.route) return;
      const stats = {
        km:         state.route.totalKm,
        minutes:    state.minutes,
        xp:         walkXP(state.minutes, state.energy),
        level:      getLevelFromXP(Storage.getXP()),
        levelTitle: getTitle(getLevelFromXP(Storage.getXP())),
        calories:   state.route.calories,
        achievements: [],
      };
      const preview = document.getElementById('share-preview');
      if (preview) preview.innerHTML = '<p style="color:var(--muted);font-size:0.85rem;">Generating…</p>';
      try {
        const canvas = await generateShareCard(stats, type);
        state.lastShareCard = canvas;
        if (preview) {
          const img = document.createElement('img');
          img.src = canvas.toDataURL('image/png');
          img.alt = `${type} share card preview`;
          img.className = 'share-preview-img';
          preview.innerHTML = '';
          preview.appendChild(img);
        }
      } catch {
        showToast('Card generation failed. Try again.', 'error');
      }
    });
  });

  // Share modal download
  document.getElementById('download-card-btn')?.addEventListener('click', () => {
    if (state.lastShareCard) downloadCard(state.lastShareCard, 'random-walk-share.png');
  });

  // Share modal native share
  document.getElementById('native-share-btn')?.addEventListener('click', async () => {
    if (!state.lastShareCard) return;
    const result = await shareNative(state.lastShareCard);
    if (result === 'copied') showToast('Link copied to clipboard!', 'success');
    else if (result === 'shared') showToast('Shared successfully!', 'success');
    else showToast('Share not available — download the card instead.', 'info');
  });

  // Invite friends
  document.getElementById('invite-btn')?.addEventListener('click', () => openModal('invite-modal'));
  document.getElementById('reward-invite-btn')?.addEventListener('click', () => openModal('invite-modal'));

  // Copy invite link
  document.getElementById('copy-invite-btn')?.addEventListener('click', async () => {
    const ok = await copyInviteLink();
    showToast(ok ? 'Link copied! Share it with friends 🎉' : 'Could not copy — please copy manually.', ok ? 'success' : 'error');
  });

  // QR code
  const qrImg = document.getElementById('qr-code-img');
  if (qrImg) qrImg.src = qrCodeUrl(SITE_URL);

  // Modal close buttons
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
  });

  // Escape key closes any open modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-open').forEach(m => closeModal(m.id));
    }
  });

  // Mobile hamburger
  initHamburger();

  // Invite slider
  initSlider('invite-slider');

  // Scroll reveal
  initRevealAnimations();

  // Pre-check GPS permission
  checkPermission().then(perm => {
    const indicator = document.getElementById('gps-indicator');
    if (indicator) {
      indicator.dataset.state = perm;
      indicator.title = perm === 'granted'
        ? 'Location access is already granted'
        : perm === 'denied'
        ? 'Location is blocked — allow in browser settings'
        : 'Location will be requested when you generate a walk';
    }
  });
}

// Boot
document.addEventListener('DOMContentLoaded', init);
