'use strict';
/**
 * challenges-page.js — Controller for the dedicated challenges.html page.
 * Handles: category filter, full-width 3D flip card deck, nav arrows, swipe gestures.
 */

import { Storage } from './storage.js';
import {
  CHALLENGE_POOL, CATEGORIES, RARITY,
  getDailyChallenges, getChallengeState, completeChallenge,
} from './challenges.js';
import { addXP, getProgressInfo, getTitle, getLevelFromXP } from './gamification.js';
import { showToast } from './ui.js';

// ─── State ────────────────────────────────────────────────────────────────────

let activeCategory = 'all';
let displayedCards = [...CHALLENGE_POOL];
let currentIndex = 0;
const flippedIds = new Set();

// ─── DOM Refs ────────────────────────────────────────────────────────────────

const track = document.getElementById('ch-track');
const viewport = document.getElementById('ch-viewport');
const prevBtn = document.getElementById('ch-prev');
const nextBtn = document.getElementById('ch-next');
const dotsWrap = document.getElementById('ch-progress-dots');
const counter = document.getElementById('ch-counter');

// ─── Render ───────────────────────────────────────────────────────────────────

function buildCards() {
  if (!track) return;

  const chState = getChallengeState();
  const acceptedId = sessionStorage.getItem('acceptedChallenge');

  track.innerHTML = displayedCards.map((ch, idx) => {
    const r = RARITY[ch.rarity] || RARITY.common;
    const catInfo = CATEGORIES[ch.category] || { icon: '❓', title: ch.category };
    const done = !!chState.completed[ch.id];
    const accepted = acceptedId === ch.id;
    const flipped = flippedIds.has(ch.id) || done || accepted;

    if (flipped) flippedIds.add(ch.id);

    return `
    <div class="ch-card-slot" data-slot="${idx}">
      <article class="ch-card${flipped ? ' flipped' : ''}${done ? ' ch-done' : ''}"
               data-id="${ch.id}"
               style="--rarity-color:${r.color};--rarity-bg:${r.bg};--rarity-border:${r.border}"
               aria-label="${ch.title} challenge card">
        <div class="ch-card-inner">

          <!-- FRONT — mystery face-down -->
          <div class="ch-card-face ch-card-front">
            <div class="ch-front-glow">
              <span class="ch-front-emoji">${catInfo.icon}</span>
            </div>
            <span class="ch-front-cat">${catInfo.title}</span>
            <span class="ch-front-reveal">Tap to Reveal</span>
          </div>

          <!-- BACK — quest details -->
          <div class="ch-card-face ch-card-back">
            <div class="ch-back-header">
              <span class="ch-back-rarity">${r.label}</span>
              ${done
        ? '<span class="ch-back-badge completed">✓ Done</span>'
        : accepted
          ? '<span class="ch-back-badge active">Active</span>'
          : ''}
            </div>

            <div class="ch-back-icon">${ch.icon}</div>
            <h2 class="ch-back-title">${ch.title}</h2>
            <p class="ch-back-desc">${ch.desc}</p>
            <p class="ch-back-details">${ch.details || ch.desc}</p>

            <div class="ch-back-footer">
              <span class="ch-back-xp">+${ch.xp} XP</span>
              ${ch.est ? `<span class="ch-back-est">~${ch.est} min</span>` : ''}
            </div>

            ${done
        ? '<p class="ch-back-status completed">Quest Completed ✓</p>'
        : accepted
          ? '<p class="ch-back-status active">Quest is Active — complete your walk!</p>'
          : `<button class="ch-back-accept-btn" data-id="${ch.id}">Accept Quest</button>`}
          </div>

        </div>
      </article>
    </div>`;
  }).join('');

  attachCardListeners();
  buildDots();
  updateNav();
  scrollToCard(currentIndex, false);
}

function buildDots() {
  if (!dotsWrap) return;
  const chState = getChallengeState();

  dotsWrap.innerHTML = displayedCards.map((ch, i) => {
    const done = !!chState.completed[ch.id];
    return `<button class="ch-dot${i === currentIndex ? ' active' : ''}${done ? ' completed' : ''}"
                     data-dot="${i}" aria-label="Go to card ${i + 1}" title="${ch.title}"></button>`;
  }).join('');

  dotsWrap.querySelectorAll('.ch-dot').forEach(dot => {
    dot.addEventListener('click', () => goTo(Number(dot.dataset.dot)));
  });
}

function updateNav() {
  if (prevBtn) prevBtn.disabled = currentIndex <= 0;
  if (nextBtn) nextBtn.disabled = currentIndex >= displayedCards.length - 1;
  if (counter) counter.textContent = `${currentIndex + 1} / ${displayedCards.length}`;
}

// ─── Scroll ───────────────────────────────────────────────────────────────────

function scrollToCard(idx, animate = true) {
  if (!track) return;
  const firstSlot = track.querySelector('.ch-card-slot');
  const cardWidth = firstSlot ? firstSlot.offsetWidth : 520;

  if (!animate) track.style.transition = 'none';
  track.style.transform = `translateX(-${idx * cardWidth}px)`;
  if (!animate) requestAnimationFrame(() => { track.style.transition = ''; });

  // Update dot highlights
  dotsWrap?.querySelectorAll('.ch-dot').forEach((d, i) => {
    d.classList.toggle('active', i === idx);
  });
  updateNav();
}

function goTo(idx) {
  if (idx < 0 || idx >= displayedCards.length) return;
  currentIndex = idx;
  scrollToCard(idx);
}

// ─── Listeners ────────────────────────────────────────────────────────────────

function attachCardListeners() {
  track?.querySelectorAll('.ch-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.classList.contains('ch-back-accept-btn')) return;
      const id = card.dataset.id;
      if (!flippedIds.has(id)) {
        flippedIds.add(id);
        card.classList.add('flipped');
        const title = card.querySelector('.ch-back-title')?.textContent || 'Quest';
        showToast(`🃏 Revealed: "${title}"`, 'xp', 2000);
      }
    });
  });

  track?.querySelectorAll('.ch-back-accept-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const ch = CHALLENGE_POOL.find(c => c.id === id);
      sessionStorage.setItem('acceptedChallenge', id);

      showToast(`✓ "${ch?.title}" accepted! Generate a walk to start.`, 'success', 4000);

      buildCards(); // re-render state

      // After short delay go back to generator
      setTimeout(() => { window.location.href = './'; }, 1800);
    });
  });
}

// ─── Category Filter ──────────────────────────────────────────────────────────

function setCategory(cat) {
  activeCategory = cat;
  displayedCards = cat === 'all'
    ? [...CHALLENGE_POOL]
    : CHALLENGE_POOL.filter(c => c.category === cat);
  currentIndex = 0;
  flippedIds.clear(); // reset reveal state on filter change
  buildCards();
}

// ─── Touch/Swipe ─────────────────────────────────────────────────────────────

let touchStartX = 0;
let touchDelta = 0;

viewport?.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
  touchDelta = 0;
}, { passive: true });

viewport?.addEventListener('touchmove', e => {
  touchDelta = e.touches[0].clientX - touchStartX;
}, { passive: true });

viewport?.addEventListener('touchend', () => {
  if (Math.abs(touchDelta) > 50) {
    goTo(currentIndex + (touchDelta < 0 ? 1 : -1));
  }
});

// ─── Keyboard ─────────────────────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') goTo(currentIndex + 1);
  if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') goTo(currentIndex - 1);
});

// ─── XP / Level UI ───────────────────────────────────────────────────────────

function updateXPUI() {
  const xp = Storage.getStats().xp;
  const info = getProgressInfo(xp);

  const lvlBdg = document.getElementById('level-badge');
  const xpAmt = document.getElementById('xp-amount');
  const xpFill = document.getElementById('xp-bar-fill');

  if (lvlBdg) lvlBdg.textContent = `Lv ${info.level}`;
  if (xpAmt) xpAmt.textContent = xp.toLocaleString() + ' XP';
  if (xpFill) xpFill.style.width = `${info.progress}%`;
}

// ─── Hamburger Nav ────────────────────────────────────────────────────────────

function initNav() {
  const toggle = document.getElementById('nav-toggle');
  const nav = document.getElementById('main-nav');
  if (!toggle || !nav) return;

  let overlay = document.getElementById('nav-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'nav-overlay';
    overlay.className = 'nav-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.zIndex = '999';
    overlay.style.pointerEvents = 'none';
    overlay.style.background = 'rgba(4, 5, 8, 0)';
    overlay.style.backdropFilter = 'blur(0px)';
    overlay.style.webkitBackdropFilter = 'blur(0px)';
    overlay.style.transition = 'background 0.3s ease, backdrop-filter 0.3s ease, -webkit-backdrop-filter 0.3s ease';
    document.body.appendChild(overlay);
  }

  const toggleMenu = (open) => {
    nav.classList.toggle('nav-open', open);
    overlay.classList.toggle('active', open);
    if (open) {
      overlay.style.background = 'rgba(4, 5, 8, 0.65)';
      overlay.style.backdropFilter = 'blur(8px)';
      overlay.style.webkitBackdropFilter = 'blur(8px)';
      overlay.style.pointerEvents = 'auto';
    } else {
      overlay.style.background = 'rgba(4, 5, 8, 0)';
      overlay.style.backdropFilter = 'blur(0px)';
      overlay.style.webkitBackdropFilter = 'blur(0px)';
      overlay.style.pointerEvents = 'none';
    }
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };

  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.contains('nav-open');
    toggleMenu(!isOpen);
  });

  overlay.addEventListener('click', () => {
    toggleMenu(false);
  });

  nav.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      toggleMenu(false);
    });
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function init() {
  Storage.init();
  updateXPUI();
  initNav();

  // Wire category tabs
  document.querySelectorAll('.ch-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ch-cat-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      setCategory(btn.dataset.category || 'all');
    });
  });

  // Wire nav arrows
  prevBtn?.addEventListener('click', () => goTo(currentIndex - 1));
  nextBtn?.addEventListener('click', () => goTo(currentIndex + 1));

  // Handle window resize
  window.addEventListener('resize', () => {
    scrollToCard(currentIndex, false);
  });

  // Initial render
  buildCards();

  // If navigated here from a specific category hash
  const hash = location.hash.replace('#', '');
  if (hash && CATEGORIES[hash]) setCategory(hash);
}

document.addEventListener('DOMContentLoaded', init);
