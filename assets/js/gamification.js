'use strict';
/**
 * Gamification module — XP, levels, achievements, streaks.
 */

import { Storage } from './storage.js';

// ─── Level Thresholds ─────────────────────────────────────────────────────────
// XP required to REACH that level (index = level - 1)
const LEVEL_XP = [
  0,       // Lv 1
  150,     // Lv 2
  350,     // Lv 3
  650,     // Lv 4
  1_100,   // Lv 5
  1_700,   // Lv 6
  2_500,   // Lv 7
  3_500,   // Lv 8
  5_000,   // Lv 9
  7_000,   // Lv 10
  9_500,   // Lv 11
  12_500,  // Lv 12
  16_000,  // Lv 13
  20_000,  // Lv 14
  25_000,  // Lv 15
  31_000,  // Lv 16
  38_000,  // Lv 17
  46_000,  // Lv 18
  55_000,  // Lv 19
  65_000,  // Lv 20 (max)
];

const MAX_LEVEL = LEVEL_XP.length;

const LEVEL_TITLES = [
  'Wanderer',         // 1
  'Pavement Pioneer', // 2
  'Street Seeker',    // 3
  'Neighborhood Scout', // 4
  'City Roamer',      // 5
  'Urban Explorer',   // 6
  'Route Architect',  // 7
  'Trail Blazer',     // 8
  'Path Master',      // 9
  'Legend',           // 10
  'Mythic Walker',    // 11
  'Atlas of Feet',    // 12
  'Infinite Wanderer',// 13
  'The Nomad',        // 14
  'Grand Explorer',   // 15
  'Compass Spirit',   // 16
  'Horizon Chaser',   // 17
  'World Strider',    // 18
  'Eternal Pilgrim',  // 19
  'The Unstoppable',  // 20
];

// ─── Achievement Registry ─────────────────────────────────────────────────────

export const ACHIEVEMENTS = [
  // Walk count
  { id: 'first-steps',  icon: '🌱', title: 'First Steps',       desc: 'Complete your first walk',           xpBonus: 25  },
  { id: 'five-walks',   icon: '🔥', title: 'Getting Warmed Up', desc: 'Complete 5 walks',                   xpBonus: 50  },
  { id: 'ten-walks',    icon: '💪', title: 'Habit Forming',      desc: 'Complete 10 walks',                  xpBonus: 100 },
  { id: 'fifty-walks',  icon: '🏅', title: 'Devoted Walker',     desc: 'Complete 50 walks',                  xpBonus: 250 },

  // Distance
  { id: 'km-10',        icon: '📍', title: '10 Kilometres',      desc: 'Walk a total of 10 km',              xpBonus: 100 },
  { id: 'km-50',        icon: '🗺️', title: '50 Kilometres',      desc: 'Walk a total of 50 km',              xpBonus: 300 },
  { id: 'km-100',       icon: '💯', title: 'Century Club',        desc: 'Walk a total of 100 km',             xpBonus: 500 },
  { id: 'km-250',       icon: '🌍', title: 'Quarter Thousand',    desc: 'Walk a total of 250 km',             xpBonus: 750 },
  { id: 'km-500',       icon: '👑', title: 'Five Hundred',        desc: 'Walk a total of 500 km',             xpBonus: 1000},

  // Time of day
  { id: 'early-bird',   icon: '🌅', title: 'Early Bird',          desc: 'Complete a walk before 8 AM',       xpBonus: 75  },
  { id: 'night-owl',    icon: '🌙', title: 'Night Owl',            desc: 'Complete a walk after 9 PM',        xpBonus: 75  },
  { id: 'weekend-hero', icon: '🎉', title: 'Weekend Hero',         desc: 'Complete a walk on a weekend',      xpBonus: 50  },

  // Streaks
  { id: 'streak-3',     icon: '🔥', title: 'Three in a Row',       desc: 'Walk 3 days in a row',              xpBonus: 75  },
  { id: 'streak-7',     icon: '⚡', title: 'Week Warrior',          desc: 'Walk 7 days in a row',              xpBonus: 200 },
  { id: 'streak-30',    icon: '💎', title: 'Monthly Master',        desc: 'Walk 30 days in a row',             xpBonus: 1000},

  // Special
  { id: 'photographer', icon: '📷', title: 'Photo Hunter',          desc: 'Complete 20 walks with a photo mission', xpBonus: 150 },
  { id: 'social',       icon: '📤', title: 'Share the Journey',     desc: 'Share your results 5 times',        xpBonus: 100 },
  { id: 'challenger',   icon: '⚔️', title: 'Daily Challenger',     desc: 'Complete 10 daily challenges',       xpBonus: 200 },
  { id: 'bold-walk',    icon: '💥', title: 'Bold Move',             desc: 'Complete a Bold energy walk',        xpBonus: 50  },
  { id: 'marathon',     icon: '🏃', title: 'Urban Marathon',        desc: 'Walk 10 km in a single session',    xpBonus: 300 },

  // Level milestones
  { id: 'level-5',      icon: '⭐', title: 'Rising Star',           desc: 'Reach Level 5',                     xpBonus: 100 },
  { id: 'level-10',     icon: '🌟', title: 'Legend',                desc: 'Reach Level 10',                    xpBonus: 500 },
  { id: 'level-20',     icon: '🏆', title: 'The Unstoppable',       desc: 'Reach the maximum level (20)',      xpBonus: 2000},
];

// ─── Level Helpers ─────────────────────────────────────────────────────────────

export function getLevelFromXP(xp) {
  let level = 1;
  for (let i = 0; i < MAX_LEVEL; i++) {
    if (xp >= LEVEL_XP[i]) level = i + 1;
    else break;
  }
  return level;
}

export function getXPForLevel(level) {
  return LEVEL_XP[Math.min(level - 1, MAX_LEVEL - 1)] ?? 0;
}

export function getTitle(level) {
  return LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];
}

/**
 * Full XP progress info for the UI.
 */
export function getProgressInfo(xp) {
  const level    = getLevelFromXP(xp);
  const isMax    = level >= MAX_LEVEL;
  const currXP   = getXPForLevel(level);
  const nextXP   = isMax ? currXP : getXPForLevel(level + 1);
  const progress = isMax ? 100 : Math.min(100, ((xp - currXP) / (nextXP - currXP)) * 100);

  return {
    xp,
    level,
    isMax,
    nextLevel: level + 1,
    needed:    isMax ? 0 : nextXP - xp,
    progress:  Math.max(0, progress),
    title:     getTitle(level),
  };
}

// ─── Core XP Function ─────────────────────────────────────────────────────────

/**
 * Add XP and check for level-ups + achievements.
 *
 * @param {number} amount
 * @param {Object} context - extra data for achievement checks
 * @returns {{ newXP, oldLevel, newLevel, leveledUp, newAchievements }}
 */
export function addXP(amount, context = {}) {
  const oldXP   = Storage.getXP();
  const oldLevel = getLevelFromXP(oldXP);
  const newXP   = oldXP + amount;
  const newLevel = getLevelFromXP(newXP);

  Storage.setXP(newXP);
  if (newLevel !== oldLevel) Storage.setLevel(newLevel);

  const newAchievements = checkAchievements({ ...context, level: newLevel });

  return { newXP, oldLevel, newLevel, leveledUp: newLevel > oldLevel, newAchievements };
}

// ─── Achievement Check ────────────────────────────────────────────────────────

/**
 * Check all achievements and unlock newly qualified ones.
 * @param {Object} ctx - context snapshot (optional overrides)
 */
export function checkAchievements(ctx = {}) {
  const stats   = Storage.getStats();
  const streaks = Storage.getStreaks();
  const unlocked = Storage.getAchievements();
  const results  = [];

  const tryUnlock = (id) => {
    if (!unlocked.includes(id)) {
      if (Storage.addAchievement(id)) {
        const a = ACHIEVEMENTS.find(a => a.id === id);
        if (a) results.push(a);
      }
    }
  };

  const count  = ctx.walkCount ?? stats.walkCount;
  const km     = ctx.totalKm   ?? stats.totalKm;
  const streak = ctx.streak    ?? streaks.current;
  const level  = ctx.level     ?? getLevelFromXP(Storage.getXP());
  const hour   = ctx.hour      ?? new Date().getHours();
  const dow    = new Date().getDay();
  const missions = ctx.missions ?? stats.missions;
  const shares   = ctx.shares   ?? stats.shares;

  // Walk counts
  if (count >= 1)   tryUnlock('first-steps');
  if (count >= 5)   tryUnlock('five-walks');
  if (count >= 10)  tryUnlock('ten-walks');
  if (count >= 50)  tryUnlock('fifty-walks');

  // Distance
  if (km >= 10)  tryUnlock('km-10');
  if (km >= 50)  tryUnlock('km-50');
  if (km >= 100) tryUnlock('km-100');
  if (km >= 250) tryUnlock('km-250');
  if (km >= 500) tryUnlock('km-500');

  // Time of day
  if (hour < 8)   tryUnlock('early-bird');
  if (hour >= 21) tryUnlock('night-owl');
  if (dow === 0 || dow === 6) tryUnlock('weekend-hero');

  // Streaks
  if (streak >= 3)  tryUnlock('streak-3');
  if (streak >= 7)  tryUnlock('streak-7');
  if (streak >= 30) tryUnlock('streak-30');

  // Special
  if (ctx.energy === 'bold')        tryUnlock('bold-walk');
  if ((ctx.sessionKm || 0) >= 10)   tryUnlock('marathon');
  if (missions >= 20)               tryUnlock('photographer');
  if (shares >= 5)                  tryUnlock('social');

  // Level milestones
  if (level >= 5)  tryUnlock('level-5');
  if (level >= 10) tryUnlock('level-10');
  if (level >= 20) tryUnlock('level-20');

  // Award bonus XP for achievements
  if (results.length > 0) {
    const bonusXP = results.reduce((sum, a) => sum + (a.xpBonus || 0), 0);
    if (bonusXP > 0) {
      const currentXP = Storage.getXP();
      Storage.setXP(currentXP + bonusXP);
    }
  }

  return results;
}
