# Ironlog — Roadmap v5: correctness pass + structural prep

Theme: **make the app trustworthy, and make the next ten features cheaper.** Every fix below is
verified against the code (see "Evidence"). Phase 0.5 is the only non-fix: a small, behaviour-free
tidy that every later phase then leans on. One new capability (muscle-group presets) rides along
because it is data-only and its engine prerequisite is itself a fix.

Written for an implementing model (Opus 4.8). **Read the whole file before starting.** Phases are
ordered by dependency and data-safety; do not reorder. **Each phase = one commit, one version bump,
tests green, changelog entry, republish.**

Baseline: v0.22.0, commit `793dd6d`, 91 tests passing (`node --test test/*.test.js`).

---

## Ground rules (read twice)

1. **Tests first.** For every behavioural fix, add a failing test in `test/*.test.js` that pins the
   *correct* behaviour, run it, watch it fail, then fix. Never loosen or delete an existing assertion
   to make a phase pass. If an existing test disagrees with a fix, stop, reason about which is right,
   and write the reasoning in the commit body. `test/audit.test.js` holds invariants, not suggestions.
2. **Run** `node --test test/*.test.js` before and after every phase. The count must never go down.
3. **Engine stays pure.** `src/engine/*` must not touch `document`, `window`, `state`, or call
   `Date.now()` except as a default for a `now` parameter. UI-only behaviour lives in `src/app/ui.js`.
4. **Do not touch** the iOS standalone viewport code: ui.js `viewportDiag`/`STANDALONE`/
   `viewportDeficit`/`syncViewportDeficit`/`watchViewport`/`vlog` (≈ lines 533–598) and the CSS for
   `--deficit`, `--screen-h`, `html.standalone`. It is a hard-won fix (memory `ios-safe-area-model`).
5. **Signature convention for anything you touch:** more than three parameters → options object.
   Do not sweep untouched functions.
6. **Minimal diffs, but no new special cases.** If a fix would add another copy of an existing
   pattern (a fourth week bucketer, a seventh start path), use the shared helper from Phase 0.5.
7. **Ship per phase:** `node build.js` → commit with
   `git -c user.name="Alexander" -c user.email="alexander.yts@gmail.com" commit -m "..."` ending in
   the trailer `Co-Authored-By: <current model name> <noreply@anthropic.com>` → `git push` (GitHub
   Pages serves `docs/`) → republish with the Artifact tool, **always passing `url`** (a publish
   without `url` creates a new artifact): `dist/app.html` →
   `https://claude.ai/code/artifact/edf1bb41-a9fb-4c1c-ad7c-fea91b5f86ad` (private, cloud DB) and
   `dist/demo.html` → `https://claude.ai/code/artifact/a37aeb71-6fe4-46fa-85b4-36795020e840`
   (public seeded demo). Bump `package.json` and add a `CHANGELOG.md` entry.
8. **Plain-language changelog.** The owner is new to coding. Each entry: one line on what changed
   *for the user*, then one technical line. Example:
   `- Streak now counts real Monday-to-Sunday weeks. (progression.js: weekIndex replaces epoch buckets in calcStreak/isoWeek/weeklyVolumes)`
9. **Browser verification** for UI phases: `preview_start name:"ironlog"` (`.claude/launch.json`
   runs `node server.js` on port 4321; the service worker is disabled on localhost). Use the mobile
   preset; the pane is often hidden, so drive it with `read_page`/`javascript_tool` and take a
   screenshot as proof.
10. **Stop conditions.** Stop and report (don't improvise) if: a test outside the phase's scope
    fails; a fix needs to touch rule-4 code; the diff for a phase exceeds ~250 lines (Phase 0.5 is
    exempt — it is split into three commits instead); or the behaviour you observe in the browser
    contradicts the Evidence line for that phase.
11. **Baseline first.** The working tree currently has a modified `docs/index.html` from a build.
    Before Phase 0: `git checkout docs/index.html` so "clean after a no-source rebuild" is testable.

---

## Phase 0 — Build hygiene + service worker guard  (v0.22.1 · low risk · build.js only)

A. **Drop the timestamp from the bundle header** (`build.js:15` `new Date().toISOString()`). Every
   build currently dirties `docs/index.html` and rotates the CSP hash with no source change. Keep
   the version.
B. **Service worker: never cache a bad response.** Both fetch branches in the SW template do
   `caches.open(V).then(c=>c.put(...))` with no `res.ok` check and outside `e.waitUntil`. A 503
   during a deploy becomes "the app" offline. Fix: `put` only when
   `res.ok && !res.redirected && res.type!=='opaque'`, inside `e.waitUntil(...)`. (The cache name
   `V` is already keyed by `pkg.version`, so the version bump rotates the cache — nothing else to do.)
C. **Remove `frame-ancestors`** from the `<meta>` CSP (inert in meta by spec). Leave a one-line
   comment: needs an HTTP header, which Pages cannot set.

Verify: commit, then `node build.js` again → `git status` clean (a rebuild with no `src/` change
must produce no diff; any `src/` change legitimately rotates the CSP hash); `grep -c "res.ok" docs/sw.js` ≥ 2.
Changelog: "Offline copy can no longer get stuck on an error page."

---

## Phase 0.5 — Structural prep, zero behaviour change  (three commits: A/B/C → v0.22.2, D/E → v0.22.3, F/G → v0.22.4)

**Why:** two independent reviews found the same thing — the bugs in Phases 1, 3, 5, 7, 8 exist
because the same policy is re-implemented in several places (six ways to start a session, nine
hand-rolled "real history" filters, three week bucketers, two merge implementations). Fixing each
bug in place would add a seventh/tenth/fourth copy. This phase names the shared pieces first. All
91 tests must pass **unchanged** at the end of it — that is the proof it changed no behaviour.

### 0.5-A Test helpers (`test/load.js`)
- `NOW = new Date(2026,8,9,12,0,0).getTime()` (a Wednesday, local noon). `session()` defaults
  `opts.now` to `NOW`. Export `NOW`. (Root cause of the Thursday flake; Phase 2 tests need this.)
- `session(daysAgo, exs, {now, deload})` — `deload:true` sets `s.deload=true`.
- Exercise tuple accepts `[id, sets, {mode}]` → sets `mode` on the instance.
- `history(...sessions)` → sorted newest-first (engine scans `break` on order; three tests re-sort
  by hand today: plan.test:81, audit:42, reactions:25).
- `weekly(exs, weeks, {now, every=7, start=3})` → `weeks` sessions at `start, start+every, …`
  days ago; `exs` entries may be `[id, w=>sets]` functions of the week index.
- `deload.test.js`: replace its local `dl` with `session(..., {deload:true})`. Nothing else changes.

### 0.5-B Engine: one "real history" predicate (`progression.js`)
```js
// A session that counts for progression: completed and not a deload. Order is preserved (newest-first).
const real=sessions=>(sessions||[]).filter(s=>s.completed!==false&&!s.deload);
```
Export on `IL.prog`. Replace the inline predicate at: `exerciseSeries` (prog ~51),
`bestE1rmBefore` (~66), `findPlan` (builder 197–198), `exerciseTenure` (builder 214),
`progressionStat` (analysis ~43), `personalRecords` (analysis ~224). **Leave** `lastPerf` as it is
(its `opts.includeDeload` escape hatch at prog:38 is asserted in deload.test.js:25), and leave
`lastModeFor`, `lastSessionIds`, and `analysis.completed()` (they intentionally include deloads);
add a one-line comment to each saying so. Keep the `break`-on-order logic in `findPlan`/`exerciseTenure`.
Also: replace literal `86400000` in builder.js with `DAY`; delete the unused `isProgressing`; remove
the duplicate `nextSets` import. Do **not** remove the `seed` parameter from
`replacementFor`/`anchorVariation` yet — library.test.js:12,14 pass it positionally; it goes away in
Phase 4 when those signatures move to options objects.

### 0.5-C Library integrity test (`test/library.test.js`)
`exercises.js:170` falls back to `['overall','iso',3]` when META is missing — a new exercise with a
forgotten META entry silently becomes an untiered isolation move. Add assertions: every RAW id has a
META entry; every key in META, `LONG_LENGTH`, `UNILATERAL`, `BW_FACTOR` exists in RAW. (Verified:
there are no current violations — this test only guards the future.)

### 0.5-D UI: one way to start a session (`ui.js`)
Replace `startSession(exIds,msg,deload,volumeBump)` (ui.js:181) with
```js
// The ONLY way a workout begins. spec: {ids, deload, msg, volumeBump, source:'build'|'blank'|'repeat'|'routine'|'add'}
function startSession(spec){ ... newSession(spec.ids||[], !!spec.deload, spec.volumeBump) ... resetDraft(); todayScreen='active'; render(); if(spec.msg)toast(spec.msg); }
```
Route all six entry points through it: `buildAndStart` (211), `#btnBlank` (783), `[data-repeat]`
(785), `[data-routine]` (788), `[data-repeatfrom]` in the session sheet (689), and
`addExerciseToCur` (699, which today silently does `S.setActive(newSession([]))`). Keep each
call's current message and current deload behaviour **exactly** (Phase 3 changes behaviour; this
phase does not). D and E land in the same commit (the snippet calls `resetDraft()` from E).

### 0.5-E UI: one draft object
`let draft={groups:new Set(),deload:false}`; `resetDraft()` called only inside `startSession`.
Replace every `pickedGroups`/`deloadPicked` reference (ui.js 61–62, 141–142, 155, 197–200, 779–784).
Leave `calMonth/selDay/libQuery/libGroup` alone (per-tab memory, cheap). Extract the
`#buildBtns` re-render at line 780 into `refreshBuildBtns()`.

### 0.5-F UI: delegated view actions (incremental)
Add one root listener on `#view` and an `ACTIONS` table keyed by `data-action`. Migrate only the
view-level `bindClick` ids in `bind()` (≈ 771–783, 793–801) to `data-action="..."`. **Leave**
`bindLog` (already a delegation table) and sheet-scoped bindings untouched. Handle nested controls
(`[data-delroutine]` inside `[data-routine]`) by checking the inner action first. The `[data-sess]`
handler moves to the root listener — this is what makes the Home "Last session" card work (a bug
today; see Phase 8). Once the build buttons use `data-action`, the `bindBuild()` call after
`refreshBuildBtns()` is redundant — remove it.

### 0.5-G Store: name the adapter interface (comment only)
At the top of the cloud-adapter section in `store.js`, document the interface both adapters already
implement: `{name, init():Promise<bool>, pushSession, deleteSession, pushRoutine, deleteRoutine,
pushSettings, pushActive, flush, syncNow}` and the rule **"adapters move bytes; `absorbRemote` is
the only merge."** No code change here (Phase 7 enforces it).

Verify: 91 tests pass with zero assertion changes; in the browser, build / blank / repeat / routine /
history-sheet repeat / add-exercise all still start a session; chips and deload toggle still work.
Changelog: "No user-visible change — groundwork so the next fixes are small and safe."

---

## Phase 1 — Data integrity at Finish  (v0.23.0 · medium risk · ui.js)

**The most important fix.** Evidence: ui.js `cleanSets` (~717–719) keeps `st.done||+st.w` and stamps
every kept set `done:true`. Exercises with history are prefilled *with weights*, so ticking 3 bench
sets and pressing Finish saves **every untouched set of every exercise as completed**. Volume, PRs,
streaks and next-time progression are all polluted.

Rule: **only ticked sets count.** (ui.js cannot be loaded in node, so the pure parts move to the
engine where they can be tested — rule 1 applies.)
1. In `bindLog`'s input handler, when weight or reps is edited set `st.t=1` (touched, transient).
2. Add to progression.js and export: `finalizeSets(exercises)` → exercises with only `done` sets,
   `t` stripped, empty exercises dropped; and `parseWeightInput(str)` → the sanitised numeric string
   (`,`→`.`, then strip non `[0-9.]`). `cleanSets` becomes a one-line call to `finalizeSets`.
   Tests in progression.test.js: prefilled-but-unticked sets are dropped; `'12,5'` → `'12.5'`.
3. In the Finish handler, before `cleanSets`: if any set has `st.t && !st.done`, open a sheet via
   `openSheet` (the existing `showConfirm` is OK/Cancel only — do not extend it) with two buttons:
   **Save them as done** (sets `done:true` on touched sets, then finishes) / **Leave them out**
   (finishes as is). Closing the sheet cancels. Text: "*N* sets you edited aren't checked off."
4. Check `setsOf` and the Finish button's `disabled` state count only done sets (they use
   `isWorking`; if it counts un-ticked sets, pass a `done`-only filter — do not change `isWorking`
   itself, the engine uses it on saved data).
5. **Comma decimal** (same handler): `12,5` currently becomes `125`. Use `parseWeightInput` and
   write the cleaned value back into the input.
6. **Live-workout guard** — first line of `startSession(spec)`: if `state.active` has ≥1 done set and
   `spec.source!=='add'`, `showConfirm('Discard the workout in progress?', …)` before continuing.

Changelog must say: sessions logged before this version may contain sets you never did. They are
**not** auto-cleaned (a phantom looks identical to a real set); edit a session from History if a
number looks wrong.
Verify (browser, mobile preset): prefill bench 3 sets, tick 2, Finish → History shows 2 sets;
type `12,5` → shows `12.5`; with a workout in progress that has a done set, open a History session
sheet and tap Repeat → the discard confirm appears (the New-workout screen itself is hidden while a
workout is active, so the sheet is the reachable path).

---

## Phase 2 — Calendar weeks  (v0.24.0 · low risk · progression.js + analysis.js)

Evidence (reproduced): `calcStreak` (prog 201–202) buckets by `floor(startOfDay(ts)/7days)` — an
epoch week whose boundary falls between Wed and Thu local time. Sessions Tue 8 / Wed 9 / Thu 10 Sep
2026 → **"2wk streak"**. The same bucketer is `isoWeek()` (analysis 118, phrasing rotation) and a
third variant in `weeklyVolumes` (analysis ~236, Sunday start, drifts an hour across DST).

Fix — one function, three call sites:
```js
// progression.js — local calendar week index, Monday start, DST-safe (counts local days, not ms).
function weekIndex(ts){const d=new Date(ts),day=(d.getDay()+6)%7;           // Mon=0 … Sun=6
  const mon=new Date(d.getFullYear(),d.getMonth(),d.getDate()-day).getTime(); // local midnight Monday
  return Math.round(mon/(7*DAY));}
function weekStart(ts){...same Monday timestamp...}
```
- `calcStreak`: `weeks=new Set(done.map(s=>weekIndex(s.date)))`, `cur=weekIndex(now)`; rest as is.
- analysis: `isoWeek(now)` → `weekIndex(now)`; `weeklyVolumes` starts columns at `weekStart(now)`.
- Export both on `IL.prog`.

Tests (progression.test.js, using `NOW` from load.js): Tue–Thu same week → 1; Sun→Mon crossing → 2;
a week containing the DST change (e.g. Nov 1 2026) → one bucket; `weekIndex(Sun 23:59)` equals
`weekIndex(Mon 00:00 of that same week)` and differs from the next Monday.
Not changed: the Home "This wk" count (ui.js ~97) stays a rolling last-7-days number — say so in
the changelog so it isn't read as a contradiction of the streak.
Changelog: "Streak now counts real Monday-to-Sunday weeks (your 3 sessions this week = 1 week)."

---

## Phase 3 — Deload is an instruction to the builder  (v0.25.0 · medium risk · builder + ui)

Evidence: `buildAndStart` (ui.js ~196–212) calls `planWorkout(...,{fresh,hints})` — **the deload flag
never reaches the engine.** On a deload the builder still shows "Session N", runs the stall check,
and can rotate an accessory or swap the anchor (the swapped-in lift has no history → blank sets, not
light ones). Separately, **Repeat** and **Routine** ignore the toggle and start a normal session with
*progressed* loads — the most likely source of the owner's "deload prefilled progressive weights"
report. `seedExercise(...,deload=true)` itself is correct (verified: bench 140 → 80).

Principle: **a deload continues the plan verbatim, lighter, with zero structural changes.**

Engine (`builder.js`):
1. `planWorkout` honours `opts.deload`: set `hints=null` when deload (moves the rule out of ui.js:199);
   after `findPlan`, if deload → return `{ids: plan ids ordered, mode:'continue', plan,
   rotation:null, streak:0, reactions:[], volumeBump:[], deload:true}` — skip steps 1–4. Fresh build
   on a deload = `buildRecommendation(groups,sessions,seed,null)`, also returns `deload:true`.
2. Convert `seedExercise` to `seedExercise(id, sessions, {excludeId, unit, deload, extraSet})`
   (rule 5; 19 call sites: ui.js 180 and 702; tests: audit 3, reactions 3, deload 2, builder 6,
   progression 2, mode 1 — mechanical).
3. Deload seeding **caps sets at 3 per exercise** (a deload cuts volume as well as load). Existing
   deload tests use ≤3 sets; add one for 5→3.

UI (`ui.js`):
4. `buildAndStart` passes `deload:draft.deload` to `planWorkout`, then
   `startSession({ids:p.ids, deload:p.deload, volumeBump:p.volumeBump, msg, source:'build'})` —
   the deload flag comes from the engine result, not a UI capture. Remove ui.js:199's `dl?null:` —
   always pass hints; the engine decides.
5. `buildButtons()`: when `draft.deload`, primary reads "**Deload this plan** · N exercises from
   Tuesday" (no "Session N"); ghost reads "Build a fresh deload instead".
6. Repeat / Routine / history-sheet Repeat: `startSession({ids, deload:draft.deload, source, msg})`
   with a deload-aware message. (With 0.5-D this is a one-word change per call.)
7. `#deloadToggle` calls `refreshBuildBtns()` so the label in step 5 updates live.

Tests (deload.test.js, using `weekly`/`history`): stalled accessory + recent deload →
`planWorkout(...,{deload:true})` gives `rotation:null`, `reactions:[]`, `deload:true`; the same call
without `deload` still rotates (proves the flag is the cause); hints passed on a deload are ignored;
deload seed caps at 3 sets.
Changelog: "Deload now truly deloads from every button: same plan, lighter, capped at 3 sets, no swaps."

---

## Phase 4 — Stall detection stops calling progress a stall  (v0.26.0 · medium-high risk · builder.js)

Evidence (reproduced): `isStalled` (builder ~236) compares best e1RM of the last 14 days to the best
before. Double progression *drops reps to the bottom of the range after a weight bump*, and Epley
e1RM falls with it: 185×8 = 234 → 190×6 = 228 → **flagged stalled for 1–3 weeks after every
successful bump**, then rotated or anchor-swapped. Cousins: `recentPerfs` pulls the last 8
performances from *all time* (a returning lifter is judged against ancient heavier sessions);
`recentDeload` doesn't check *which muscles* were deloaded (a legs-only deload unlocks a bench swap).

Fix (keep the 2-week window design; add guards; options objects per rule 5):
1. `recentPerfs(sessions, exId, {n, mode, since})` records `{date, score, top}` (`top` = heaviest
   working weight that session); ignores performances older than `since`.
2. `exerciseTenure` also returns `oldest` (timestamp of the run's first session), and the run
   **also ends at a gap longer than `CONTINUE_DAYS`** between consecutive sessions of the group
   (today it only ends when a group session lacks the exercise, so a lifter returning after a month
   is judged against pre-break history).
3. `isStalled(sessions, exId, {mode, now})`: `t=exerciseTenure(...)`; return `false` if
   `t.weeks*7 < STALL_MIN_DAYS`; perfs = `recentPerfs(...,{n:8,mode,since:t.oldest})`; return
   `false` if `max(recent.top) > max(old.top)` (heavier weight is progress regardless of e1RM);
   otherwise the existing e1RM comparison.
4. `recentDeload(sessions, {now, days, exId})`: when `exId` given, the deload session must include
   that exercise. In `planWorkout`, remove the outer gate at builder ~291 and call
   `recentDeload(sessions,{now:opts.now, exId:aid})` inside the `for(const aid of anchors)` loop.
5. Add `let structural=false` set by steps 1–3 of the reaction pipeline and checked by each, replacing
   the `!rotation` gates — so a future structural reaction cannot accidentally stack.

Tests (audit.test.js, new block "PROGRESS IS NOT A STALL", written with `weekly`):
185×8 → 190×6 → 190×7 over 3 weeks → not stalled; genuinely flat 3 weeks → stalled (FREQUENCY
FAIRNESS stays green); 8 weeks of 225, then a 5-week gap, then a 2-week run at 185 → not stalled
(the gap ends the tenure run); legs-only deload → no bench anchor swap, bench deload → swap
allowed; CHURN / HOLD WHAT WORKS unchanged.
**Known conflict to resolve, not paper over:** plan.test.js:98 asserts `isStalled` is true for a
crossover whose tenure run is only 2 sessions / 1 week (a bench-only session at day 21 breaks the
run). Under the new tenure guard it is correctly `false`. Rewrite that fixture so the crossover run
is unbroken (add crossover to the day-21 session) and explain in the commit body.
Changelog: "The builder no longer swaps out a lift right after you added weight to it."
Long-term effect: fewer rotations, more continuity — the stated design goal.

---

## Phase 5 — Precise plan matching + muscle-group presets  (v0.27.0 · medium risk)

### 5a. findPlan precision (engine fix, prerequisite)
Evidence (reproduced): `findPlan(['Chest'])` continues a 5-exercise push day because the "one add-on"
tolerance (builder ~202) is *per non-picked group*. Fix: sum add-ons **across** non-picked groups;
reject if the sum > 1. If a plan.test.js case relied on the loose rule, it was wrong — rewrite it to
the precise rule and say so in the commit.
Ramification (changelog): picking *Chest* alone after a *Push* day now builds a chest session instead
of continuing the push plan; pick Push (5b) or the same groups to continue.

### 5b. Presets — data only, zero new engine branches
A preset is **a named list of groups** in `exercises.js`; tapping it selects those chips so the user
sees the expansion and can adjust. The engine still receives a plain `groups[]`, so `planWorkout`,
`findPlan`, continuity, rotation and Coach nudges work unchanged. Verified with the current engine:
each preset below builds 7 exercises, covers every group, keeps the 2-heavy-barbell cap, and
`findPlan` continues a preset plan only when the same groups are picked again.
```js
// exercises.js — first group leads (perfPriority focus). Export on IL.data.
const PRESETS=[
 {label:'Full body',groups:['Quads','Chest','Back','Hamstrings','Shoulders']},
 {label:'Upper',    groups:['Chest','Back','Shoulders','Biceps','Triceps']},
 {label:'Lower',    groups:['Quads','Hamstrings','Glutes','Calves']},
 {label:'Push',     groups:['Chest','Shoulders','Triceps']},
 {label:'Pull',     groups:['Back','Biceps']},   // no Forearms: a typical pull day (and the demo seed) has none, and findPlan needs every picked group present to continue
 {label:'Arms',     groups:['Biceps','Triceps','Forearms']}
];
```
UI: a "Quick picks" chip row above "Target muscle groups", `data-action="preset"`. Tap →
`draft.groups=new Set(preset.groups)` (replace, not add — order sets the lead), re-render chips +
`refreshBuildBtns()`; the preset chip shows `on` while `draft.groups` equals its set; tapping again
clears. Manual chips still work on top.
Engine guard (one line): `buildRecommendation` must cap at `MAX_SESSION_EX` — today 11 picked groups
→ 11 exercises. After `orderByFatigue(capHeavyAxial(out),groups[0])`, `.slice(0,MAX_SESSION_EX)`
(drops lowest-priority isolation first — document it).

Tests (builder.test.js): for each preset — `≤MAX_SESSION_EX`, every group covered, heavy-axial ≤2,
`findPlan(preset.groups)` continues a logged preset session, `findPlan(['Chest'])` does not; all
11 groups → exactly 7.
Changelog: "One-tap Full body / Upper / Lower / Push / Pull / Arms — you can still fine-tune."
Long-term: adding a preset is one data line. If a preset ever needs different *behaviour* (e.g.
full-body set counts), that is a per-group setting on the preset object, not a new code path.

---

## Phase 6 — Coach honesty + engine nits  (v0.28.0 · low-medium risk · analysis / builder / data / sync)

1. **`withStatus` false "resolved" credit** (analysis ~105): a finding that disappears because the
   muscle was *dropped* or data fell below `readyForComparative` reads as fixed ("Rear delts —
   sorted"). Fix: `resolved` only if the current window could still raise it — comparative types
   (`balance`, `legs-low`, `volume-low`, `freq-low`) need `cur.readyForComparative`;
   `region-gap`/`pattern-gap` need `cur.groupSets[group] > 0`; never resolve a prior `lv:'good'` or a
   `progression` finding. `withStatus` today keeps only the findings — keep `curA=analyze(sessions,now)`
   and pass it to the resolve predicate. Test: drop shoulders entirely → no resolved credit.
2. **Finding registry (growth pre-emption, cheap):** one table
   `FINDING_TYPES=[{type:'balance',resolvable:true}, …]` in priority order driving both `buildTips`'s
   ordering and the `RESOLVABLE` set. `renderFinding`'s switch stays (templates are content).
   Adding a finding type then touches `findings()`, `findingKey`, `renderFinding`, and one table row.
3. `complementSuggestions`: `.filter(x=>x.sc>0&&x.why)` (blank reason line).
4. `cleanSet` (sync.js): `done: st.done!==false` (missing means done, matching the engine).
5. `cleanExercise` (sync.js): drop `mode` unless `MODES[mode]` exists (invalid import white-screens
   Progress via `MODES[p.mode].label`). sync.js has no `IL.data` dependency today — add at its top
   `if(typeof require==='function'&&!IL.data)require('../data/exercises.js'); const {MODES}=IL.data;`
   (build.js and test/load.js both load exercises first).
(An earlier draft listed "add `Biceps.brachialis` to `regLabel`" — it already exists at
exercises.js:224; nothing to do.)
Tests in findings.test.js / sync.test.js.

---

## Phase 7 — Sync integrity  (v0.29.0 · **highest risk** · store.js + sync.js)

Slowly. Pure logic gets tests in sync.test.js; each step gets a two-tab manual check on the demo
artifact and, if Dropbox is connected, on the site.
1. **One merge.** Route the artifact adapter's `onSnapshot` handlers (store.js 132–146) through
   `absorbRemote({sessions:remote, routines:[...], deleted:{}, settings:null, active:null},
   {skipActive:true})` instead of their private merge. Then read/write a `deleted/` doc so
   tombstones propagate (today: deletions never reach the artifact backend). Clear `cloudError` on
   any successful push. **This step is why 0.5-G exists: adapters move bytes; absorbRemote merges.**
2. **Stale active resurrection** (`absorbRemote` 103–106 only, so both backends inherit it):
   finishing a workout sets `active=null` with no timestamp, so another device's stale `active` wins
   and "Resume your workout" returns. Persist `activeClearedAt` (set when active is cleared, pushed
   in the payload / the `{empty:true}` doc); an `active` older than the other side's
   `activeClearedAt` loses.
3. **Dropbox dirty-set race** (store.js ~186): `state.dirty.clear()` after `await upload` wipes ids
   added mid-upload. Snapshot `[...dirty]` before upload, delete only those after; if `syncNow` is
   called while syncing, set `pending=true` and re-run once; 30 s timeout resets `syncing`.
4. **Import unit**: `importBackup` passes `settings:null`; if the backup's unit differs from the
   install's, `convertSessions` before merge.
Tests: active/activeClearedAt rule, tombstone round-trip, dirty snapshot (extract the pure part into
sync.js). Manual: two tabs, finish on one, no Resume on the other; delete on one, gone on the other.

---

## Phase 8 — Robustness + polish  (v0.30.0 · low risk · ui.js + build.js + styles.css)

1. Unknown exercise ids (retired id in a routine/import) must not crash Auto-order
   (`reorderCur` → `orderByFatigue`) or the name tap: filter `EX[id]` first.
2. Home "Last session" card — **already fixed by 0.5-F**; verify and mark resolved.
3. "Update ready" toast only when the waiting SW's version differs from the running one
   (postMessage the version); `reg.update()` on `visibilitychange` → visible.
4. `theme-color`: two `<meta>` tags scoped by `prefers-color-scheme`.
5. Set-row weight input: steppers 30 px / input font 16 px so "102.5" fits at 375 px (verify with the
   mobile preset).
6. Rest bar stops on finish/discard; `+15s` works during "Go!"; Library search debounce (optional).

---

## Deferred — Roadmap v6 candidates (do NOT do now; each has a trigger)

| Item | Trigger to do it |
|---|---|
| Split `ui.js` into `ui-core / ui-today / ui-tabs / ui-settings` (build.js `MODULES` already supports it; shared helpers go on `IL.ui`; viewport code moves verbatim) | The next new screen, or ui.js > 1000 lines |
| Exercise metadata: fold META into each RAW row (one object per exercise; output shape unchanged) | The next batch of ≥5 exercises |
| Reaction pipeline as an ordered rule array | A third structural reaction |
| Finding-type registry (one ordered table driving buildTips order + RESOLVABLE) — deferred from Phase 6 to avoid churning tested buildTips output | The next new finding type |
| Route the artifact adapter's `onSnapshot` through `absorbRemote` + a `deleted/` tombstone doc (Phase 7 item 1) — deferred: needs two-device manual testing that isn't possible in this environment, and the current inline merge works for the single-user artifact. The active-resurrection fix already reaches the artifact via `init`/`pushActive`. | A real two-device artifact test, or a reported artifact deletion-sync issue |
| Dropbox conditional upload (`update: rev`) instead of last-writer-wins | Two devices editing the same day regularly |
| `platform.saveFile()` behind export (artifact downloads vs native share) | App Store / WKWebView wrapper |
| Second profile (store.js key namespacing; engine is already profile-agnostic) | When asked |

---

## Dependency map

| Phase | Depends on | Why here |
|---|---|---|
| 0 build | — | Isolated; SW fix is a real offline-corruption vector |
| 0.5 prep | 0 | Names the shared pieces every fix below uses; provably no behaviour change |
| 1 cleanSets | 0.5-D (guard lives in `startSession`) | Everything downstream reads history; clean data first |
| 2 weeks | 0.5-A (`NOW`) | Streak UI, deload-due finding, phrasing rotation |
| 3 deload | 0.5-D/E, 2 | Skips Phase 4 logic on deloads; fixes Repeat/Routine |
| 4 stall | 0.5-A/B, 3 | Audit tests are the guardrail |
| 5a/5b | 0.5-E/F | Presets are data; cap is one line |
| 6 coach | 2 | Coach wording only |
| 7 sync | 0.5-G, 1 | Highest data risk, isolated, last of the logic phases |
| 8 polish | 0.5-F | None |

## Definition of done
- `node --test test/*.test.js` green with ≥ 91 + new tests; run once more on a different weekday.
- Owner-verified on the phone: (1) finish with 2 of 3 sets ticked → History shows 2; (2) Tue–Thu →
  "1wk"; (3) deload from Continue, Repeat and a Routine → lighter loads, ≤3 sets, no "Session N",
  no swap; (4) Full body preset → 7 exercises; Full body again next day → "Continue your plan";
  (5) finish on one device → no "Resume" on the other.
- Memory `roadmap-v2-status.md` updated with v5 status; changelog readable by a non-coder.
