'use strict';
/**
 * UI module — animations, modals, toasts, confetti, counters.
 * No external dependencies.
 */

// ─── Reduced Motion ───────────────────────────────────────────────────────────

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ─── Toast Notifications ─────────────────────────────────────────────────────

let toastContainer = null;

function getToastContainer() {
  if (!toastContainer) {
    toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.setAttribute('aria-live', 'polite');
      toastContainer.setAttribute('aria-atomic', 'false');
      document.body.appendChild(toastContainer);
    }
  }
  return toastContainer;
}

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'info'|'success'|'error'|'xp'} type
 * @param {number} duration - ms
 */
export function showToast(message, type = 'info', duration = 4000) {
  const c     = getToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'status');

  const icons = { success: '✓', error: '✕', xp: '⚡', info: 'ℹ' };
  toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span>
                     <span class="toast-msg">${message}</span>`;

  c.appendChild(toast);
  void toast.offsetHeight; // force reflow
  toast.classList.add('toast-show');

  setTimeout(() => {
    toast.classList.remove('toast-show');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, duration);
}

// ─── Achievement Pop-up ───────────────────────────────────────────────────────

/**
 * Show a premium achievement unlock notification.
 */
export function showAchievement(achievement) {
  const el = document.createElement('div');
  el.className = 'achievement-popup';
  el.innerHTML = `
    <div class="ach-icon">${achievement.icon}</div>
    <div class="ach-text">
      <p class="ach-label">Achievement Unlocked</p>
      <strong class="ach-title">${achievement.title}</strong>
      <p class="ach-desc">${achievement.desc}</p>
    </div>
    ${achievement.xpBonus ? `<div class="ach-xp">+${achievement.xpBonus} XP</div>` : ''}
  `;
  document.body.appendChild(el);
  void el.offsetHeight;
  el.classList.add('ach-show');

  setTimeout(() => {
    el.classList.remove('ach-show');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
  }, 4500);
}

// ─── Level Up Overlay ─────────────────────────────────────────────────────────

/**
 * Full-screen level up celebration.
 */
export function showLevelUp(newLevel, title) {
  const overlay = document.getElementById('levelup-overlay');
  if (!overlay) return;

  const lvlEl   = overlay.querySelector('#levelup-number');
  const titleEl = overlay.querySelector('#levelup-title');
  if (lvlEl)   lvlEl.textContent  = newLevel;
  if (titleEl) titleEl.textContent = title;

  overlay.hidden = false;
  void overlay.offsetHeight;
  overlay.classList.add('levelup-show');

  if (!prefersReducedMotion()) triggerConfetti();

  // Auto-dismiss after 3.5s
  setTimeout(() => {
    overlay.classList.remove('levelup-show');
    overlay.addEventListener('transitionend', () => {
      overlay.hidden = true;
    }, { once: true });
  }, 3500);
}

// ─── Confetti ─────────────────────────────────────────────────────────────────

/**
 * CSS-only particle confetti burst (no canvas, no library).
 */
export function triggerConfetti(container = document.body, count = 80) {
  if (prefersReducedMotion()) return;

  const colors = ['#c7ff55','#60b8ff','#a78bfa','#fbbf24','#f87171','#34d399'];
  const shapes  = ['circle','rect','triangle'];

  for (let i = 0; i < count; i++) {
    const p      = document.createElement('div');
    const color  = colors[i % colors.length];
    const shape  = shapes[Math.floor(Math.random() * shapes.length)];
    const size   = 6 + Math.random() * 10;
    const startX = 10 + Math.random() * 80; // % from left
    const delay  = Math.random() * 0.6;
    const dur    = 1.8 + Math.random() * 1.2;

    p.className = 'confetti-piece';
    p.style.cssText = `
      left:${startX}%;
      width:${size}px;
      height:${size}px;
      background:${shape !== 'triangle' ? color : 'transparent'};
      border-radius:${shape === 'circle' ? '50%' : shape === 'rect' ? '2px' : '0'};
      border:${shape === 'triangle' ? `${size/2}px solid transparent; border-bottom:${size}px solid ${color}` : 'none'};
      animation-delay:${delay}s;
      animation-duration:${dur}s;
    `;
    container.appendChild(p);
    setTimeout(() => p.remove(), (delay + dur + 0.5) * 1000);
  }
}

// ─── Animated Number Counter ──────────────────────────────────────────────────

/**
 * Animate a number counting up/down.
 */
export function animateCounter(el, from, to, duration = 1000, format = n => n) {
  if (!el) return;
  if (prefersReducedMotion()) { el.textContent = format(to); return; }

  const start = performance.now();
  const diff  = to - from;

  function step(now) {
    const t = Math.min((now - start) / duration, 1);
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // ease-in-out cubic
    el.textContent = format(Math.round(from + diff * eased));
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ─── XP Bar Animation ─────────────────────────────────────────────────────────

/**
 * Smoothly animate XP bar fill to a new percentage.
 */
export function animateXPBar(barEl, targetPercent, duration = 900) {
  if (!barEl) return;
  if (prefersReducedMotion()) { barEl.style.width = `${targetPercent}%`; return; }

  const start   = parseFloat(barEl.style.width) || 0;
  const diff    = targetPercent - start;
  const began   = performance.now();

  function step(now) {
    const t     = Math.min((now - began) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    barEl.style.width = `${(start + diff * eased).toFixed(2)}%`;
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ─── Floating XP Label ────────────────────────────────────────────────────────

/**
 * Show a floating "+XX XP" label that floats up and fades.
 */
export function floatXP(amount, anchorEl) {
  if (prefersReducedMotion() || !anchorEl) return;

  const rect = anchorEl.getBoundingClientRect();
  const el   = document.createElement('div');
  el.className   = 'float-xp';
  el.textContent = `+${amount} XP`;
  el.style.cssText = `left:${rect.left + rect.width / 2}px;top:${rect.top + window.scrollY}px;`;
  document.body.appendChild(el);

  void el.offsetHeight;
  el.classList.add('float-xp-animate');
  setTimeout(() => el.remove(), 1500);
}

// ─── Modal ───────────────────────────────────────────────────────────────────

let lastFocus = null;

export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  lastFocus = document.activeElement;
  modal.hidden   = false;
  modal.removeAttribute('aria-hidden');
  void modal.offsetHeight;
  modal.classList.add('modal-open');
  document.body.style.overflow = 'hidden';

  // Focus first focusable inside modal
  const focusable = modal.querySelector('button, [href], input, [tabindex]:not([tabindex="-1"])');
  focusable?.focus();

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal(modalId);
  }, { once: true });
}

export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove('modal-open');
  modal.setAttribute('aria-hidden', 'true');
  modal.addEventListener('transitionend', () => {
    modal.hidden = true;
    document.body.style.overflow = '';
    lastFocus?.focus();
  }, { once: true });
}

// ─── Hamburger Menu ───────────────────────────────────────────────────────────

export function initHamburger() {
  const btn = document.getElementById('nav-toggle');
  const nav = document.getElementById('main-nav');
  if (!btn || !nav) return;

  btn.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('nav-open');
    btn.setAttribute('aria-expanded', isOpen);
    btn.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
  });

  // Close on nav link click
  nav.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      nav.classList.remove('nav-open');
      btn.setAttribute('aria-expanded', 'false');
    });
  });
}

// ─── Section Reveal ───────────────────────────────────────────────────────────

/**
 * Intersection Observer reveal for sections.
 */
export function initRevealAnimations() {
  if (prefersReducedMotion()) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('revealed');
          observer.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

// ─── GPS Loading State ────────────────────────────────────────────────────────

export function setGPSState(state, message = '', percent = 0) {
  const loadingEl = document.getElementById('gps-loading');
  const errorEl   = document.getElementById('gps-error');
  const btnEl     = document.getElementById('generate-btn');

  if (state === 'loading') {
    if (loadingEl) {
      loadingEl.hidden = false;
      const msg  = loadingEl.querySelector('.gps-message');
      const bar  = loadingEl.querySelector('.gps-progress-fill');
      if (msg) msg.textContent = message;
      if (bar) bar.style.width = `${percent}%`;
    }
    if (errorEl)  errorEl.hidden = true;
    if (btnEl) {
      btnEl.disabled = true;
      btnEl.setAttribute('aria-busy', 'true');
    }
  } else if (state === 'error') {
    if (loadingEl) loadingEl.hidden = true;
    if (errorEl) {
      errorEl.hidden = false;
      const msg = errorEl.querySelector('.error-message');
      if (msg) msg.textContent = message;
    }
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.removeAttribute('aria-busy');
    }
  } else {
    // 'idle'
    if (loadingEl) loadingEl.hidden = true;
    if (errorEl)   errorEl.hidden   = true;
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.removeAttribute('aria-busy');
    }
  }
}

// ─── Tab Slider (Invite) ──────────────────────────────────────────────────────

export function initSlider(sliderId) {
  const slider  = document.getElementById(sliderId);
  if (!slider) return;

  const track  = slider.querySelector('.slider-track');
  const slides = slider.querySelectorAll('.slide');
  const dots   = slider.querySelectorAll('.slider-dot');
  const prev   = slider.querySelector('.slider-prev');
  const next   = slider.querySelector('.slider-next');

  let current = 0;

  const goTo = (n) => {
    current = Math.max(0, Math.min(n, slides.length - 1));
    track.style.transform = `translateX(-${current * 100}%)`;
    dots.forEach((d, i) => d.classList.toggle('active', i === current));
    if (prev) prev.disabled = current === 0;
    if (next) next.disabled = current === slides.length - 1;
  };

  prev?.addEventListener('click', () => goTo(current - 1));
  next?.addEventListener('click', () => goTo(current + 1));
  dots.forEach((d, i) => d.addEventListener('click', () => goTo(i)));

  // Touch swipe
  let touchX = 0;
  track.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend',   e => {
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) goTo(current + (dx < 0 ? 1 : -1));
  });

  goTo(0);
}
