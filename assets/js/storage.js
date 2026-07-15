'use strict';
/**
 * LocalStorage abstraction — all persistence goes through this module.
 * Handles schema versioning, migration from legacy app.js keys, and
 * graceful failure when storage is unavailable (e.g. private browsing).
 */

const SCHEMA_VERSION = 1;
const P = 'rw2_'; // prefix — avoids collision with legacy rw_ keys

const K = {
  version:    P + 'version',
  walkCount:  P + 'walkCount',
  totalKm:    P + 'totalKm',
  xp:         P + 'xp',
  level:      P + 'level',
  achievements: P + 'achievements',
  streaks:    P + 'streaks',
  history:    P + 'history',
  challenges: P + 'challenges',
  settings:   P + 'settings',
  userId:     P + 'userId',
  missions:   P + 'missions',   // mission-enabled walk count
  generates:  P + 'generates',  // total route generations
  shares:     P + 'shares',     // total share actions
};

function tryParse(raw, fallback) {
  try { return JSON.parse(raw) ?? fallback; }
  catch { return fallback; }
}

function get(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : tryParse(raw, fallback);
  } catch { return fallback; }
}

function set(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}

const DEFAULTS = {
  walkCount:    0,
  totalKm:      0,
  xp:           0,
  level:        1,
  achievements: [],
  streaks:      { current: 0, longest: 0, lastWalkDate: null },
  history:      [],
  settings: {
    units:        'metric',  // 'metric' | 'imperial'
    theme:        'dark',
    reducedMotion: false,
  },
  missions:  0,
  generates: 0,
  shares:    0,
};

function generateUserId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export const Storage = {
  /** Call once on app start. Handles migration from legacy app. */
  init() {
    const v = get(K.version);
    if (!v) {
      // Migrate old walkCount (stored without prefix by legacy app.js)
      const legacyCount = (() => {
        try { const r = localStorage.getItem('walkCount'); return r ? +r : 0; }
        catch { return 0; }
      })();
      if (legacyCount > 0) {
        set(K.walkCount, legacyCount);
        // Award retroactive XP: 50 per walk
        set(K.xp, legacyCount * 50);
      }
      set(K.version, SCHEMA_VERSION);
    }
    return this;
  },

  /** Stable per-device user ID (used to seed daily challenges). */
  getUserId() {
    let id = get(K.userId);
    if (!id) { id = generateUserId(); set(K.userId, id); }
    return id;
  },

  // ── Stats ──────────────────────────────────────────────────────────────────
  getStats() {
    return {
      walkCount: get(K.walkCount, DEFAULTS.walkCount),
      totalKm:   get(K.totalKm,   DEFAULTS.totalKm),
      xp:        get(K.xp,        DEFAULTS.xp),
      level:     get(K.level,     DEFAULTS.level),
      missions:  get(K.missions,  DEFAULTS.missions),
      generates: get(K.generates, DEFAULTS.generates),
      shares:    get(K.shares,    DEFAULTS.shares),
    };
  },

  incrementGenerates() {
    const n = get(K.generates, 0) + 1;
    set(K.generates, n);
    return n;
  },

  incrementShares() {
    const n = get(K.shares, 0) + 1;
    set(K.shares, n);
    return n;
  },

  incrementMissions() {
    const n = get(K.missions, 0) + 1;
    set(K.missions, n);
    return n;
  },

  /** Record a completed walk. Returns updated totals. */
  addWalk({ km = 0, xpEarned = 0, missionEnabled = false } = {}) {
    const count  = get(K.walkCount, 0) + 1;
    const totalKm = +(get(K.totalKm, 0) + km).toFixed(3);
    set(K.walkCount, count);
    set(K.totalKm,   totalKm);
    if (missionEnabled) this.incrementMissions();

    const history = get(K.history, []);
    history.unshift({ date: new Date().toISOString(), km, xp: xpEarned });
    if (history.length > 200) history.pop();
    set(K.history, history);

    return { count, totalKm };
  },

  // ── XP & Level ─────────────────────────────────────────────────────────────
  getXP()    { return get(K.xp,    DEFAULTS.xp); },
  setXP(xp)  { set(K.xp, xp); },
  getLevel() { return get(K.level, DEFAULTS.level); },
  setLevel(l){ set(K.level, l); },

  // ── Achievements ───────────────────────────────────────────────────────────
  getAchievements() { return get(K.achievements, []); },

  /** Returns true if newly unlocked. */
  addAchievement(id) {
    const list = get(K.achievements, []);
    if (list.includes(id)) return false;
    list.push(id);
    set(K.achievements, list);
    return true;
  },

  // ── Streaks ────────────────────────────────────────────────────────────────
  getStreaks() { return { ...DEFAULTS.streaks, ...get(K.streaks, {}) }; },

  updateStreak() {
    const s     = this.getStreaks();
    const today = new Date().toDateString();
    if (s.lastWalkDate === today) return s; // already updated today

    const yesterday = new Date(Date.now() - 86_400_000).toDateString();
    s.current     = s.lastWalkDate === yesterday ? s.current + 1 : 1;
    s.longest     = Math.max(s.current, s.longest || 0);
    s.lastWalkDate = today;
    set(K.streaks, s);
    return s;
  },

  // ── Daily Challenges ───────────────────────────────────────────────────────
  getDailyChallengesState()    { return get(K.challenges, {}); },
  saveDailyChallengesState(st) { set(K.challenges, st); },

  // ── Settings ───────────────────────────────────────────────────────────────
  getSettings()         { return { ...DEFAULTS.settings, ...get(K.settings, {}) }; },
  saveSetting(key, val) {
    const s = this.getSettings();
    s[key] = val;
    set(K.settings, s);
  },

  // ── History ────────────────────────────────────────────────────────────────
  getHistory() { return get(K.history, []); },
};
