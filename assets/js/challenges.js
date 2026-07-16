'use strict';
/**
 * Challenge System — expanded pool of 21 unique, immersive walking challenges
 * categorized by type. Supports categories, flipping animation states, and details.
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

// ─── Categories Config ───────────────────────────────────────────────────────

export const CATEGORIES = {
  exploration: { title: 'Exploration', icon: '🧭', desc: 'Discover new places, pathfind, and explore nature.' },
  fitness:     { title: 'Speed & Endurance', icon: '⚡', desc: 'Push your pace, burn calories, and go the distance.' },
  streak:      { title: 'Consistency', icon: '🔥', desc: 'Form walking habits, maintain streaks, and show up daily.' },
  creative:    { title: 'Creative Vibe', icon: '🎨', desc: 'Engage with photo missions, notice details, and reflect.' },
};

// ─── Challenge Pool (Exactly 21 challenges) ──────────────────────────────────

export const CHALLENGE_POOL = [
  // --- Category: Exploration ---
  {
    id: 'exp_1',
    category: 'exploration',
    icon: '🏙️',
    title: 'Urban Explorer',
    desc: 'Navigate through backstreets and narrow lanes.',
    details: 'Take a detour from your usual route. Turn into three narrow side streets or pedestrian passageways you rarely walk through, and observe the architecture and signs.',
    xp: 60,
    est: 20,
    rarity: 'common'
  },
  {
    id: 'exp_2',
    category: 'exploration',
    icon: '🌿',
    title: 'Green Escape',
    desc: 'Route your walk through parks or green zones.',
    details: 'Spend at least 15 minutes of your walk inside a park, garden, forest, or any natural green corridor. Breathe deeply and notice the variety of tree leaves.',
    xp: 90,
    est: 30,
    rarity: 'rare'
  },
  {
    id: 'exp_3',
    category: 'exploration',
    icon: '📍',
    title: 'Landmark Hunter',
    desc: 'Discover a local historical site or public monument.',
    details: 'Generate a route near a known local landmark, monument, plaque, or unusual public building. Stop for 30 seconds to read about it or admire its design.',
    xp: 120,
    est: 30,
    rarity: 'epic'
  },
  {
    id: 'exp_4',
    category: 'exploration',
    icon: '🧭',
    title: 'New Horizon',
    desc: 'Start a walk from a completely new origin point.',
    details: 'Start your walk at least 1 km away from your usual home base (e.g., in a different neighborhood, near work, or off a transit stop) to explore fresh territory.',
    xp: 150,
    est: 25,
    rarity: 'epic'
  },
  {
    id: 'exp_5',
    category: 'exploration',
    icon: '🗺️',
    title: 'Pathfinder',
    desc: 'Generate and complete a walk with 5+ waypoints.',
    details: 'Generate a walk duration of 45-60 minutes to ensure a complex, winding route with at least 5 different directional turns. Follow it to completion.',
    xp: 100,
    est: 45,
    rarity: 'rare'
  },
  {
    id: 'exp_6',
    category: 'exploration',
    icon: '🔍',
    title: 'Secret Corner',
    desc: 'Find a street you have never set foot on before.',
    details: 'Walk down a street, alley, or pathway within your local area that you have never walked before. Discover something new in your own backyard.',
    xp: 200,
    est: 30,
    rarity: 'legendary'
  },

  // --- Category: Speed & Endurance ---
  {
    id: 'fit_1',
    category: 'fitness',
    icon: '🏃',
    title: 'Tempo Surge',
    desc: 'Maintain a brisk, high-energy walking pace.',
    details: 'Walk at a fast pace (around 5.0–5.5 km/h) for the entire duration of your route. Keep your chest up, swing your arms, and feel the calorie burn.',
    xp: 80,
    est: 15,
    rarity: 'rare'
  },
  {
    id: 'fit_2',
    category: 'fitness',
    icon: '⏰',
    title: 'Stamina Builder',
    desc: 'Complete a 40-minute continuous walk.',
    details: 'Keep moving continuously for 40 minutes. Avoid long pauses at intersections. Walk in circles or back-and-forth if waiting for pedestrian lights to keep your heart rate up.',
    xp: 100,
    est: 40,
    rarity: 'rare'
  },
  {
    id: 'fit_3',
    category: 'fitness',
    icon: '🔥',
    title: 'Calorie Crusher',
    desc: 'Burn an estimated 250 kcal in one session.',
    details: 'Set your walk duration to 60 minutes or choose Bold energy level to generate a longer, higher-intensity route designed to burn off excess calories.',
    xp: 150,
    est: 60,
    rarity: 'epic'
  },
  {
    id: 'fit_4',
    category: 'fitness',
    icon: '⚡',
    title: 'Peak Power',
    desc: 'Generate and walk on Bold energy difficulty.',
    details: 'Generate a route using the "Bold" energy setting. Walk at a vigorous speed, aiming to complete the looping path faster than the estimated time.',
    xp: 75,
    est: 20,
    rarity: 'common'
  },
  {
    id: 'fit_5',
    category: 'fitness',
    icon: '🏆',
    title: 'Endurance King',
    desc: 'Complete a full 60-minute walk session.',
    details: 'Push your endurance to the limit by completing a full one-hour walking route. Bring water, wear comfortable walking shoes, and enjoy the journey.',
    xp: 250,
    est: 60,
    rarity: 'legendary'
  },

  // --- Category: Consistency ---
  {
    id: 'str_1',
    category: 'streak',
    icon: '🌅',
    title: 'Dawn Patrol',
    desc: 'Complete a walk before 8:00 AM.',
    details: 'Get out of bed early and generate a walk that begins and ends before 8 AM. Experience the quiet, fresh morning air and kickstart your day.',
    xp: 90,
    est: 15,
    rarity: 'rare'
  },
  {
    id: 'str_2',
    category: 'streak',
    icon: '🌇',
    title: 'Sunset Nomad',
    desc: 'Walk during the golden hour (6 PM - 8 PM).',
    details: 'Walk while the sun sets. Enjoy the dramatic shadows, changing colors of the sky, and winding down after a busy day.',
    xp: 70,
    est: 20,
    rarity: 'common'
  },
  {
    id: 'str_3',
    category: 'streak',
    icon: '🔄',
    title: 'Double Trouble',
    desc: 'Complete two separate walks in a single day.',
    details: 'Generate and complete one walk in the morning, and a second separate walk in the afternoon or evening. Consistency is key!',
    xp: 180,
    est: 30,
    rarity: 'epic'
  },
  {
    id: 'str_4',
    category: 'streak',
    icon: '🔥',
    title: 'Habit Builder',
    desc: 'Complete a walk 3 days in a row.',
    details: 'Maintain your walk streak. Complete at least one generated walk of any duration for three consecutive calendar days to lock in this reward.',
    xp: 150,
    est: 20,
    rarity: 'epic'
  },
  {
    id: 'str_5',
    category: 'streak',
    icon: '📅',
    title: 'Weekly Ritual',
    desc: 'Walk a total of 15 km in one week.',
    details: 'Accumulate a total walking distance of 15 km or more across multiple walks in a 7-day period. Track your progress in the stats section.',
    xp: 300,
    est: 90,
    rarity: 'legendary'
  },

  // --- Category: Creative ---
  {
    id: 'cre_1',
    category: 'creative',
    icon: '📷',
    title: 'Photo Journalist',
    desc: 'Complete a walk with a Photo Mission.',
    details: 'Enable the Photo Mission toggle, generate a route, and actively search for the target object. Take a photo when you find it!',
    xp: 60,
    est: 20,
    rarity: 'common'
  },
  {
    id: 'cre_2',
    category: 'creative',
    icon: '🎨',
    title: 'Color Hunt',
    desc: 'Find objects of three specific different colors.',
    details: 'While walking, keep your eyes open for objects that are vibrant red, bright yellow, and deep purple. Spot all three to complete the mental hunt.',
    xp: 80,
    est: 20,
    rarity: 'common'
  },
  {
    id: 'cre_3',
    category: 'creative',
    icon: '👥',
    title: 'Shadow Catcher',
    desc: 'Locate and photograph high-contrast shadows.',
    details: 'Look for interesting geometric shadows cast by railings, buildings, trees, or people. Capture the best shadow alignment with your camera.',
    xp: 110,
    est: 25,
    rarity: 'rare'
  },
  {
    id: 'cre_4',
    category: 'creative',
    icon: '🤫',
    title: 'Mindful Observer',
    desc: 'Walk without listening to music or phones.',
    details: 'Keep your phone in your pocket and headphones off. Focus entirely on the sounds of your environment, the wind, the footsteps, and your own thoughts.',
    xp: 130,
    est: 20,
    rarity: 'epic'
  },
  {
    id: 'cre_5',
    category: 'creative',
    icon: '✉️',
    title: 'Social Walker',
    desc: 'Share your generated route card with a friend.',
    details: 'Generate a walk, click the Share button, choose a format (Story, Square, or Info), download or share it, and send it to invite a friend to walk.',
    xp: 90,
    est: 10,
    rarity: 'rare'
  }
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
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get today's 3 daily challenges (deterministic per user per day).
 * Returns three random challenges from different categories.
 */
export function getDailyChallenges() {
  const dateKey = todayKey();
  const userId  = Storage.getUserId();
  const seed    = hashString(dateKey + userId);
  const rng     = mulberry32(seed);

  // Group by category
  const grouped = {
    exploration: CHALLENGE_POOL.filter(c => c.category === 'exploration'),
    fitness:     CHALLENGE_POOL.filter(c => c.category === 'fitness'),
    streak:      CHALLENGE_POOL.filter(c => c.category === 'streak'),
    creative:    CHALLENGE_POOL.filter(c => c.category === 'creative'),
  };

  // Pick 3 distinct categories deterministically
  const cats = ['exploration', 'fitness', 'streak', 'creative'];
  const shuffledCats = shuffled(cats, rng);

  const ch1 = shuffled(grouped[shuffledCats[0]], mulberry32(seed + 10))[0];
  const ch2 = shuffled(grouped[shuffledCats[1]], mulberry32(seed + 20))[0];
  const ch3 = shuffled(grouped[shuffledCats[2]], mulberry32(seed + 30))[0];

  return [ch1, ch2, ch3];
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
