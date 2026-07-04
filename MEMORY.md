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
- [x] Main Classroom Page (rebuilt at `/session/[code]/live`)
  - [x] Zero Firebase — reads localStorage only, hardcoded mock fallbacks
  - [x] Entry overlay gate: "Ready to begin?" with Enter Classroom button (satisfies browser autoplay policy)
  - [x] Web Speech API only initialized after user click (no AudioContext on mount)
  - [x] Full-screen split layout: 65% left (AI teacher + slides + subtitles) / 35% right (student tiles + doubt chat)
  - [x] Top bar: logo, topic progress pill, focus %, timer, student count, End Session
  - [x] Teacher observer banner with Pause AI / Resume / Take Over controls
  - [x] Bottom toolbar: mic, camera, hand raise, screen share, chat toggle, AI voice mute, record, leave
  - [x] Simulated student focus scores (emerald/amber/rose borders) refreshing every 7s
  - [x] AI topic lecture sequence with Web Speech, live subtitles, doubt chat auto-pause
  - [x] Keyboard shortcuts (M, V, H, C), end session modal, countdown redirect overlay
  - [x] Waiting room saves session data to localStorage then navigates to /live route
  - [x] Deleted old `/classroom/[code]` route and `classroom-view.tsx` component (50KB)
  - [x] Claude API integration for AI teaching
    - [x] Created `/api/claude/route.ts` — proxies to Anthropic Messages API with comprehensive fallback
    - [x] ANTHROPIC_API_KEY env var (optional — works without it via smart local fallbacks)
    - [x] AI teaching calls Claude API on classroom entry, speaks response via Web Speech API
    - [x] Doubt chat also routes through Claude API for contextual answers
  - [x] Animated Professor AI tile
    - [x] Pulsing purple orb (scale + glow animation) when speaking
    - [x] 5-bar waveform animation below orb when speaking
    - [x] Glowing animated border on tile when speaking, dims when paused/idle
    - [x] Shows current topic name instead of "AWAITING..." when speaking
  - [x] Content area with Unsplash topic images
    - [x] Fetches topic-relevant image from `source.unsplash.com` for each topic
    - [x] Added Unsplash domains to `next.config.ts` remotePatterns
    - [x] Fade-in/out transitions when topic changes
    - [x] Topic name caption overlaid on image with gradient overlay
  - [x] Advanced CV Focus Tracker (MediaPipe Face Mesh)
    - [x] Corrected mirrored gaze directions & added vertical gaze detection
    - [x] Added multi-axis head pose (yaw, pitch, roll) tracking
    - [x] Added EAR blink-vs-drowsy classification & blink rate fatigue monitoring
    - [x] Added MAR yawn detection
    - [x] Implemented EMA smoothing & sustained distraction penalty decay
    - [x] Faster warning escalation (5s warning, 12s lock warning, 20s pause overlay, 45s kick)
    - [x] Replaced emoji warnings with custom lucide-react vector icons (Hand, AlertTriangle, Lock, Eye, EyeOff, Brain)
    - [x] Added debounced face detection (5 frames) to avoid warning flicker on momentary camera glitches
    - [x] Added out-of-frame warning overlay with a strict 5-second countdown auto-kick if face remains undetected
  - [x] Retinal Focus / 3D Iris Gaze Tracking Upgrade
    - [x] Rewrote `useFocusTracker.ts` with true 3D gaze vector computation (eyeball center → iris center using landmarks 468-477)
    - [x] Implemented embedded One-Euro Filter (no deps) for jitter-free gaze smoothing — adaptive cutoff: low jitter when still, low latency when moving
    - [x] Added head-gaze fusion scoring — signed yaw/pitch addition so compensatory eye movements cancel head turns (looking back at screen while head is turned)
    - [x] Added pupil engagement signal from relative iris diameter (iris ring landmarks normalised by eye opening height), with rolling baseline and ±5 point score modifier
    - [x] Replaced flat gaze/head penalties with continuous angular deviation penalties (10° dead zone, -2 pts/deg beyond)
    - [x] Extended FocusMetrics interface with `gazeYaw`, `gazePitch`, `irisEngagement`, `effectiveDeviation`
    - [x] Updated StudentCamera HUD to show gaze angle degrees, iris engagement indicator (ScanEye icon), and effective deviation
    - [x] Updated live/page.tsx initial FocusMetrics state for new fields
    - [x] Modularized Ponytail prompt integrations (`src/lib/ponytail/`) with dynamic `loader`, markdown `parser`, and system prompt `manager` prepending logic inside the Groq API route (`/api/groq`). Integrated support for executing specific Ponytail sub-skills (e.g., `ponytail-review`, `ponytail-audit`, `ponytail-debt`, `ponytail-gain`, `ponytail-help`) via slash commands in user prompts.
    - [x] Implemented Strict Admission Control & Kick/Rejoin Rules:
      - [x] Configured Firestore security rules to allow read/write to new `/sessions/{sessionId}/kicked` subcollection.
      - [x] Updated `joinSession` database services to enforce session status checks (blocking late-joins when `Active` or `Completed`) and name-based kick blacklisting.
      - [x] Created `kickStudent`, `checkIsKicked`, `checkIsIdKicked`, and `isStudentRegistered` helpers.
      - [x] Replaced `removeStudent` with `setStudentOffline` on page unload to prevent disconnection/refresh from wiping active student registration credentials.
      - [x] Integrated waiting room (`page.tsx`) and live classroom (`live/page.tsx`) validation checks on mount, showing premium "Access Denied" screens if kicked or unregistered, and auto-populating session codes from query params on redirect.
      - [x] Built a high-fidelity Attendance & Performance Report on the concluded session page (`summary/page.tsx`) for the teacher, listing student names, registration times, average focus scores, and statuses (Present, Left, Kicked), with a built-in CSV export button to download the roster data.
- [x] Analytics & reports (Dashboard panels)
- [x] Dashboard Sidebar Navigation & Dynamic Content Tabs:
  - [x] Wrapped dashboard page in React `<Suspense>` to support safe Next.js static build execution with `useSearchParams()`.
  - [x] Implemented dynamic panel routing supporting all 5 tabs (Dashboard, My Sessions, Analytics, Students, Settings) via URL query parameters (`?tab=...`).
  - [x] Connected "My Sessions" and "Students" roster directory to live Firestore database aggregations.
  - [x] Implemented premium visual dashboards for Analytics, searchable Sessions table with code copy utility, Student Roster directories, and Settings preferences slider/checklist panel.
  - [x] Fixed teacher redirection race condition on waiting room session mount: checks teacher role synchronously via authenticated user ID compared to session owner ID, bypassing student admission verification checks.
  - [x] Restored Student Tiles Gallery containing StudentCamera inside live/page.tsx (which had been accidentally deleted during the implementation of the swipeable side drawer), restoring video streams, focus tracking updates, and real-time participant listings.
- [x] Custom Loading Screen Animation on Authentication (/auth) Page:
  - [x] Embedded the premium WebGL shader background and logo loading animation on initial portal mount.
  - [x] Added smooth fade-in layouts and opacity transitions after systems check is complete.
- [x] WebRTC & LiveKit Autoplay Compatibility fixes:
  - [x] Added `muted` attribute to remote participant video elements to bypass modern web browser autoplay restriction blocks.
- [x] Dynamic Object Detection & Phone/Tablet usage enforcement:
  - [x] Dynamically integrated TensorFlow.js and pre-trained COCO-SSD object detection inside the local video frame hook (`useFocusTracker.ts`).
  - [x] Configured real-time classification to scan for forbidden devices (`cell phone`, `tablet`, `laptop`) once every 1200ms.
  - [x] Implemented a 3-strikes warnings modal: warning dialog pops up on screen on detection, and automatically kicks/ejects the student if detected 3 times consecutively, redirecting to a custom `device_usage` exit screen.
  - [x] Pushed all updates to main GitHub repository branch and triggered live Vercel deployments.


