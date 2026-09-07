# Workout Tracker — Build Plan

*Personal, mobile-first workout tracker. Draft plan → adversarial review → adjusted plan.*

---

## 1. What we're building (in plain terms)

A web app you open on your phone (and add to your home screen so it feels like a real app) that lets you:

- Pick the muscle groups you're training today → get a **recommended workout**, or **type a description** and have it auto-match the exercise.
- See a **demonstration** (image/animation/video) of each exercise.
- **Log sets fast** — weight, reps, done. Minimal taps.
- Have **future sessions pre-fill** your last numbers and suggest small increases (progressive overload).
- Track everything on a **calendar**, with **weekly/monthly reports** (volume, PRs, consistency).
- **Never lose your data.**

---

## 2. The core loop that must be flawless

Everything else is secondary to this daily loop:

> Open app → "Train today" → pick/confirm exercises → log each set (last numbers already filled in) → save → tomorrow it's all there, and next time those numbers come back with a suggested bump.

If this loop is fast and reliable, the app succeeds even if nothing else exists yet. We build this first.

---

## 3. The decisions you need to make (simple + impact)

### Decision A — Where your data lives (MOST IMPORTANT: "never lose my lifts")

| Option | What it means | Upside | Risk |
|---|---|---|---|
| **On-phone only** | Data saved inside your phone's browser | Free, instant, works offline, private | **Real risk of loss** — phones (especially iPhones) auto-clear browser storage after a period of non-use, and a lost/reset phone = lost data unless you manually exported a backup |
| **Cloud-stored (recommended)** | Data saved on a server tied to your account | Survives phone loss, browser clearing, and works across devices; automatic | Needs to be hosted somewhere that provides storage |

**Recommendation:** Cloud-stored. Your #1 stated fear is losing lifts, and on-phone-only storage genuinely can lose them.

### Decision B — How it's hosted (this is now tied to A)

| Option | What it means | Best for |
|---|---|---|
| **Claude Artifact + built-in database (recommended)** | The app is published on claude.ai and loads via a URL on your phone. Storage is built in and tied to your account — no login to build, no server to run, nothing to maintain | Lowest hassle, solves cloud storage automatically, you're not a developer maintaining infrastructure |
| **Standalone app on a free host (Vercel/Netlify) + database (Supabase)** | A fully independent app at your own web address | Maximum control and future flexibility, but you'd manage accounts, deploys, and a database |

**Recommendation:** Claude Artifact + built-in database. It solves storage, hosting, and "no maintenance" in one move. Trade-off: the app lives on the claude.ai platform rather than a fully independent website. We can migrate to a standalone app later if you ever outgrow it.

### Decision C — Exercise demonstrations (images vs video)

| Option | What it means | Upside | Downside |
|---|---|---|---|
| **Free image library (~800+ exercises)** | Start/finish position photos + written instructions | Free, comprehensive, works offline, no licensing issues | Photos, not full motion |
| **Video links** | A "Watch demo" button opens a video | Real movement | Needs internet; depends on outside videos staying available |
| **Both (recommended)** | Images always available + optional video button | Best coverage | — |

**Recommendation:** Both. Honest note: true smooth **animations** for every exercise are a paid/licensed product; free options are demonstration photos plus optional video links. We start there and can add animations later if you want to pay for a library.

### Decision D — "Type a description → auto-match exercise"

| Option | What it means | Upside | Downside |
|---|---|---|---|
| **Smart search (recommended to start)** | Fuzzy matching: "incline chest press" instantly finds it | Free, offline, fast | Needs roughly the real name |
| **AI matching** | Understands vague descriptions ("the angled push-up machine") | Very forgiving | Costs a little per use, needs internet |

**Recommendation:** Start with smart search (handles the large majority of cases). The Artifact platform can add AI matching later with no extra API-key setup, so this is a cheap upgrade when we want it.

---

## 4. Feature roadmap (phased so it's usable early, never a stalled mega-project)

**Phase 1 — The daily driver (usable end to end)**
- Exercise library: searchable, filter by muscle group, demonstration images
- Start a session: pick muscle groups → recommended exercises OR add by search/type
- Fast set logging: weight, reps, add set, mark done
- Save session → persists in cloud storage
- History list + simple calendar view

**Phase 2 — Progress & intelligence**
- Progressive-overload autofill: last session's numbers pre-filled + a suggested small increase
- Personal records (PRs) tracked automatically
- Weekly/monthly reports: total volume, sessions per muscle group, PR timeline, consistency streak
- Charts

**Phase 3 — Polish & power**
- Reusable routines/templates
- Video links + optional animations
- AI description matching
- Rest timer, notes, bodyweight/photos (optional)
- Export your whole history to a file (backup you control)

---

## 5. Data model (what gets stored)

- **Exercise** (library): id, name, target muscles, equipment, images, instructions
- **Session** (a workout on a date): id, date, list of logged exercises
- **Set**: which exercise, weight, reps, optional RPE/notes, timestamp
- **Derived:** PRs, per-muscle-group volume, streaks — calculated from sessions, not stored separately

## 6. Progressive overload logic (kept simple & safe)

- Next session pre-fills the weight/reps you did last time for that exercise.
- If you hit the top of your target rep range on **all** sets last time, it *suggests* a small bump (e.g. +2.5–5 lb, or +1 rep).
- It's always a **suggestion you can edit** — never auto-committed, never aggressive. This avoids pushing you into bad/injury-risk jumps.

## 7. Security & stability

- Personal single-user app; your data is tied to your account and private to you.
- No secrets stored in the app itself.
- Storage schema is **versioned**, so future updates never corrupt older saved workouts.
- **Export-to-file** so you always have a backup you personally control (belt-and-suspenders on top of cloud storage).
- Input validation so bad entries can't break your history.

## 8. How we build it

Iteratively, in a live browser preview you can click through on each step. Order:
1. Storage + data model + the set-logging screen (the part you'll touch every day)
2. Exercise library + muscle-group picker + recommendations
3. Calendar/history
4. Reports/charts
5. Progressive-overload autofill
6. Polish (routines, videos, export)

We get Phase 1 working and genuinely usable before adding the rest.

---
---

## 9. ADVERSARIAL REVIEW — attacking the plan above

*Deliberately poking holes, then adjusting.*

**Hole 1 — "Never lose my lifts" is fundamentally at odds with on-phone-only storage.**
iOS Safari can evict a website's stored data after ~7 days of not opening it, and a lost/reset phone wipes it. For someone whose #1 fear is losing lifts, local-only is a latent disaster.
➜ **Adjustment:** Cloud storage is treated as *required*, not optional. The Artifact built-in database stores server-side, tied to your account — it survives eviction and phone loss. This is now the default, not a nice-to-have.

**Hole 2 — Which phone? iPhone and Android behave very differently for web apps.**
Storage eviction, "add to home screen," and notifications all differ. Building without knowing risks designing for the wrong constraints.
➜ **Adjustment:** Confirm iPhone vs Android up front and design storage/offline for the stricter case (iPhone).

**Hole 3 — "Animation or video for every exercise" may overpromise.**
Free exercise data is demonstration photos + instructions; smooth per-exercise animations are a paid licensed product. Silently under-delivering would be worse than being clear.
➜ **Adjustment:** Set the expectation honestly (Decision C): free = photos + optional video links; animations are a later paid add-on. No surprise gaps.

**Hole 4 — AI description-matching hides real cost/complexity.**
In a standalone app it would need a protected server key and internet, and it costs per use.
➜ **Adjustment:** Ship smart fuzzy search first (free, offline, covers most cases). On the Artifact platform, AI matching can be added later without you managing an API key — so it's deferred, not designed-in early.

**Hole 5 — Scope creep vs "I have a hard time keeping up."**
A big feature list risks a half-built app that's never usable. The person who struggles to keep up is exactly who a stalled project fails.
➜ **Adjustment:** Ruthless MVP. Phase 1's daily loop must be rock-solid and genuinely usable before anything in Phase 2/3. Ship small, use it, then grow.

**Hole 6 — Auto-suggesting weight increases could be wrong or unsafe.**
Blindly trusting an algorithm to add weight can cause bad jumps.
➜ **Adjustment:** Suggestions only, conservative increments, always editable, never auto-applied. (Already reflected in §6, reinforced here.)

**Hole 7 — Maintenance burden on a non-developer.**
Standalone hosting + a database service means accounts, deploys, env vars, and upkeep — a real ongoing tax.
➜ **Adjustment:** The Artifact + built-in-database route removes essentially all of that. It's recommended specifically because it collapses hosting + storage + "no maintenance" into one choice, and it *also* fixes Holes 1 and 2. Strong single answer to multiple risks.

**Hole 8 — Data portability / lock-in.**
If everything lives on one platform, could you get stuck?
➜ **Adjustment:** Build **export-to-file** early (Phase 1–2, not Phase 3-only) so your entire history is always downloadable in a standard format. That's your escape hatch and your independent backup regardless of platform.

---

## 10. ADJUSTED PLAN — net changes

1. **Cloud storage is the default** (Artifact built-in database) — directly serves "never lose my lifts."
2. **Confirm phone OS first** and design for the stricter (iPhone) storage rules.
3. **Honest visuals:** photos + optional video now; animations later as an optional paid add-on.
4. **Smart search first, AI matching later** (cheap upgrade on this platform).
5. **Ruthless MVP:** perfect the daily logging loop before anything else.
6. **Progressive overload = gentle, editable suggestions only.**
7. **Export-to-file moved earlier** as an independent, platform-proof backup.

Recommended path in one line: **Build it as a Claude Artifact with the built-in database, mobile-first, starting with a rock-solid logging loop, cloud-saved from day one, with early export-to-file backup.**

---

## 11. LOCKED DECISIONS (confirmed 2026-09-07)

- **Phone:** iPhone → storage/offline designed for iOS's stricter rules; cloud storage is essential.
- **Storage + hosting:** Claude Artifact with the built-in cloud database. Data lives server-side tied to your account (survives iPhone clearing its browser and phone loss), zero server for you to maintain. Built **local-first** so it also works instantly and offline in the gym, syncing to the cloud automatically.
- **Demos:** Written instructions + a "Watch demo" video button per exercise for v1. (Real demonstration photos/animations are a deliberate next step — external image hosting is restricted on the platform, so those come as a fast-follow, with smooth animations a possible paid add-on.)
- **Exercise matching:** Smart fuzzy search first; AI matching added later as a cheap upgrade on this platform.

**Build order:** Phase 1 daily-logging loop first (Today → log with progressive-overload autofill → save → persists), then History/calendar, Library, Progress/reports. Export-to-file backup included early.
