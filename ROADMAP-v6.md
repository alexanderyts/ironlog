# Ironlog — Roadmap v6: time, and a training profile the app adapts to

Two capabilities, one principle each:

- **Time.** Stamp every checked set and every session's end. Everything else — workout duration,
  time per muscle, rest actually taken, "are you still training?" — is *derived* from those two
  timestamps. No running clocks in the data, no second source of truth.
- **Profile.** Ask each user a handful of questions once (goal, equipment, days, protected joints,
  set style), store the answers in settings, and thread them through the builder and coach as
  **independent levers with a default of "what the app does today"**. Every lever off = current
  behaviour, so the existing 112 tests stay green and each lever gets its own test.

Written for an implementing model (Opus 4.8). **Read ROADMAP-v5.md's Ground rules first — they all
apply** (tests first, engine pure, never touch the iOS viewport code, one phase = one commit/version,
plain-language changelog, browser-verify UI phases with `preview_start name:"ironlog"`, republish
both artifacts with `url`). Baseline: v0.32.0, 112 tests, 114 exercises.

Data-model rule for this roadmap: **every addition is a new optional field.** Old sessions without
timestamps simply don't appear in time statistics; a missing profile means "auto". No migration.

---

## Part 1 — Time

### Phase T1 — Timestamps + duration  (v0.33.0 · low risk · progression/sync/ui)

Schema (additive):
- `set.at` — ms timestamp written when a set is **checked done** (cleared when unchecked).
  ⚠ `st.t` already exists as the transient "edited-but-unticked" flag (ui.js `pendingSets`,
  step/input handlers). Do not reuse `t`. Name the timestamp `at`.
- `session.endedAt` — ms, written at Finish. `session.date` is already the start (set by
  `newSession`). Duration = `endedAt - date`.

Engine (`progression.js`, pure, tested):
- `sessionDuration(s)` → minutes or `null` when `endedAt` is missing.
- `setTimeline(s)` → `[{exId, group, at}]` sorted by `at` for sets with a stamp (helper for T3).
- `finalizeSets` keeps `at` (it copies the set) — add an assertion.

Sanitizers (`sync.js`): `cleanSet` keeps `at` if a finite number; `cleanSession` keeps `endedAt`.

UI:
- `bindLog` check handler: `st.done?(st.at=Date.now()):(delete st.at)`.
- `finishWorkout` commit: `s.endedAt=Date.now()` (T2 refines this).
- Editor header ("Workout in progress · saves automatically"): append elapsed time
  `· 47 min`, refreshed once a minute by a single `setInterval` that only touches that span (no
  re-render). Clear the interval in `stopRest`-style cleanup when leaving the editor.
- Summary sheet and History `sessCard` meta: `· 52 min` when `endedAt` exists.

Tests: `sessionDuration` with/without `endedAt`; `cleanSet` keeps/drops `at`; finalizeSets keeps it.
Verify: check a set → `at` present; uncheck → gone; finish → `endedAt`; History shows minutes.
Changelog: "Workouts now record how long they took."

### Phase T2 — Safeguards: forgotten Finish  (v0.34.0 · low-medium risk · ui only)

Principle: the app never ends a workout by itself; it **notices**, **tells you**, and **estimates well**.

1. **Stale detection** — a pure helper `staleness(s, now)` in progression.js:
   `{lastSetAt, sinceLastSet (min), sinceStart (min)}`. Thresholds as named constants:
   `STALE_AFTER_MIN=75` (no set for 75 min while a workout is open), `LONG_SESSION_MIN=150`.
2. **Banner** on the editor (and a line on the Home resume card) when
   `sinceLastSet ≥ STALE_AFTER_MIN`: "Still training? Your last set was 1 h 40 min ago. Finish to
   log it, or discard." Buttons route to the existing Finish / Discard flows. Re-evaluated on
   `render()` and on `visibilitychange → visible` (which already fires for sync).
3. **Optional notification** — reuse the existing `settings.rest.notify` permission; if granted
   and the app is open in the background, send one "Still training?" notification at the stale
   threshold. No new permission prompt. (Reliable background delivery isn't available to a PWA;
   say so in the changelog.)
4. **Honest end time at Finish.** In the Finish commit: if `sinceLastSet ≥ 30 min`, open a
   two-button sheet (same pattern as `confirmUnchecked`): "Your last set was at 7:42 PM. End the
   workout there, or now (9:05 PM)?" Default/primary = last set + 3 min. Store the choice in
   `endedAt` and set `s.endEstimated=true` when the last-set option is used, so T3 can show "≈".
5. **Resume across devices**: `endedAt` rides in the session; nothing new for sync.

Tests: `staleness` thresholds. Verify: set `active.date` back 3 h in the console, check no sets →
banner; finish → estimation sheet → History shows the earlier time.
Changelog: "If you forget to press Finish, the app notices and lets you log the real end time."

### Phase T3 — Time analytics  (v0.35.0 · low risk · analysis + ui + tools)

All derived from `set.at`, pure, in `analysis.js`:
- `timeByGroup(s)` — minutes attributed per muscle group: each set owns the interval from the
  previous stamped set (or session start) to its own stamp, attributed to that set's exercise group.
  Cap any single interval at `MAX_GAP_MIN=15` so a phone call doesn't credit 40 minutes to biceps.
- `restTaken(s)` — median seconds between consecutive stamped sets of the *same* exercise; also
  split by compound/isolation. This is the first time the app can say what rest you actually take
  versus the timer setting.
- `sessionDensity(s)` — working sets per 10 minutes.
- `timeTrends(sessions, now)` — 28-day averages of duration, density, rest by type.

UI:
- Progress: a "Time" card — average workout length, sets per 10 min, rest taken on compounds vs
  isolation, time split by muscle (bar list, same style as "Sets by muscle").
- Summary sheet: duration + "≈" when estimated.
- Exercise detail: "you usually rest ~2:10 here".

Review tool: a TIME section (duration, density, rest, group split per session).
Tests: `timeByGroup` attribution + cap; `restTaken` median; sessions without stamps are skipped.
Changelog: "See how long you train, how you split your time, and how long you really rest."

---

## Part 2 — Profile

### Phase P1 — Profile data + onboarding  (v0.36.0 · low risk · sync/store/ui)

`settings.profile` (all optional; absent = auto = today's behaviour):
```js
{ goal:'auto'|'size'|'strength'|'general',      // rep ranges, increments, volume landmarks
  equipment:'auto'|'full'|'commercial'|'home',   // commercial = machines/cables/dumbbells/Smith, no free barbell
  days:0|2|3|4|5|6,                              // sessions per week the user intends (0 = unknown)
  length:'auto'|'short'|'standard'|'long',       // ~45 / ~60 / ~90 min → session size
  avoid:['back-squat', ...],                     // exercise ids the builder must never pick
  protect:['Shoulders', ...],                    // muscle groups to keep off heavy loading (tier-1 excluded there)
  sets:'auto'|'straight'|'ramp',                 // how fresh prescriptions are shaped
  push:'auto'|'guide'|'quiet' }                  // 'quiet' = never suggest a heavier weight, just record
```
- `cleanSettings` whitelists each field with an enum check; unknown values → dropped (auto).
- `saveSettingsCloud()` already syncs settings; nothing new.
- **Onboarding sheet** on first launch (no sessions, no profile): five taps, skippable, every
  answer defaults to auto. Same sheet reachable from Settings → "Training profile". Avoid/protect
  are pickers (exercise search / group chips).
- No engine change in this phase. Tests: sanitizer enums; a profile round-trips through export/import.
Changelog: "Tell the app how you train (once); the next updates make it listen."

### Phase P2 — The builder listens  (v0.37.0 · medium-high risk · builder.js)

`planWorkout(groups, sessions, seed, opts)` gains `opts.profile`; it passes it to
`buildRecommendation` → `pickForGroup` → `seedExercise`. **Each lever is one `if` and one test.**
Order of application (fixed, so levers compose predictably):
1. **avoid** — filter the pool: `pool.filter(e=>!avoid.includes(e.id))`. Also in `replacementFor`,
   `anchorVariation`, `gapFillExercise`, `complementSuggestions`. A continued plan that contains an
   avoided exercise gets it swapped via `replacementFor` (reason string: "you asked to avoid it").
2. **equipment** — `commercial`: exclude `equip==='Barbell'` unless the user has *logged* that lift
   in `smith` mode (then keep, prescribed as smith); `home`: keep Dumbbell/Bodyweight only. Applied
   to the pool before anchors are chosen, so a machine-only gym gets machine anchors (T1 tier-1s
   exist: leg press, lat pulldown, machine chest press…; verify with a test per preset).
3. **protect** — for groups listed, drop tier-1 free-weight compounds from the pool and prefer
   machines/cables; never raise `volumeBump` for that group.
4. **length** — `buildRecommendation` total: short 5, standard 7 (today), long 8; `MAX_SESSION_EX`
   becomes the long value.
5. **goal** — in `seedExercise`/`nextSets`: `strength` uses the low end of `rr` and
   `unitIncrement` unchanged; `size` shifts the target range up by 2 (a [5,8] lift is prescribed
   [8,12] … cap at 15) and prefers `LONG_LENGTH` (+0.7 → +1.2); `general` = auto. Implement as a
   `repRange(ex, goal)` helper so the range shift lives in one place.
6. **sets** — `ramp`: fresh prescriptions for tier-1 lifts come as 3 ascending sets
   (`[0.8w, 0.9w, w]`, rounded to the plate grid) instead of flat; `straight` forces flat even when
   last time ramped. `auto` = today (mirror last time).
7. **push** — `quiet`: `suggestion()` returns `kind:'match'` with neutral text and never bumps.

Reactions to profile changes: **none retroactive.** History is untouched; the next build uses the
new profile. Audit tests (CHURN, HOLD-WHAT-WORKS, ANCHOR SAFETY, deload) must pass with every
lever set, individually and with `commercial+protect Shoulders+short` together.

Ramification to state plainly in the changelog: a `commercial` profile can change a continued
plan's anchors (barbell bench → machine chest press). The reason toast says so once.

### Phase P3 — The coach listens  (v0.38.0 · low-medium risk · analysis.js)

- `days` → `freq-low` threshold: with 2 days/week, don't nag about 1×/week frequency for muscles
  that only fit once; with ≥4, keep today's rule.
- `goal` → volume landmarks in `volume-low`: size 10–20 sets/week, strength 6–12, general 8–15
  (Schoenfeld 2017; Israetel MEV/MAV). Wording: "for size, chest at 6 sets/week is below the
  ~10 that reliably grows it."
- `protect` → a `protect` finding ("you're keeping Shoulders light — here's what's covering them")
  instead of region-gap nags for tier-1 patterns there.
- `push:'quiet'` → the `progression` finding is descriptive only ("3 of 5 lifts went up").
Tests in findings.test.js per lever.

### Phase P4 — Review tool + adversarial audit of the profile  (v0.39.0)

- `tools/review.js --profile '{"equipment":"commercial"}'` overlays a profile on a backup and prints
  the builds and coach output side by side with the auto profile — the before/after the owner asked
  for. `--why` shows the lever that changed each pick.
- Audit block "PROFILE": for each preset × each equipment setting, the session builds, covers its
  groups, and contains no avoided/excluded equipment; `protect` never yields a tier-1 free-weight lift
  for that group; levers compose without a crash for all 3×4×3×3 combinations (loop, assert shape).

---

## Also worth folding in (same principles, cheap once the above exists)

| Idea | Built on | Cost |
|---|---|---|
| Rest timer defaults from **rest actually taken** (T3 `restTaken`) instead of a fixed 120/75 | set stamps | small |
| "You trained 3 days this week, you planned 4" nudge on Home | `profile.days` + `weekIndex` | small |
| Warm-up prompt on tier-1 lifts (ACSM/NSCA) as a pre-filled warm set at 50% for `strength`/`auto` | goal lever | small |
| Weekly load-jump guard: if a prescription is >10% over last time (e.g. after a manual edit), say so | `nextSets` | small |
| Time-of-day pattern ("your best sessions are mornings") | set stamps | later |
| **Health tracking** (Apple Health / Google Fit) | needs a native wrapper; a PWA cannot read HealthKit. Bodyweight and sleep can be logged **manually** in Settings today and the coach can use them; the automatic import is a v7 item that comes with the App Store wrapper. | v7 |

---

## Ramifications, in one place

- **Data:** two new numbers per checked set/session and one small settings object. Old sessions
  lack timestamps → time stats simply skip them (say so on the Time card: "from 12 Sep onward").
- **Battery/perf:** nothing runs in the background. The elapsed display is one 60-second interval
  while the editor is open. Stale checks happen on render/resume.
- **Sync:** all fields ride inside records that already sync; sanitizers extended. No new backend.
- **Privacy:** timestamps and profile stay in the user's own data; the Dropbox file and artifact
  DB already hold the sessions they attach to.
- **Builder risk:** the profile multiplies configurations. Mitigated by: levers off = today;
  fixed application order; one test per lever; combination audit in P4; the `--why` trace to
  explain any surprising pick.
- **Not doing:** auto-ending workouts (never), background notifications the platform can't deliver,
  reading health data from a PWA.

## Dependency map
T1 → T2 → T3 (each derives from the last). P1 → P2 → P3 → P4. T and P are independent; ship T1–T3
first (smaller, immediately useful to the owner's testing), then P1–P4.
