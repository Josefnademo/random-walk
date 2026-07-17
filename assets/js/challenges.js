'use strict';
/**
 * Challenge System — 30 immersive walking challenges across 5 categories.
 * Supports daily rotation, category filtering, flip states, and completion tracking.
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

// ─── Rarity Config ────────────────────────────────────────────────────────────

export const RARITY = {
  common:    { color: '#8892a4', bg: 'rgba(136,146,164,0.12)', border: 'rgba(136,146,164,0.25)', label: 'Common'    },
  rare:      { color: '#60b8ff', bg: 'rgba(96,184,255,0.12)',  border: 'rgba(96,184,255,0.3)',   label: 'Rare'       },
  epic:      { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.3)',  label: 'Epic'       },
  legendary: { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)',   label: 'Legendary'  },
};

// ─── Categories Config ────────────────────────────────────────────────────────

export const CATEGORIES = {
  exploration:  { title: 'Exploration',      icon: '🧭', desc: 'Discover new places, pathfind, and explore the unknown.' },
  fitness:      { title: 'Speed & Distance', icon: '⚡', desc: 'Push your pace, burn calories, and go the distance.'      },
  streak:       { title: 'Consistency',      icon: '🔥', desc: 'Form habits, maintain streaks, and show up every day.'    },
  creative:     { title: 'Creative Vibe',    icon: '🎨', desc: 'Photography, observation, art, and social missions.'       },
  mindfulness:  { title: 'Mindfulness',      icon: '🧘', desc: 'Slow down, breathe deeply, and reconnect with your senses.' },
};

// ─── Challenge Pool (30 challenges) ──────────────────────────────────────────

export const CHALLENGE_POOL = [

  // ════════════ EXPLORATION (7) ════════════

  {
    id: 'exp_1', category: 'exploration', icon: '🏙️', rarity: 'common',
    title: 'Urban Explorer',
    desc: 'Navigate through backstreets and narrow lanes.',
    details: 'Take a detour from your usual route. Turn into three narrow side streets or pedestrian passageways you rarely walk through. Notice the textures, signage, and atmosphere of these forgotten corridors.',
    xp: 60, est: 20,
  },
  {
    id: 'exp_2', category: 'exploration', icon: '🌿', rarity: 'rare',
    title: 'Green Escape',
    desc: 'Route your walk through parks or nature zones.',
    details: 'Spend at least 15 minutes of your walk inside a park, garden, forest, or any green corridor. Take three slow, deep breaths when you arrive. Notice the variety of plant species, light filtering through trees, and birdsong.',
    xp: 90, est: 30,
  },
  {
    id: 'exp_3', category: 'exploration', icon: '📍', rarity: 'epic',
    title: 'Landmark Hunter',
    desc: 'Discover a local historical site or public monument.',
    details: 'Plot a route near a landmark, statue, plaque, or architecturally notable building. Stop for at least 60 seconds to read or admire it. Try to learn one fact about the place you didn\'t know before.',
    xp: 120, est: 30,
  },
  {
    id: 'exp_4', category: 'exploration', icon: '🧭', rarity: 'epic',
    title: 'New Horizon',
    desc: 'Start a walk from a completely unfamiliar location.',
    details: 'Begin your walk at least 1 km away from your usual starting point — a different neighborhood, near work, or at a transit stop you\'ve never used. Let the unfamiliarity be the adventure.',
    xp: 150, est: 25,
  },
  {
    id: 'exp_5', category: 'exploration', icon: '🗺️', rarity: 'rare',
    title: 'Pathfinder',
    desc: 'Complete a complex walk with 5+ directional changes.',
    details: 'Generate a 45–60 minute walk with maximum waypoints enabled. Follow every twist and turn without skipping. The complexity of the route is the challenge — trust the randomness.',
    xp: 100, est: 45,
  },
  {
    id: 'exp_6', category: 'exploration', icon: '🔍', rarity: 'legendary',
    title: 'Secret Corner',
    desc: 'Walk down a street you have never set foot on.',
    details: 'Find and walk a street, alley, or path that is genuinely new to you, even in your own neighbourhood. You live there — but have you explored all of it? The first step into unknown ground is always the best.',
    xp: 200, est: 30,
  },
  {
    id: 'exp_7', category: 'exploration', icon: '🌉', rarity: 'rare',
    title: 'Bridge Crosser',
    desc: 'Cross at least one bridge or overpass on your walk.',
    details: 'Plan or adjust a route so that it includes at least one bridge, elevated walkway, or pedestrian overpass. Pause at the midpoint and look out in both directions before continuing.',
    xp: 85, est: 25,
  },

  // ════════════ FITNESS / SPEED (7) ════════════

  {
    id: 'fit_1', category: 'fitness', icon: '🏃', rarity: 'rare',
    title: 'Tempo Surge',
    desc: 'Maintain a brisk, high-energy walking pace.',
    details: 'Walk at approximately 5.0–5.5 km/h for the entire route. Keep your posture upright, arms swinging, and cadence above 110 steps per minute. Feel your breathing deepen and your body warm up.',
    xp: 80, est: 15,
  },
  {
    id: 'fit_2', category: 'fitness', icon: '⏰', rarity: 'rare',
    title: 'Stamina Builder',
    desc: 'Complete a 40-minute continuous walk without stopping.',
    details: 'Keep moving for a full 40 minutes — no sitting, no prolonged standing. If you need to wait at a crosswalk, march in place. Consistency of motion is the whole point.',
    xp: 100, est: 40,
  },
  {
    id: 'fit_3', category: 'fitness', icon: '🔥', rarity: 'epic',
    title: 'Calorie Crusher',
    desc: 'Burn an estimated 250 kcal in a single session.',
    details: 'Choose Bold energy and a 60-minute duration. Walk at a pace that makes conversation slightly difficult. The app will estimate your calorie burn in the stats panel — aim for 250 kcal or more.',
    xp: 150, est: 60,
  },
  {
    id: 'fit_4', category: 'fitness', icon: '⚡', rarity: 'common',
    title: 'Peak Power',
    desc: 'Generate and complete a walk on Bold difficulty.',
    details: 'Set the energy level to "Bold ⚡" and generate a walk. Walk at maximum comfortable pace for the full duration. The goal is sustained intensity — finish the entire route without slowing down.',
    xp: 75, est: 20,
  },
  {
    id: 'fit_5', category: 'fitness', icon: '🏆', rarity: 'legendary',
    title: 'Endurance King',
    desc: 'Complete a full 60-minute unbroken walking session.',
    details: 'One hour. One walk. No shortcuts. Bring water, wear your best shoes, and go the full distance. By the time you finish, your body will know it earned every XP point.',
    xp: 250, est: 60,
  },
  {
    id: 'fit_6', category: 'fitness', icon: '📈', rarity: 'rare',
    title: 'Hill Seeker',
    desc: 'Choose a route that includes an elevation change.',
    details: 'Find a street, park, or area with a noticeable incline. Walk up and down the slope at least twice during your route. Elevation adds significant calorie burn and strengthens the posterior chain.',
    xp: 110, est: 30,
  },
  {
    id: 'fit_7', category: 'fitness', icon: '🎯', rarity: 'epic',
    title: 'Split Intervals',
    desc: 'Alternate between fast and slow walking every 3 minutes.',
    details: 'For the duration of your walk, set a 3-minute timer and alternate between a fast tempo walk and a gentle recovery pace. This interval approach burns more calories and improves cardiovascular fitness.',
    xp: 130, est: 30,
  },

  // ════════════ CONSISTENCY / STREAKS (7) ════════════

  {
    id: 'str_1', category: 'streak', icon: '🌅', rarity: 'rare',
    title: 'Dawn Patrol',
    desc: 'Complete a walk before 8:00 AM.',
    details: 'Set your alarm, get up, and walk before the rest of the world is fully awake. Early morning light is soft, streets are quiet, and your mind will be clearer for the rest of the day.',
    xp: 90, est: 15,
  },
  {
    id: 'str_2', category: 'streak', icon: '🌇', rarity: 'common',
    title: 'Sunset Nomad',
    desc: 'Walk during golden hour — 6 PM to 8 PM.',
    details: 'Head out while the sun is descending. Golden hour light transforms ordinary streets into something cinematic. Look for long shadows and warm colour tones as you walk.',
    xp: 70, est: 20,
  },
  {
    id: 'str_3', category: 'streak', icon: '🔄', rarity: 'epic',
    title: 'Double Trouble',
    desc: 'Complete two separate walks in one calendar day.',
    details: 'One in the morning (before noon) and one in the afternoon or evening. They don\'t need to be long — even a 15-minute loop each counts. Two walks, double the XP energy.',
    xp: 180, est: 30,
  },
  {
    id: 'str_4', category: 'streak', icon: '🔥', rarity: 'epic',
    title: 'Habit Builder',
    desc: 'Walk on 3 consecutive calendar days.',
    details: 'Complete at least one generated walk each day for three days in a row. The first day is motivation. The second is discipline. The third is the beginning of a habit.',
    xp: 150, est: 20,
  },
  {
    id: 'str_5', category: 'streak', icon: '📅', rarity: 'legendary',
    title: 'Weekly Ritual',
    desc: 'Accumulate 15 km of walking in 7 days.',
    details: 'Track your cumulative distance across multiple walks over a week. This works out to roughly 2–3 km per day. Consistent, moderate walking is one of the most impactful habits you can build.',
    xp: 300, est: 90,
  },
  {
    id: 'str_6', category: 'streak', icon: '🌙', rarity: 'rare',
    title: 'Night Owl',
    desc: 'Complete a walk after 9:00 PM.',
    details: 'Head out after the sun has set for a night walk. Stick to well-lit, familiar streets. Notice how the city sounds and feels completely different after dark — quieter, cooler, and strangely peaceful.',
    xp: 100, est: 20,
  },
  {
    id: 'str_7', category: 'streak', icon: '☀️', rarity: 'legendary',
    title: '7-Day Champion',
    desc: 'Walk every single day for a full week.',
    details: 'Seven days. Seven walks. No exceptions. Even a 10-minute loop around the block on a hard day counts. Completing this challenge proves that walking has become part of who you are, not just what you do.',
    xp: 500, est: 20,
  },

  // ════════════ CREATIVE (5) ════════════

  {
    id: 'cre_1', category: 'creative', icon: '📷', rarity: 'common',
    title: 'Photo Journalist',
    desc: 'Complete a walk with the Photo Mission enabled.',
    details: 'Enable the Photo Mission toggle before generating your route. While walking, actively hunt for your assigned target object. Photograph it when you find it — and study the scene before you shoot.',
    xp: 60, est: 20,
  },
  {
    id: 'cre_2', category: 'creative', icon: '🎨', rarity: 'common',
    title: 'Color Hunt',
    desc: 'Find and mentally note three specific vivid colors.',
    details: 'Pick three colors before you leave: for example, fire-engine red, lemon yellow, and cobalt blue. During your walk, you must spot a real-world object that matches each one. The rule: no cars count.',
    xp: 80, est: 20,
  },
  {
    id: 'cre_3', category: 'creative', icon: '👥', rarity: 'rare',
    title: 'Shadow Catcher',
    desc: 'Photograph at least 3 interesting geometric shadows.',
    details: 'Look for shadows cast by railings, trees, lampposts, bicycles, or building edges. The best shadows happen when the light is low — mid-morning or late afternoon. Capture 3 that you find aesthetically compelling.',
    xp: 110, est: 25,
  },
  {
    id: 'cre_4', category: 'creative', icon: '✉️', rarity: 'rare',
    title: 'Social Walker',
    desc: 'Share your generated route card with a friend.',
    details: 'After generating a walk, click Share, choose a card format (Story, Square, or Info), then send it to at least one friend or post it publicly. Walking is better when others see you doing it.',
    xp: 90, est: 10,
  },
  {
    id: 'cre_5', category: 'creative', icon: '🔤', rarity: 'epic',
    title: 'Letter Walk',
    desc: 'Plan a route that traces a letter or shape on the map.',
    details: 'Open Google Maps or OSM, look at your streets, and try to walk a route that roughly forms a letter, number, or simple shape when viewed from above. Screenshot your path in Google Maps for proof.',
    xp: 180, est: 40,
  },

  // ════════════ MINDFULNESS (4) ════════════

  {
    id: 'mnd_1', category: 'mindfulness', icon: '🧘', rarity: 'common',
    title: 'Silent Walk',
    desc: 'Walk without music, podcasts, or phone use.',
    details: 'Leave headphones behind. Put your phone on silent in your pocket. For the full duration of the walk, engage only with your physical surroundings — sounds, smells, textures underfoot, the temperature of the air on your skin.',
    xp: 100, est: 20,
  },
  {
    id: 'mnd_2', category: 'mindfulness', icon: '🌬️', rarity: 'rare',
    title: 'Breath Counter',
    desc: 'Synchronize your steps with your breathing rhythm.',
    details: 'Inhale for 4 steps, hold for 2, exhale for 4. Maintain this rhythm for at least 10 minutes of your walk. Breathing-movement synchronization reduces cortisol levels and improves focus significantly.',
    xp: 90, est: 20,
  },
  {
    id: 'mnd_3', category: 'mindfulness', icon: '👣', rarity: 'epic',
    title: 'Slow Steps',
    desc: 'Walk at half your normal pace for the entire route.',
    details: 'Deliberately slow down to roughly 2.5 km/h — a genuine stroll. Let people pass you. Notice how much more you observe when you are not in a hurry. Mindful slowness is its own kind of speed.',
    xp: 120, est: 30,
  },
  {
    id: 'mnd_4', category: 'mindfulness', icon: '🌳', rarity: 'legendary',
    title: 'Forest Bath',
    desc: 'Spend 30 continuous minutes in a natural green space.',
    details: 'Shinrin-yoku — forest bathing — is a practice of immersing yourself in nature without agenda. Walk through a park, forest, or botanical garden. No destination. No pace target. Just be there and let the environment reset your nervous system.',
    xp: 220, est: 35,
  },

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
 * One from each of 3 randomly chosen categories.
 */
export function getDailyChallenges() {
  const dateKey = todayKey();
  const userId  = Storage.getUserId();
  const seed    = hashString(dateKey + userId);
  const rng     = mulberry32(seed);

  const cats = Object.keys(CATEGORIES);
  const shuffledCats = shuffled(cats, rng);

  const grouped = {};
  cats.forEach(cat => { grouped[cat] = CHALLENGE_POOL.filter(c => c.category === cat); });

  const ch1 = shuffled(grouped[shuffledCats[0]], mulberry32(seed + 10))[0];
  const ch2 = shuffled(grouped[shuffledCats[1]], mulberry32(seed + 20))[0];
  const ch3 = shuffled(grouped[shuffledCats[2]], mulberry32(seed + 30))[0];

  return [ch1, ch2, ch3].filter(Boolean);
}

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
    return true;
  }
  return false;
}

export function isChallengeCompleted(id) {
  return !!getChallengeState().completed[id];
}

export function completedCount() {
  return Object.keys(getChallengeState().completed).length;
}
