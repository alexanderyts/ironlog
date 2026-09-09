# Ironlog — Changelog

Versioning: `MAJOR.MINOR.PATCH`. Each published version is labeled in the Artifact version history too.

## v0.6.2 — 2026-09-09
- Bumped version to force the service worker to refresh cached clients (the Dropbox-key config change in the previous commit didn't bump the version, so the offline cache didn't know to invalidate itself).
- Moved "Cloud backup" higher in Settings, right under Units, so the Connect Dropbox button doesn't require scrolling past the rest-timer options to find.

## v0.6.1 — 2026-09-07
Shareable demo + fixes from reviewing the app with real-looking data.
- **Demo build** (`dist/demo.html`): no cloud database (so it can be shared publicly), seeded on first open with ~5 weeks of a progressive push/pull/legs rotation, routines and a bodyweight. Each viewer keeps their own copy; Settings has "Reset sample data".
- Coaching: "legs undertrained" now needs a real 3:1 skew (2:1 is normal on push/pull/legs); the weekly-volume tip counts secondary-muscle work at half credit (a press trains triceps too) and skips core/calves.
- PRs: compound lifts first by e1RM; isolation shows best set only (an estimated 1RM for a calf raise is meaningless); bodyweight moves read "Bodyweight × 10".
- Library: the "+" on a row adds straight to today's workout; chip rows no longer show a scrollbar on desktop.
- Settings: bodyweight steps by 2.5 lb / 1 kg and the value is tappable to type; calendar month arrows are bigger; sheets are centered at a sane width on large screens.

## v0.6.0 — 2026-09-07
Structural overhaul + feature sprint.
**Structure**
- Source split into `src/` modules (data · engine · app), assembled by `build.js` into two targets: `dist/app.html` (Claude Artifact) and `docs/` (standalone GitHub Pages PWA).
- **33 unit tests** (`npm test`, node:test, zero dependencies) lock in the smart behaviour: region/pattern coverage per muscle, foundational anchors, progression continuity, ordering invariants, the spinal-load cap, set prescription, suggestions, coaching tips, warm-up/bodyweight handling, sync/tombstone merging, unit round-trips, search.
- Engine modules are pure (take sessions in; no DOM/state), which is what makes them testable.
- Standalone site build: installable PWA with **offline service worker**, web manifest, generated app icons, iOS full-screen meta, and an "Update ready" toast when a new version deploys.
- **Cloud backends are pluggable**: Claude DB (artifact), **Dropbox** (site — OAuth PKCE in-browser, one JSON file in the app folder, multi-device merge with deletion tombstones), or on-device only.
- Schema stamp + migration hook; deletions tracked with 90-day tombstones so no device resurrects a deleted workout.
**Features**
- **In-progress workout is cloud-synced** (survives a dead battery / continues on another device).
- **Undo** for delete session, discard workout, remove exercise, delete routine.
- **Edit past sessions** (History → session → Edit): same editor as a live workout.
- **Warm-up sets**: tap a set number to mark it "W" — excluded from PRs, volume, suggestions and analysis.
- **Bodyweight setting**: pull-ups, dips and push-ups now carry real load in volume and e1RM.
- **Saved routines**: save any workout (live or past) by name; load it in one tap from the start screen; delete with undo.
- Smart suggestion: a session with pressing and *no* pulling now always suggests a pull first.
- Unit conversion resolution refined (kg 0.1 / lb 0.25) so lb↔kg round-trips exactly.

## v0.5.0 — 2026-09-07
Algorithm review & refinement for max performance + data-integrity fixes.
- **Lift tiers.** Every exercise tagged 1 (foundational), 2 (secondary/key accessory), 3 (finisher). The session anchor is always a tier-1 lift on the muscle's *key* pattern — no more upright-row shoulder anchors or deadlift-as-back-filler.
- **Progression continuity.** If you have history on a foundational lift for that muscle, the builder anchors on the *same* lift so progressive overload compounds week to week; accessories are what rotate (small penalty for repeating last session's accessories).
- **Complementary patterns.** New `IDEAL_PATS` per muscle: hamstrings get hinge **and** curl, quads get squat **and** lunge (+ isolation), back gets vertical **and** horizontal pull. Lower body no longer uses fake "regions."
- **No padding.** The filler loop stops when nothing adds real coverage; duplicate isolation (fly + crossover) is penalised; a different-equipment compound variant is allowed; ties prefer loadable equipment over bodyweight.
- **Safety cap.** Max two heavy barbell squat/hinge lifts per session (spinal load/recovery); extras swap to a non-barbell variant. Hip thrust exempt (loads hips, not spine).
- **Set prescription.** New exercises start with a real plan: main lifts 4 sets, other compounds 3, isolation 3, finishers 2 — reps prefilled at the bottom of the target range.
- **Honest finish.** Untouched prescribed sets are dropped on save; sets with a weight (or reps on bodyweight moves) count as performed.
- **Suggestions & coaching** now understand pattern pairing ("your hamstrings work has no hip hinge — pair it with RDL") and never suggest niche moves to fix push/pull balance.
- **Bug fix — unit switch.** Switching lb↔kg previously just relabelled numbers, silently corrupting history and PRs. Now converts every stored weight (nearest 0.25, round-trips cleanly) after confirmation.
- Schema version stamped on sessions (`schema: 1`) with a migration hook at boot.

## v0.4.1 — 2026-09-07
Sharper exercise ordering for whole-session performance.
- Ordering now scores each lift by movement demand **plus loadability** (barbell compounds lead their tier) and leads with your **focus muscle's** key lift — not just compound-before-isolation.
- Added **"Auto-order for best performance"** on the workout screen (3+ exercises) so manually built workouts get the same smart ordering.

## v0.4.0 — 2026-09-07
Smart workout intelligence + effectiveness analysis.
- **Region/pattern metadata** added to every exercise (which head/part of the muscle it emphasizes + its movement pattern).
- **Intelligent workout builder** — instead of random, picks a compound anchor then fills to comprehensively cover a muscle's regions (e.g. upper/mid/lower chest, front/side/rear delts) and varies movement patterns; avoids stacking too many heavy compounds; orders big lifts first for safety.
- **Dynamic complementary suggestions** — a "Suggested" pick on the workout screen and a "Smart picks" section in Add-exercise, computed from what you've already chosen (fills region gaps, adds new movement angles, balances push vs pull).
- **Effectiveness analysis in Progress** — Push/Pull and Upper/Lower balance bars plus "Coach's notes": push/pull imbalance, leg neglect, uncovered muscle regions, weekly-volume adequacy (10+ sets/week landmark), and a monthly progression read (how many lifts are trending up).

## v0.3.0 — 2026-09-07
Rest timer + customization.
- **Rest timer** that auto-starts when you complete a set (toggleable). Sticky countdown bar with progress, +15s, and Skip.
- **Between-set alert** — sound beep + phone vibration (Android) + optional on-screen "Go!" and phone notification banner when rest ends. Works while the app is open (iOS blocks background/locked-screen alerts for web apps).
- **Customizable in Settings:** auto-start on/off, sound on/off, phone notification on/off, and separate rest lengths for big lifts (default 2:00) vs isolation (default 1:15).
- Note on Apple Watch/Health: not possible from a web app (Apple gates HealthKit/WorkoutKit to native App Store apps). Documented in-app guidance to run an Apple Watch workout alongside for rings/heart-rate.

## v0.2.0 — 2026-09-07
UX/UI overhaul based on first-round feedback.
- **New home screen.** Today tab now opens on a dashboard (greeting, week stats, streak, last session, quick links) instead of dropping straight into workout setup.
- **Navigation fixed.** Added a back button on the workout screen and a dedicated "Start a workout" flow — you can leave a workout and come back to it.
- **Resume workout.** An in-progress workout now shows a "Resume your workout" card on the home screen; leaving the screen no longer strands you.
- **Discard now works.** Replaced the browser `confirm()` dialog (blocked inside the app sandbox) with a custom in-app confirmation. Same fix applied to "Delete session."
- **Watch demo now works.** Replaced blocked pop-up calls with real links that open the demo video reliably.
- **Tap an exercise** in a workout to open its details/instructions in a slide-up sheet.
- Added a visible version number in Settings.

## v0.1.0 — 2026-09-07
Initial build (Phase 1).
- Muscle-group workout builder + recommendations.
- 67-exercise library with fuzzy "type a description" search.
- Fast set logging with weight/rep steppers.
- Progressive-overload autofill (prefills last session, suggests increases).
- Calendar history + session detail.
- Progress: weekly volume chart, PRs (e1RM), streak, sets-by-muscle.
- Local-first storage synced to cloud database; file export/import backup.
