# Random Walk Generator v2.0

A free browser-based tool that generates spontaneous walking routes from your location. No backend. No account. No data collection.

🌐 **Live site:** https://josefnademo.github.io/random-walk/

---

## Features

- 🗺️ **Real GPS routing** — Leaflet map with CartoDB dark tiles (no API key)
- 📷 **Photo missions** — randomised creative challenges per walk
- ⚡ **XP & Level system** — 20 levels, named titles
- 🏆 **22 Achievements** — automatic unlock with XP bonuses
- 🎯 **Daily Challenges** — 4 rarity tiers, reset at midnight
- 📤 **Share cards** — Canvas-generated Story/Square/Landscape formats
- 🔥 **Streaks** — daily walk streak tracking
- 📱 **PWA** — installable, works offline via service worker

---

## Architecture

```
random-walk-mvp/
├── index.html              Main page
├── 404.html                Not found page
├── about.html
├── privacy.html
├── manifest.webmanifest    PWA manifest
├── sw.js                   Service worker
├── sitemap.xml
├── robots.txt
├── assets/
│   ├── styles.css          Design system (all pages)
│   ├── icon.svg            App icon / favicon
│   ├── social-card.svg     Open Graph preview
│   └── js/
│       ├── config.js       ← CHANGE DOMAIN HERE
│       ├── storage.js      localStorage abstraction
│       ├── geo.js          Geolocation with retry
│       ├── route.js        Haversine route math
│       ├── map.js          Leaflet + SVG fallback
│       ├── challenges.js   Daily challenge engine
│       ├── gamification.js XP / levels / achievements
│       ├── share.js        Canvas share cards
│       ├── ui.js           Toasts, modals, animations
│       └── main.js         App entry point
└── guides/
    ├── walking-challenges.html
    ├── daily-walk-ideas.html
    └── how-random-walks-work.html
```

---

## Privacy

All logic runs client-side. GPS coordinates never leave the device. Data stored in `localStorage` only (XP, level, achievements, streaks). No analytics, no cookies, no server.

See [privacy.html](privacy.html) for the full disclosure.
