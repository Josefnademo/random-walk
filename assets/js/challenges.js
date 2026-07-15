'use strict';
/**
 * Daily Challenge System — deterministic per-user per-day generation.
 * Uses a seeded PRNG (Mulberry32) keyed on date + user ID so challenges
 * are different per user but consistent across sessions on the same day.
 */

import { Storage } from './storage.js';

// ─── Seeded PRNG ─────────────────────────────────────────────────────────────

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (Math.imul(h, 0x01000193)) >>> 0;
  }
  return h;
}

// ─── Rarity Config (exported for UI) ─────────────────────────────────────────

export const RARITY = {
  common:    { color: '#8892a4', bg: 'rgba(136,146,164,0.12)', border: 'rgba(136,146,164,0.25)', label: 'Common'    },
  rare:      { color: '#60b8ff', bg: 'rgba(96,184,255,0.12)',  border: 'rgba(96,184,255,0.3)',   label: 'Rare'       },
  epic:      { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.3)',  label: 'Epic'       },
  legendary: { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)',   label: 'Legendary'  },
};

// ─── Challenge Pool ───────────────────────────────────────────────────────────

const POOL = {
  common: [
    { id:'c1',  icon:'🚶', title:'Short Stroll',      desc:'Complete a 10-minute walk',                    xp: 30, est: 10 },
    { id:'c2',  icon:'🏙️', title:'Around the Block',  desc:'Complete a 20-minute walk',                    xp: 60, est: 20 },
    { id:'c3',  icon:'🌿', title:'Half Hour Hero',     desc:'Complete a 30-minute walk',                    xp: 90, est: 30 },
    { id:'c4',  icon:'📷', title:'Photo Mission',      desc:'Walk with a photo mission enabled',            xp: 40, est: 15 },
    { id:'c5',  icon:'🚦', title:'Street Smart',       desc:'Walk with "Avoid Highways" turned on',        xp: 30, est: 20 },
    { id:'c6',  icon:'🤫', title:'Quiet Mode',         desc:'Walk with "Quieter Vibe" enabled',            xp: 35, est: 20 },
    { id:'c7',  icon:'🎲', title:'Roll the Dice',      desc:'Generate a new random route',                 xp: 20, est: 5  },
    { id:'c8',  icon:'⚡', title:'Power Walk',         desc:'Choose Bold energy and go',                   xp: 55, est: 20 },
    { id:'c9',  icon:'🌅', title:'Early Riser',        desc:'Start your walk before 9 AM',                 xp: 50, est: 20 },
    { id:'c10', icon:'🌆', title:'Evening Stroll',     desc:'Walk between 6 PM and 8 PM',                  xp: 45, est: 20 },
    { id:'c11', icon:'🗺️', title:'Explorer Mode',     desc:'Generate and complete a walk',                xp: 35, est: 20 },
    { id:'c12', icon:'🔄', title:'Loop Master',        desc:'Complete a walk on Easy energy',              xp: 30, est: 20 },
  ],

  rare: [
    { id:'r1',  icon:'🏅', title:'Hour Walker',        desc:'Complete a full 60-minute walk',              xp:150, est: 60 },
    { id:'r2',  icon:'📍', title:'Two Kilometre Club', desc:'Walk at least 2 km in one session',           xp:120, est: 30 },
    { id:'r3',  icon:'🔥', title:'Three-Day Streak',   desc:'Walk 3 days in a row',                        xp:100, est: 20 },
    { id:'r4',  icon:'☀️', title:'Lunch Escape',       desc:'Walk between 12 PM and 2 PM',                 xp: 80, est: 20 },
    { id:'r5',  icon:'🌙', title:'Night Walker',        desc:'Start a walk after 9 PM',                    xp:100, est: 20 },
    { id:'r6',  icon:'💪', title:'Level Up Energy',    desc:'Complete a Medium or Bold walk',              xp: 90, est: 20 },
    { id:'r7',  icon:'🎯', title:'Three Walks',         desc:'Complete 3 walks in one day',                xp:120, est: 60 },
    { id:'r8',  icon:'🧭', title:'Route Curator',      desc:'Generate 3 routes before picking one',       xp: 80, est: 10 },
    { id:'r9',  icon:'🌧️', title:'Rain or Shine',     desc:'Walk regardless of the weather outside',      xp: 95, est: 20 },
    { id:'r10', icon:'🏃', title:'Jog Interval',       desc:'Add a 5-min Bold segment to your walk',      xp:110, est: 25 },
  ],

  epic: [
    { id:'e1',  icon:'🏆', title:'5K Explorer',        desc:'Walk 5 km in one session',                    xp:250, est: 65 },
    { id:'e2',  icon:'🗓️', title:'Week Warrior',       desc:'Walk 7 days in a row',                        xp:300, est: 20 },
    { id:'e3',  icon:'🦾', title:'Beast Mode',         desc:'Complete a 60-min Bold walk',                 xp:280, est: 60 },
    { id:'e4',  icon:'🌄', title:'Sunrise Walker',     desc:'Start your walk at or before 6 AM',           xp:200, est: 20 },
    { id:'e5',  icon:'🎬', title:'Mission Impossible', desc:'Complete 3 photo-mission walks today',        xp:220, est: 60 },
    { id:'e6',  icon:'✨', title:'Ten Walks',          desc:'Reach 10 total completed walks',              xp:200, est: 20 },
    { id:'e7',  icon:'🌊', title:'Distance Runner',    desc:'Walk 3 km without stopping',                  xp:180, est: 40 },
    { id:'e8',  icon:'🗺️', title:'Neighborhood Map',  desc:'Generate routes in 3 different directions',   xp:160, est: 30 },
  ],

  legendary: [
    { id:'l1',  icon:'👑', title:'Urban Legend',       desc:'Walk 10 km in one session',                   xp:500, est:130 },
    { id:'l2',  icon:'💎', title:'Monthly Master',     desc:'Walk 30 days in a row',                       xp:1000, est: 20 },
    { id:'l3',  icon:'🌟', title:'Trailblazer',        desc:'Reach Level 10',                              xp:500, est:  0 },
    { id:'l4',  icon:'🔮', title:'Secret Path',        desc:'A mysterious challenge is calling… just walk',xp:400, est: 30 },
    { id:'l5',  icon:'🌍', title:'World Walker',       desc:'Walk a total of 50 km',                       xp:600, est: 20 },
  ],
};

const WEEKLY_POOL = [
  { id:'w1', icon:'🗺️', title:'Weekly Wanderer',     desc:'Walk 15 km total this week',                  xp:350, est: 0, weekly:true },
  { id:'w2', icon:'📅', title:'Consistency King',     desc:'Walk at least 5 days this week',              xp:400, est: 0, weekly:true },
  { id:'w3', icon:'⚔️', title:'Challenge Crusher',   desc:'Complete 3 daily challenges this week',        xp:500, est: 0, weekly:true },
  { id:'w4', icon:'🔥', title:'Weekend Warrior',      desc:'Walk both Saturday and Sunday',               xp:300, est: 0, weekly:true },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shuffled(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function todayKey() {
  // Local date (not UTC) so midnight resets locally
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get today's 3 daily challenges (deterministic per user per day).
 * @returns {Array<Object>} challenges with rarity field
 */
export function getDailyChallenges() {
  const dateKey = todayKey();
  const userId  = Storage.getUserId();
  const seed    = hashString(dateKey + userId);
  const rng     = mulberry32(seed);

  const dow = new Date().getDay(); // 0=Sun … 6=Sat

  // Always: 1 common + 1 rare
  const common = shuffled(POOL.common, rng)[0];
  const rare   = shuffled(POOL.rare,   mulberry32(seed + 1))[0];

  // Third slot varies by day
  let third;
  if (dow === 1) {
    // Monday → weekly challenge
    third = { ...shuffled(WEEKLY_POOL, rng)[0], rarity: 'epic' };
  } else if (dow === 0 || dow === 6) {
    // Weekend → legendary or epic (50/50)
    third = rng() > 0.5
      ? shuffled(POOL.legendary, rng)[0]
      : shuffled(POOL.epic,      rng)[0];
  } else {
    third = shuffled(POOL.epic, rng)[0];
  }

  return [
    { ...common, rarity: 'common'    },
    { ...rare,   rarity: 'rare'      },
    { ...third,  rarity: third.rarity || (dow === 0 || dow === 6 ? 'legendary' : 'epic') },
  ];
}

/**
 * Get (and reset if stale) challenge completion state from storage.
 */
export function getChallengeState() {
  const dateKey = todayKey();
  const state   = Storage.getDailyChallengesState();
  if (state.date !== dateKey) {
    const fresh = { date: dateKey, completed: {} };
    Storage.saveDailyChallengesState(fresh);
    return fresh;
  }
  return state;
}

export function completeChallenge(id) {
  const state = getChallengeState();
  if (!state.completed[id]) {
    state.completed[id] = Date.now();
    Storage.saveDailyChallengesState(state);
    return true; // newly completed
  }
  return false;
}

export function isChallengeCompleted(id) {
  return !!getChallengeState().completed[id];
}

export function completedCount() {
  return Object.keys(getChallengeState().completed).length;
}
