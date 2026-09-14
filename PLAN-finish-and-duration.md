# Plan — the 50-hour workout, and a Finish you can find

Written for Opus 4.8 to execute (or review). Plain language first, then the exact changes.

## What happened

A workout was started **before v0.35** (when Ironlog began stamping the time on each checked set).
It sat open for two days. When it was finally finished, Ironlog recorded it as **50 hours long**.

Two things went wrong:

1. **The forgotten-Finish safeguard (v0.36) has a hole.** At Finish, if your last set was a while
   ago, Ironlog offers "end at my last set instead of now". But it only makes that offer when a set
   *has* a timestamp. A pre-timestamp workout has none, so it silently falls through to
   `endedAt = now` — the exact case the safeguard exists for. (`chooseEndThenCommit`, ui-bind.js.)
2. **Nothing sanity-checks a duration on the way out.** `sessionDuration()` will happily report
   3,000 minutes. That number then shows on the History card **and feeds the Time analytics
   averages** (analysis.js `timeTrends` filters only on `!= null`), so one forgotten workout skews
   "average session length" for a month.

And the reason it sat open: **the Finish button is the last thing on the editor**, below every
exercise, the suggestion card and "Add exercise". On a real workout that's a full screen of
scrolling, and the fixed tab bar sits exactly where a lifter expects an action bar to be.

## Decisions

- **Never end a workout automatically.** Locked in T2; still true. The app notices and asks.
- **A duration above 8 hours is not a workout — it's a forgotten Finish.** Treat it as unknown
  (null) rather than display or average it. 8h is generous (longest plausible gym day) and cheap:
  one constant, one comparison, and it retroactively fixes the already-saved 50h record everywhere
  it's read, with no data migration.
- **No changes to the tab bar or safe-area layout.** That model is settled (v0.8.6 invariant) and
  the fix doesn't need it: put Finish where the eye already goes — the top bar — and keep the
  bottom button too.

## Changes

### A. `progression.js` — cap nonsense durations (engine)
- `MAX_SESSION_MIN = 8*60`. `sessionDuration(s)` returns `null` when the span exceeds it.
- Export the constant. Comment says why (forgotten Finish, not a real length).
- Covers History card, session summary, `sessionDensity`, `timeTrends` — all read through it.

### B. `ui-bind.js` — the Finish flow offers an honest end time for untimed sessions
`chooseEndThenCommit(s)`:
- Existing branch (has `lastSetAt`, idle ≥ 30 min): unchanged.
- **New branch:** no set timestamps and `sinceStart ≥ STALE_CONFIRM_MIN` → sheet "When did you
  finish?" with three choices:
  - **End now** (as today)
  - **About an hour after I started** → `endedAt = date + 60min`, flagged `endEstimated` (shows ≈)
  - **Don't record a length** → no `endedAt` at all (duration shows nothing; analytics skip it)
- `commitFinish(s, endedAt, estimated)`: when `endedAt` is null/undefined, `delete s.endedAt`.

### C. `ui-today.js` / `ui-bind.js` — Finish in the top bar
- `editorView` (live mode only): the top bar's right side gets `<button class="btn good sm"
  id="btnFinishTop">Finish</button>` beside Discard; disabled when no set is checked (same rule as
  the bottom button).
- Bind `#btnFinishTop` → `finishWorkout` next to the existing `#btnFinish` binding.
- Bottom "Finish & save workout" stays — two routes, one function.

### D. Tests (oracle + control, never completion-only)
- `progression.test.js`: 7h59 → 479; 8h01 → null; 50h → null; normal 52 min unchanged (control).
- `analysis.test.js`: `timeTrends` with a 40-min and a 50-h session → average is 40, not 1520.
- `ui.test.js`:
  - pre-timestamp session (date = now−50h, sets `done` but no `at`) → Finish → the sheet offers
    "Don't record a length" → saved session has **no** `endedAt`; `sessionDuration` is null.
    Control: a fresh session with a stamped set still records `endedAt ≈ now`.
  - the live editor renders `#btnFinishTop`; disabled at 0 sets, enabled after one, and clicking it
    finishes (`state.active` becomes null, a session is saved).

### E. Ship
- v0.40.1 · changelog in plain language with a "Not verified on-device" line · commit · push ·
  republish both artifacts with `url` · memory note.

## Not doing (and why)
- A sticky bottom action bar above the tab bar: touches the safe-area invariant for a gain the top
  bar button already delivers.
- Migrating/rewriting the saved 50h session: the cap makes it read as "no length" everywhere;
  editing history to invent a length would be guessing.
- Auto-finishing after N hours: the app must never decide a workout is over.
