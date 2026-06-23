# AI Class Monitoring — MEMORY.md

## Project Overview & Mission
Class AI is an AI-powered classroom monitoring application that uses artificial intelligence to track student engagement, provide real-time insights, and help educators create better learning environments.

## Tech Stack & Versions
- **Framework:** Next.js 16.2.9 (App Router)
- **Language:** TypeScript 5.x
- **Styling:** Tailwind CSS 4.x + shadcn/ui
- **Icons:** lucide-react
- **Animation:** Three.js (CDN-loaded, shader-based)
- **Package Manager:** npm
- **Node Structure:** `src/` directory with `@/*` import alias
- **Repository:** https://github.com/AM-iSMAIL/ai-class-monitoring-v2

## Architecture & Core Decisions
- **Dark Mode First:** The app uses dark theme by default (`.dark` class on `<html>`)
- **shadcn/ui:** Initialized with default config; components live in `src/components/ui/`
- **Shader Animation:** Three.js is loaded dynamically via CDN script tag (not bundled) to keep bundle size small
- **Loading Screen:** Custom loading screen with shader background + logo plays on initial page load before revealing the landing page
- **Branding:** Purple/violet color palette (#7c3aed range), "Class AI" brand name

## Project Structure
```
src/
├── app/
│   ├── globals.css          # Tailwind + shadcn theme + custom animations
│   ├── layout.tsx           # Root layout with fonts and metadata
│   └── page.tsx             # Landing page with loading screen
├── components/
│   └── ui/
│       ├── button.tsx       # shadcn button component
│       ├── loading-screen.tsx # Loading screen with logo + shader bg
│       └── shader-lines.tsx # Three.js WebGL shader animation
└── lib/
    └── utils.ts             # shadcn utility (cn function)
```

## Progress & Roadmap

- [x] Project scaffolding (Next.js + TypeScript + Tailwind)
- [x] shadcn/ui initialization
- [x] ShaderAnimation component integration
- [x] Loading screen with logo
- [x] Landing page design & layout fixes
  - [x] Sticky navbar with larger logo (36px) & brand styling (left border & glow)
  - [x] Hero copy update & floating logo removal
  - [x] Section spacing reduction (40% tighter spacing)
  - [x] Added #1a1a1a horizontal section dividers
  - [x] Minimal single-line footer layout
- [x] Authentication & Session Join page (/auth)
  - [x] Responsive split-screen design
  - [x] Left panel: quotes, branding, stats pills
  - [x] Right panel: centered white card form
  - [x] Teacher Tab: Google oauth (inline Google logo) & Email/Password fields for Sign In / Sign Up
  - [x] Student Tab: Your Name & large monospace Session Code inputs
  - [x] Firebase SDK integration & build-safe fallback configuration
- [x] Dashboard page
- [x] Firebase Real-time sync & security rules
  - [x] Created `firestore.rules` governing session/student actions
  - [x] Implemented `session-service.ts` wrappers for document snapshot subscriptions & telemetry updates
  - [x] Integrated Firestore with dashboard create-session pipeline
  - [x] Updated create-session wizard flow to support 4-step wizard with branched AI/Human modes
- [x] Student monitoring & Waiting Room features
  - [x] Created unified dynamic `/session/[code]` route
  - [x] Designed Student Waiting Room with pulsed sonar rings, mock webcam toggle controls, and classmate rosters
  - [x] Designed Teacher Waiting Room with student tile grid, focus mode / late join toggles, and mode instruction banners
  - [x] Added Google Meet countdown, auto-accept student lobbies, early start, AI script preview modal, and transition chimes
- [x] Main Classroom Dashboard Page
  - [x] Implemented core full-screen ClassroomView component layout
  - [x] Designed AI Teacher Mode with bouncing waveforms, glowing orb avatar, and scrolling live subtitles
  - [x] Designed Human Instructor Mode with visual assistant recommendation cards and whiteboard buttons
  - [x] Created focus-colored student tile grid and auto-answered doubt chat triggers
  - [x] Added keyboard shortcuts (M, V, H, C), bottom toolbars, and end session countdown overlays
  - [x] Implemented client-side Promise.race timeout guards (8s) for session creation and joining to prevent "Launching..." hangs on connection issues.
- [ ] Analytics & reports
- [ ] Real-time AI monitoring integration

