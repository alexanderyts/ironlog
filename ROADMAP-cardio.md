# Ironlog — Cardio logging (Roadmap)

> **STATUS: shipped in v0.47.0 (2026-09-14).** All phases C1–C5 done in one pass: data model + isolation
> guards (C1), live + manual logging (C2), History/calendar/counts (C3), Progress cardio summary (C4),
> edit/delete + import round-trip + review (C5). 204 tests (test/cardio.test.js + test/cardio-ui.test.js);
> lifting review snapshot unchanged. Intensity = Easy/Moderate/Hard; type = flat 5; distance optional (mi/km).


A new **session kind**. Cardio is NOT an exercise — it is its own record type that never touches the
strength math (volume, PRs, coach, builder, progression, stall detection), the same guarantee a
deload has. This is the whole safety story; everything below serves it.

## Locked decisions (from user, 2026-09-14)
- **Intensity:** three levels — Easy / Moderate / Hard. (No verbs like walk/run/sprint; no RPE.)
- **Type:** one flat picker — Treadmill · Elliptical · StairMaster · Outdoor · Indoor.
- **Stats:** cardio COUNTS toward "This week" and the streak, and gets its own cardio summary; it NEVER
  enters volume, PRs, the coach's analysis, the builder, or progression.
- **Distance:** optional field; unit follows the weight setting (lb→mi, kg→km), stored with the record.
- **Both logging modes:** a live "Start cardio" (timer, Finish stamps the end) AND manual entry
  (type + intensity + minutes + optional distance + optional back-date), sharing one record shape.
- Standing principle: the app remembers and suggests, never drives. Keep it fast to log. Deterministic.

## Record shape
```js
{
  id, schema:1, date,            // date = start time
  updatedAt, completed:true,     // completed:false only while live/active
  kind:'cardio',                 // the positive marker
  exercises:[],                  // ALWAYS empty — every strength filter (s.exercises.length /
                                 //   .some / .forEach) drops it automatically, and nothing crashes
  cardio:{
    type:'treadmill'|'elliptical'|'stairmaster'|'outdoor'|'indoor',
    intensity:'easy'|'moderate'|'hard',
    distance: <number>0> | undefined,   // optional
    unit:'mi'|'km' | undefined          // snapshot at log time (so a later lb↔kg switch can't reinterpret)
  },
  endedAt,                       // end time; duration = endedAt - date (capped by MAX_SESSION_MIN)
  endEstimated?                  // true if the end time was an estimate the user accepted
}
```
Duration is uniform with strength (`sessionDuration`) so the forgotten-Finish cap (the 50-hour bug fix)
applies here too. Manual entry computes `endedAt = date + minutes*60000`.

## Isolation strategy (why nothing leaks)
`exercises:[]` alone already excludes cardio from every strength consumer, because each one gates on
`s.exercises.length` / `.some` / `.forEach`:
- `completedSessions()` (ui-core.js:35) · `completed()` (analysis.js:10) · builder `completed` (builder.js:264)
- `weeklyVolumes` / `personalRecords` / `muscleSetCounts` / `timeTrends` / `deloadStats` (analysis.js)
- `calcStreak` (progression.js:308) · `isStalled` / `findPlan` / `planWorkout` (builder.js)

Belt-and-suspenders: add `&& s.kind!=='cardio'` to the four core filters — `completed()` (analysis),
`real()` (progression.js:74), builder `completed` (builder.js:264), and the strength side of anything
new. The **review snapshot** (`test/review-snapshot.test.js`) is the guardrail: after every phase the
owner strength output must be byte-identical — if cardio ever moves it, something leaked.

The ONE deliberate inclusion: **`calcStreak` counts cardio.** Change its filter to
`s.completed!==false && (s.exercises.length || s.kind==='cardio')`, and the UI passes it the combined
activity set.

## New UI-scope helpers (ui-core.js, next to completedSessions)
```js
const completedCardio =()=>state.sessions.filter(s=>s.completed!==false&&s.kind==='cardio');
const completedAny    =()=>state.sessions.filter(s=>s.completed!==false&&(s.exercises.length||s.kind==='cardio'));
```
- Strength views keep `completedSessions()` (unchanged).
- "This week" count + streak use `completedAny()`.
- History + calendar use `completedAny()`.
- Cardio summary uses `completedCardio()`.
- Week **volume** stays on the strength `wk` set.

---

## Phases

### C1 — Data model, sanitizer, isolation guards (engine/store/sync)
Files: `src/engine/sync.js`, `src/engine/progression.js`, `src/engine/analysis.js`, `src/engine/builder.js`, `src/app/store.js`, `src/app/ui-core.js`.
- sync.js: `CARDIO_ENUM={type:[5], intensity:[easy,moderate,hard]}`; `cleanCardio(c)` (whitelist type/intensity,
  clamp `distance` 0–1000, `unit`∈{mi,kg... 'mi','km'}); extend `cleanSession` so a `kind==='cardio'` record
  keeps `kind`, `cardio` (via cleanCardio), forces `exercises:[]`, keeps endedAt/endEstimated. Non-cardio
  sessions unchanged. Export `CARDIO_ENUM`, `cleanCardio`.
- progression.js: `sessionDuration` handles a cardio record (endedAt − date, MAX_SESSION_MIN cap); `real()`
  gets `&& s.kind!=='cardio'`; `calcStreak` filter → `(s.exercises.length||s.kind==='cardio')`.
- analysis.js `completed()` + builder.js `completed` get `&& s.kind!=='cardio'`.
- ui-core.js: add `completedCardio` / `completedAny`.
- **Tests (test/cardio.test.js, new):**
  - ORACLE: `cleanSession` round-trips a full cardio record (type/intensity/distance/unit/endedAt) and
    strips a bad type/intensity; forces exercises:[]. CONTROL: a strength session is unchanged by cleanSession.
  - ORACLE: with one strength + one cardio session, `sessionVolume`/`weeklyVolumes`/`personalRecords`/
    `analyze` return exactly what they return for the strength session ALONE (cardio invisible). CONTROL:
    the same without the cardio session — identical.
  - ORACLE: `calcStreak` counts a week that has ONLY a cardio session. CONTROL: an empty week doesn't count.
  - Snapshot unchanged.

### C2 — Logging flow (Home entry + live timer + manual entry)
Files: `src/app/ui-today.js`, `src/app/ui-bind.js`, `src/app/store.js`, `src/styles.css`.
- Home (`homeView`): a second action under "Start a workout" — **"Log cardio"** (or a compact card).
  Keep the lift flow primary and unchanged.
- Routing (`viewToday`): before the strength `editorView` line, add
  `if(todayScreen==='active'&&state.active&&state.active.kind==='cardio')return cardioLiveView(state.active);`
- `cardioLiveView(s)`: big running clock (reuse the `#elapsedLbl` self-rescheduling timer), the type row
  (5 chips), the intensity row (3 chips), optional distance input, a note, and **Finish**. Finish →
  `endedAt=now`, `upsertSession`, clear active. Reuse the forgotten-Finish sheet (staleness ≥ threshold →
  offer estimated end / cap), and the storage-full guard from `commitFinish`.
- Manual/quick entry (a sheet from Home): type + intensity + **minutes** stepper + optional distance +
  optional date (default now) → builds a completed cardio record directly (`endedAt=date+min*60000`), no
  active. Also the path to log a session you did earlier (back-date).
- `state.active` holds at most one thing: if a lift is active, the cardio entry says so and offers to log
  it as a past session instead (no dual-active).
- **Tests (ui-harness):**
  - ORACLE: Start cardio → (advance clock via injected endedAt) → Finish saves a cardio record with the
    picked type/intensity and the right duration; state.active cleared. CONTROL: it does NOT appear in
    the strength volume/PR/coach output on Progress.
  - ORACLE: manual entry of 30 min treadmill/easy/1.5mi saves `endedAt-date==30min`, distance 1.5, unit mi.
  - ORACLE: a cardio "started" 10h ago hits the MAX_SESSION_MIN path (no 50-hour record).

### C3 — History, calendar, session detail + the "counts" wiring
Files: `src/app/ui-views.js`, `src/app/ui-today.js`.
- `viewHistory`/`calendar`/`sessionList` use `completedAny()` so cardio days show a dot and cardio cards list.
- `sessCard(s)`: if `s.kind==='cardio'`, render a cardio card — icon + "Treadmill · Easy · 32 min · 1.6 mi"
  — instead of exercises/volume/sets. Strength card unchanged.
- Session detail sheet (openSessionDetail): a cardio branch (type/intensity/duration/distance/note, edit + delete).
- Home "This wk" (ui-today.js:26) and Progress "This week" (ui-views.js:72) counts use `completedAny()`;
  streak uses `calcStreak(completedAny(),now)`. **Week volume stays on the strength `wk` set.**
- **Tests (ui-harness):**
  - ORACLE: with 2 lifts + 1 cardio this week, "This week" shows 3; Week volume equals the two lifts only.
  - ORACLE: History renders a cardio card with the right summary line; the calendar marks the cardio day.
  - CONTROL: the strength volume chart, PRs and coach on Progress are unchanged by the cardio session.

### C4 — Cardio summary on Progress
Files: `src/app/ui-views.js`, `src/engine/analysis.js`.
- `analysis.cardioStats(sessions, now)` (reads ONLY `kind==='cardio'`): this-week count + total minutes,
  4-week minutes trend, breakdown by type. Pure, deterministic.
- A **Cardio** card on Progress (collapsible, same pattern as Coach/Recovery/Time), placed after the
  strength blocks. Shows this-week cardio time + a small by-type or weekly-minutes view.
- **Tests:** ORACLE hand-computed weekly minutes/among types; CONTROL: no cardio → card absent, strength
  Progress unchanged (snapshot).

### C5 — Adversarial pass + edit/delete + export/import + ship
- Edit a saved cardio session (change type/intensity/duration/distance) with the storage-full guard.
- Delete → tombstone (rides existing `deleted`/sync).
- Export/import round-trips cardio (parseImport already runs every session through cleanSession — verify).
- 3-lane review of the diff (UI, engine/data, isolation). Run the suite 3–5× for flakes.
- **Cross-version note:** an OLDER app version's `cleanSession` would strip `kind`/`cardio` → a blank
  session. The v0.45.3 `blockedVer` latch already stops an older app from overwriting a newer file, so a
  cardio record made on the updated app can't be clobbered by a lagging device. Single-user PWA → low
  risk; note in the changelog.

## Ship checklist (each phase)
version bump · `node build.js` · `node --test test/*.test.js` green (snapshot unchanged unless a cardio
card is deliberately new) · plain-language changelog with "Not verified on-device" · commit (Co-Authored-By
Claude Opus 4.8) · push origin main · republish BOTH artifacts with `url` · update memory.

## Testing standard (unchanged mandate)
Every behavioural test needs an ORACLE (hand-computed expected value) + a CONTROL; no completion-only
tests; for anything the user SEES, assert at the row/screen level, not just the helper. The review
snapshot must stay byte-identical for all strength output.
