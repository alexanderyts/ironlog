# Ironlog — Handoff

Last updated: 2026-10-03 · App version: **v0.75.3** (pushed to `main`; see `git log`) · Tests: **458 passing**

## Project

Ironlog is a mobile-first workout tracker for one owner (Alexander, `alexanderyts` on GitHub). They use it on an iPhone as a home-screen app, and their partner may use it too. The owner finds it hard to keep tracking workouts, so tracking has to be effortless:
- the app **remembers and suggests, never drives**;
- it must **never lose a lift**;
- it must be clear to a beginner.

It is plain HTML/CSS/JS with no frameworks. One source tree produces three outputs:
- a GitHub Pages PWA, which is what the owner actually uses;
- a private Claude Artifact with cloud storage;
- a public demo Artifact.

The owner is not a developer, so explain changes in plain language: what changed, and what it means when using the app.

## Current state

**Works (each item tested in the jsdom harness, and in the browser pane where noted):**
- **Logging loop:**
  - build a workout from muscle groups, or start from scratch, a routine, or a recent workout;
  - log sets: tick ✓, warm-ups, rest timer, stopwatch for timed holds, plate loader;
  - Finish, then a summary.
  - Only ticked sets are saved.
- **Suggestions (v0.70):**
  - An increase is never pre-filled. Rows repeat last time, and a one-tap **"Try X"** chip offers the bump.
  - Exercise swaps and additions appear as **offer cards** (Swap/Keep, Add/No thanks).
  - A declined offer is remembered for 3 weeks.
  - After 10+ days away the app says "Welcome back — same as last time".
- **Records:** "Your record" picker. Records default to the heaviest set, and the user can choose another (stored in `settings.records`). A "Don't count this" option sits on the finish screen.
- **Progress tab:**
  - Your lifts, with statuses pr / up / stuck / down / hold / new;
  - Coach Focus + Wins;
  - Muscles vs target;
  - Records with "Show all".
- **Sync:**
  - local-first (localStorage);
  - Dropbox on the site build, with conditional uploads and conflict retry;
  - the artifact `db` on the private artifact.
  - Merges union ticked sets, so a stale copy can't drop a lift.
  - Each session stores its unit.
- **v0.75.0 first run & Home:**
  - "Where do you train?" gym picker card;
  - the app learns from barbell swaps (it offers "No barbell rack?" after 2 workouts);
  - first build capped at 4 exercises × 3 sets;
  - "How to log" tip;
  - deload switch hidden until 5 workouts;
  - optional name in the greeting;
  - last-week recap line on Home;
  - calendar (.ics) workout reminder in Settings.
  - The gym card, the first build and the reminder sheet were also checked at phone size in the browser pane.
- **v0.75.1:** bodyweight moves show an **"Added lb"** column with a "BW" placeholder plus a one-line explainer. Assist machines show **"Assist lb"**. Checked in the browser pane.
- **v0.75.2:**
  - New **Bodyweight Squat**, scored by reps.
  - The builder won't make a rep-only bodyweight move a *new* main lift when something loadable fits. Core is exempt.
  - Lifts switched to "Bodyweight" mode tick and save with no weight.
- **v0.75.3:** new **Jump Squat** and **Burpee** (Quads, Bodyweight, tier 3, `squat` pattern), scored by reps. Both are in `HARD_BW`, so the builder never picks them fresh. Once logged, continued plans keep them. Searching, logging with blank weight and Finish were checked in the browser pane.

**Partly done / known gaps:**
- **On-device (2026-10-03):** the owner checked the four v0.75.x items on the iPhone, and all worked: Home gym card, push-up "Added lb"/BW, Bodyweight Squat, and the calendar reminder from the installed PWA (iOS .ics works). Other v0.70–v0.74 changes have had no targeted on-device check. CHANGELOG entries still say "Not verified on-device."
- **Lifts switched to Bodyweight mode** (e.g. a walking lunge) save, but at 0 weight they produce **no record**. `scoreSet` in `src/engine/progression.js` judges by exercise id, not mode.
- **Calendar reminder and export do nothing in the public demo.** The demo artifact has no `downloads` capability, and the publish tool warns about it each time.
- **Not built from batch 5b:**
  - Home "Pick up where you left off" (the New-workout screen already has "Repeat a recent session");
  - folding Progress details into one section.
- **Small leftovers** (from an earlier session's notes; details unverified):
  - "weighted glute bridge mixed scale";
  - "stuck" reason text.

**Broken:** nothing known.

## Next steps

1. ~~Ask the owner for an on-device check of v0.75.x.~~ **Done 2026-10-03:** all four items passed.
2. ~~Get the owner's answer on no-equipment moves.~~ **Done 2026-10-03:** the owner does jump squats and burpees only, and both shipped in v0.75.3. Lunges and calf raises were not added.
   - To add another, put a row in `RAW` plus a `META` entry in `src/data/exercises.js`.
   - Then diff `tools/builder-audit.js` and `tools/review.js` output before and after (see How to run and test).
3. **Optional fix for the record gap:** make bodyweight-mode lifts produce records. This needs `scoreSet` to know the instance mode, and it's called in many places, so plan it first.
4. **Optional demo fix:** declare `downloads` on the demo, or hide the reminder and export in demo builds (`CFG.DEMO`).
5. **Batch 5b leftovers:** "pick up where you left off" and folding Progress details. Ask the owner first, because both are design choices.
6. **Later, only if the owner wants them** (from `REVIEW-2026-09-22.md`):
   - §6 Couples: a "Who's training?" switcher, or sharing a routine as a code;
   - §9 an AI coach.

## Decisions

- **Platform (2026-09-07):** local-first app, three outputs from one source.
  - PWA on GitHub Pages; Dropbox sync uses the **App-folder scope**.
  - Private Claude Artifact using the `db` capability.
  - Public seeded demo.
  - Rejected: a server, and any maintenance burden on the owner.
- **Suggest, don't drive (v0.70):** increases are offered with one tap ("Try"), never pre-filled. Swaps and additions are offers, never automatic. The strength rep range is gentler: `[lo, min(hi, lo+2)]`.
- **Records (v0.69/v0.71):**
  - The record pick is stored once in `settings.records`.
  - Rejected: re-stamping old sessions. A sync from another device reverted those edits.
  - "Record" is the plain name; "PR" is used only for celebration.
- **Sync merge (batch 1, v0.71):** the merge keeps every ticked, time-stamped set from both copies. The trade-off is chosen on purpose: a deleted set can come back from a stale copy, which is visible and fixable, whereas a lost lift is not.
- **Weight steps (v0.72):** a user-set step means no snapping.
  - Rejected: snapping to multiples of the step. Real stacks go 25/40/55.
- **Unticked sets (v0.73):** the finish summary offers "Add it".
  - Rejected: a prompt at Finish. It interrupted almost every finish and broke the "only ticked sets save" rule.
- **Muscle targets (v0.74):** only directly trained muscles get "low" nags. Helper muscles get a number only.
  - Rejected: a helper-muscle effective-sets gate. It flagged triceps from bench and buried real to-dos.
  - Weekly averages divide by `min(4, weeks since first workout)`.
- **Gym picker (v0.75.0):** gym chain names are shortcuts onto the builder's 3 gym types (`full` / `machine` / `home`). Planet Fitness counts as `machine` (no barbell rack).
  - Rejected: a per-chain equipment database. Branches vary, it would need upkeep, and it would mostly cover US gyms.
  - Wrong guesses are corrected by an offer after the user swaps out barbell lifts twice, never silently.
- **Deload switch** stays hidden until 5 workouts. A brand-new user's first build is capped at 4 exercises × 3 sets (v0.75.0).
- **Rep-only bodyweight moves** (air squat, sissy squat) can't be a *new* main lift when a loadable option fits. Core is exempt, because ab wheel and hanging leg raise are fine core main lifts (v0.75.2).
- **No-equipment additions (v0.75.3):** add only the moves the owner actually does (jump squat, burpee), to keep the library short.
  - Burpee is filed under **Quads**: the app has no full-body group.
  - Both use the `squat` pattern, not `iso`. As `iso` they'd win a home gym's quad-isolation slot.
  - Both are in `HARD_BW` (the builder's copy and the `tools/builder-audit.js` copy). They're high-impact and a poor main lift, so a no-equipment leg day still leads with Bodyweight Squat.
- **iOS layout saga (v0.8.0–v0.8.10) is closed.**
  - Fix: standalone `html{min-height:screen.height}` and a constant-anchored tab bar.
  - Don't reopen it with positioning guesses. If a new layout bug appears, add on-screen diagnostics first.
- **Owner preferences (stated in conversation):**
  - keep the current look (no darker greys);
  - short bullets, not wordy text;
  - ask before design choices;
  - avoid friction.

## Conventions

- **No frameworks or runtime dependencies.** `jsdom` is a dev dependency for tests only.
- **Module structure:**
  - Modules share the global `IL` namespace (`IL.data`, `IL.prog`, `IL.builder`, `IL.analysis`, `IL.sync`, `IL.store`, `IL.ui`).
  - Engine modules are **pure**: sessions in, results out, no DOM.
  - The 4 UI files (`ui-core`, `ui-today`, `ui-views`, `ui-bind`) share **one scope**; `build.js` wraps them together.
- **Code style:** dense one-liners. Comments say *why* and carry a tag like `(v0.75)`, `(batch 1)` or `(review 7.3)`. Match the surrounding density.
- **Any new stored field** must be added to the whitelist sanitisers in `src/engine/sync.js` (`cleanSettings`, `cleanSession`, `cleanProfile`). Otherwise it is silently dropped on load, import and sync.
- **Comparing sets** always goes through the one judge, `scoreSet` / `beatsScore` (`src/engine/progression.js`).
- **One-time cards and flags:**
  - stored in `settings.seen` (keys match `^[A-Za-z0-9_:-]{1,60}$`);
  - dismissed via `data-seentip="key"`.
- **UI actions:** `data-action="x"` maps to the `ACTIONS` map in `src/app/ui-bind.js`.
- **Tests:**
  - `node:test`, with one file per release batch (e.g. `test/first-run-v075.test.js`);
  - UI flows use `launch()` / `buildWorkout()` from `test/ui-harness.js`.
- **Ship workflow:**
  1. Bump `version` in `package.json`.
  2. Run `node build.js`.
  3. Add a plain-language `CHANGELOG.md` entry ending "Not verified on-device."
  4. Commit as `git -c user.name="Alexander" -c user.email="alexander.yts@gmail.com" commit`, with the message ending `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. The pre-commit hook runs all tests.
  5. `git push origin main`. GitHub Pages redeploys.
  6. Republish `dist/app.html` and `dist/demo.html` with the Artifact tool, passing their URLs (see Key files).

## Key files

**Source**
- [src/data/exercises.js](src/data/exercises.js) — exercise library (`RAW` rows), `META` (region, pattern, tier), modes, assist and timed sets, `BW_FACTOR`.
- [src/engine/progression.js](src/engine/progression.js):
  - last performance and next sets;
  - `suggestion` (Try offers);
  - `scoreSet` (the one judge);
  - record picks (`pickKey`, `ncOf`);
  - `finalizeSets`.
- [src/engine/builder.js](src/engine/builder.js):
  - `planWorkout` (continue vs fresh; `offerOnly`);
  - `pickForGroup` (anchor rules);
  - `seedExercise`, `fitSessionBudget`, `fitFirstSession`, `profileAllows`.
- [src/engine/analysis.js](src/engine/analysis.js) — `analyze`, findings, `liftStatus`, `coachReport`, `muscleWeekly`.
- [src/engine/sync.js](src/engine/sync.js) — merge/union of sets, tombstones, import sanitisers, `PROFILE_ENUM`, CSV export, `reminderIcs`.
- [src/engine/search.js](src/engine/search.js) — fuzzy exercise search.
- [src/app/store.js](src/app/store.js) — local-first state and cloud adapters (artifact db / Dropbox / none), import, unit normalisation, recovery of dropped workouts.
- [src/app/dropbox.js](src/app/dropbox.js) — Dropbox OAuth (PKCE) and conditional upload.
- [src/app/ui-core.js](src/app/ui-core.js) — shared helpers, toast, accessibility, memo cache.
- [src/app/ui-today.js](src/app/ui-today.js):
  - Home (gym card, recap);
  - New-workout screen;
  - session editor;
  - set rows;
  - Replace;
  - first-workout tip.
- [src/app/ui-views.js](src/app/ui-views.js) — History, Library, Progress, records, profile sheet, Settings (name, reminder), export.
- [src/app/ui-bind.js](src/app/ui-bind.js) — event binding, `ACTIONS`, finish flow, tick guards, boot.
- [src/app/seed.js](src/app/seed.js) — demo data (demo build only).
- [src/styles.css](src/styles.css), [src/template.html](src/template.html) — styles and page shell.

**Build, tests and tools**
- [build.js](build.js) — builds `dist/app.html`, `dist/demo.html` and `docs/`. Normalises CRLF to LF and computes the CSP hashes.
- [server.js](server.js) — dev server on :4321 serving `docs/`; `/demo` serves `dist/demo.html`.
- [test/](test/) — 50 files. [test/ui-harness.js](test/ui-harness.js) is the jsdom harness (`launch({fakeClock})`).
- [tools/builder-audit.js](tools/builder-audit.js) — runs the builder over many choices; every problem row must stay 0.
- [tools/review.js](tools/review.js) — what the builder and coach would do for a backup file. Used by the snapshot test.
- [.githooks/pre-commit](.githooks/pre-commit) — runs the full suite; enable per clone with `npm run hooks`.

**Docs and data**
- [CHANGELOG.md](CHANGELOG.md) — every version in plain language.
- [REVIEW-2026-09-22.md](REVIEW-2026-09-22.md) — the latest full review; §6 and §9 are still open.
- Older `ROADMAP-*.md`, `REVIEW*.md` and `PLAN*.md` files are historical. Their status wasn't re-checked for this handoff.
- `data/` (gitignored, **private, never commit**; the repo is public) — the owner's real backup `owner-2026-09-13.json` and its snapshot `.expected.txt`.
- `docs/` — built PWA, committed for GitHub Pages. `dist/` is gitignored.

**Links**
- Live PWA: https://alexanderyts.github.io/ironlog/ · repo: https://github.com/alexanderyts/ironlog
- App artifact (private): https://claude.ai/artifact/WPBJP4GX3XDiLkqi6mRcXN (v93) · demo artifact (public): https://claude.ai/artifact/MBrq8xsCzHXvgSEsVeb7ro (v87)
- Landing page artifact: https://claude.ai/artifact/S5eQsNjP1Hp8dyJqWzQ8EG. Its source was in a temporary scratchpad and may be gone (unverified); read it back with the Artifact tool's `read` action.
- Night review report (2026-09-23): https://claude.ai/artifact/9BcB4sVDfsqfcCxLLWRT3t

## How to run and test

```bash
npm run hooks                     # once per clone: enable the pre-commit test hook
node build.js                     # build dist/ and docs/ (required before tests; a test checks built files match source)
npm test                          # full suite: node --test --test-timeout=120000 test/*.test.js (~15 s)
node --test test/first-run-v075.test.js   # one file
node tools/builder-audit.js       # every problem row must read 0
REVIEW_NOW=1790000000000 node tools/review.js data/owner-2026-09-13.json --why   # diff before/after an engine change
UPDATE_SNAPSHOTS=1 node --test test/review-snapshot.test.js                    # accept an intended snapshot change
node server.js                    # dev server http://localhost:4321 (or the "ironlog" entry in .claude/launch.json)
```

## Gotchas

- **CRLF:** git autocrlf turns sources to CRLF, which once broke the CSP hash and gave a blank site. `build.js` now normalises to LF, and a test recomputes the CSP. The "LF will be replaced by CRLF" warnings on commit are expected.
- **Escape sequences:** shell or Python heredocs can mangle `\r` / `\n` / `\d` inside JS strings. Use the Edit tool, or check the result with grep.
- **Snapshot test** skips without `data/`. It must be updated deliberately: diff the `tools/review.js` output first, then `UPDATE_SNAPSHOTS=1`.
- **jsdom tests:** `assert.deepEqual` on objects from the app window fails across realms. Compare fields with `assert.equal`.
- **Browser pane:**
  - Screenshots time out when the pane is hidden. Drive it with `javascript_tool` instead.
  - Use `http://127.0.0.1:4321` to get fresh, empty storage that's separate from `localhost`.
- **Artifact sandbox:** no `confirm` / `alert` / `window.open`, and no external images. Use the in-app confirm dialog and `<a target=_blank>`.
- **Caching:**
  - The Claude iOS app caches artifact content.
  - The PWA service worker serves the HTML network-first.
  - When the owner reports a bug, check the version line in Settings first. Stale versions caused false leads before.
- **Browser check vs tests:** a `setRow` scope bug (v0.73) passed the tests but crashed rendering. After UI edits, check in the browser and read the console.
- **Builder changes:**
  - Adding an exercise can change builder picks. The Bodyweight Squat briefly became the main leg lift at home gyms half the time.
  - Always diff `builder-audit` and `review.js` output before and after.
- **Demo artifact downloads:** the publish tool warns that the demo uses `downloads` without declaring it (see Current state).
- **Outdated docs:** `README.md` still describes `src/app/ui.js`. That file is now split into the 4 `ui-*.js` files.

## Open questions

- ~~Should other no-equipment moves become their own exercises?~~ Answered 2026-10-03: jump squats and burpees only (shipped in v0.75.3).
- Should "Pick up where you left off" on Home, and folding Progress details, be built?
- Does the owner want the couples features (`REVIEW-2026-09-22.md` §6) or an AI coach (§9)?
- ~~On-device results for v0.75.x are still to come.~~ Answered 2026-10-03: all four checks passed.

## Session log

- **2026-10-03:** Handoff prepared. Wrote this file and the session protocol in `CLAUDE.md`. No app changes.
- **2026-09-22 → 2026-09-23:** Worked through reliability, accessibility and tidy-up (v0.66–0.67) and the Progress tab rework (v0.68). Shipped the record picker (v0.69) and test safety nets (fake clock, service-worker tests, pre-commit hook). Ran an overnight adversarial review: 43 findings. Then shipped the owner-chosen batches:
  - v0.70 suggest-don't-apply;
  - v0.71 never lose a lift;
  - v0.72 trustworthy suggestions;
  - v0.73 logging polish;
  - v0.74 clearer screens;
  - v0.75.0 first run and Home (gym picker);
  - v0.75.1 bodyweight "Added lb" column (the owner was confused logging push-ups);
  - v0.75.2 Bodyweight Squat (the owner found no plain squat).
  Also updated the landing-page artifact with the owner's new photo.
- **2026-09-07 → 2026-09-18:** Built the app from scratch to v0.60, all in one long-running session with several context compactions:
  - platform decision;
  - MVP logging loop;
  - iOS tab-bar fix (v0.8.x);
  - pattern-aware progression;
  - plan-aware builder;
  - security hardening (v0.16);
  - findings and coach layers;
  - library expansion;
  - training profile;
  - cardio;
  - time tracking;
  - several adversarial reviews.
  See `CHANGELOG.md` for each version.
