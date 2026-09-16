# Roadmap — PR adjust, stopwatch, Progress tab (post v0.48.2)

Four requests from the 2026-09-15 review. Shipped in three versions, smallest-blast-radius first.
Locked constraints unchanged: no AI, deload never feeds progression/PRs/builder, app never auto-ends a
workout, the v0.8.6 tab-bar/safe-area layout is NOT reopened.

---

## v0.49.0 — "Doesn't count as a record" + the sheet/keyboard fix

### A. PR adjust

**Data.** One new per-set boolean, `nc` ("not counted"), written only when true — the exact shape of
the existing `warm` flag. Must be added to `cleanSet` in `src/engine/sync.js:82` or it is silently
dropped on export→import and Dropbox round-trips.

**What it changes (and what it deliberately does not):**

| Consumer | Behaviour |
|---|---|
| `analysis.personalRecords` | skips `nc` sets; PR falls back to the previous best |
| `progression.bestE1rmBefore` | skips `nc` sets → kills the live "★ New PR" line and the finish-summary PR for that set |
| `progression.lastPerf` (new `opts.clean`) | skips `nc` sets. **Passed by BOTH `suggestion()` and `builder.seedExercise`** — filtering only in `suggestion()` leaves the builder prefilling the marked weight, which was the original plan's biggest hole |
| `progression.sessionVolume` | **unchanged** — the weight was moved, it counts |
| `progression.isWorking` | **MUST NOT be touched.** It is the shared predicate behind volume, sets-per-muscle and rest stats; hooking `nc` there would silently delete the set from all of them (that is what `warm` does, and it is NOT what this flag means) |
| `progression.exerciseSeries` | point is **kept** and flagged, never dropped — removing it would erase the history the user explicitly asked to keep |
| history / timeline / rest stats | **unchanged** — nothing is hidden or deleted |

**Fallback chain for the anchor** (no dead ends): last session's clean sets → if every working set
that day is marked, the session before → if nothing clean in history, today's behaviour verbatim.

**Verified against the 2026-09-16 backup.** Barbell row Sep 15 = 75×12 / 90×12 / 110×10 (top set is
the PR). Marking 110×10 reverts the PR to 100×10 (Sep 8) and moves the anchor to 90×12 → next
suggestion ~95, not 115. Real data, real numbers.

**The "PR adjusted" marker.** `personalRecords` returns an extra `adjusted:{w,r,date}` — the best
excluded set that would otherwise have won — so the PR row can print a quiet second line
("adjusted · 120 lb × 10 on Sep 14 didn't count"). That is both the marker and the receipt that the
lift happened. Same mark on the exercise trend point, so the dip afterwards reads as deliberate.

**Entry points.** (1) Finish summary, on the PR row, at the moment it's announced. (2) Retroactively
from the exercise detail sheet — already what a PR row opens, so no new navigation. Unmarking is in
the same place. In-workout marking is deliberately NOT added in v1: the set-number button already
means warm-up and a third meaning on one tap is a trap.

**Known bug fixed in passing.** The live "★ New PR" line (`ui-today.js:345`) and its byte-identical
twin in the finish summary (`ui-bind.js:47`) ignore `INVERTED_LOAD` and `TIME_METRIC`, so an assisted
lift or a plank can flash a bogus e1RM PR. The Progress PR list is already correct. Since both call
sites are being touched for `nc`, gate them at the same time.

### B. The disappearing sheet

`.sheet` is `position:fixed`, i.e. anchored to the LAYOUT viewport. iOS does not shrink the layout
viewport for the keyboard — it scrolls the visual viewport over it. So opening a sheet while an input
still holds focus renders it below the visible area ("nothing happened"), above the band the keyboard
occupies. Fix in `openSheet` (`ui-core.js:56`): blur the active element and return the view to the
top before showing. Touches nothing structural — no `.tabbar`, no `--deficit`, no `--screen-h`.

---

## v0.50.0 — Stopwatch

Reuses the rest-timer chassis (fixed bottom bar, tick loop, `beep()`, unlocked audio context).

**Collision (found in adversarial review).** `.restbar` is `position:fixed` at
`bottom:calc(74px + var(--safe-b) - var(--deficit))`. A stopwatch bar in the same slot draws on top of
it. They are mutually exclusive: starting the stopwatch calls `stopRest()`, and `startRest()` clears a
running stopwatch. Also note this user has `rest.auto:false` — the stopwatch must not read or depend on
any `settings.rest` field except `sound` for its finish tone.

**Edge case.** ⏱ on an exercise whose sets are all ticked appends a new set rather than silently
doing nothing.

- **⏱ button in the exercise card's action row** (`＋ Add set` / `Note` / `Watch demo`). NOT in the set
  row — `grid-template-columns:30px 1fr 1fr 40px` has no room on a phone.
- 5-4-3-2-1 to get set → counts up → **Stop** writes the elapsed seconds into the next unticked set
  and ticks it. Driven by `Date.now()` deltas, so locking the phone mid-hold is safe (same approach
  as the cardio clock).
- Shown only on `TIME_METRIC` lifts, where the set column already reads **Sec**. **No schema change.**
- Library additions (data only, with `META` entries — `test/library.test.js` enforces): `dead-hang`,
  `wall-sit`, `side-plank`, `hollow-hold`, `suitcase-carry` — added to `TIME_METRIC`.

**RULE, learned the hard way from the 2026-09-16 backup: only ADD new ids to `TIME_METRIC`, never
convert an existing one.** v0.48.0 converted `farmers-carry`, which retroactively reinterpreted this
user's logged laps (45 lb × 3 laps) as "3 seconds" and dropped ~335 lb from that session's volume.
Converting an exercise silently rewrites its own history. New ids have no history, so they are safe.
- Timer state is in-memory and session-scoped, like the rest timer. Not persisted.

**Accepted trade-off:** `TIME_METRIC` lifts contribute zero to weekly volume by design (there is no
honest weight×reps for a 45-second plank). More timed lifts = more work outside the volume bar. Flagged,
not solved, in this version. Per-set seconds on normal weighted lifts is explicitly out of scope.

---

## v0.51.0 — Progress tab

1. **Deload tense bug.** `analysis.js:207` decides "this week" with `f.days<=7` — a ROLLING seven days,
   while the whole app has used Monday-start weeks since v0.46.0. A deload last Wednesday read on
   Monday is 5 days old and still prints "this week", while the Recovery card below it correctly says
   "6d ago" — two answers to one fact on one screen. Switch to `weekIndex` and widen the vocabulary to
   **this week / last week / N days ago**, keeping 4 variants per tense.
2. **"30-day sessions" tile.** Reads as "nine 30-day sessions". It is the only tile with no unit, and
   it counts cardio while "Sets by muscle · last 30 days" below it does not. Replace it.
3. **Tile redundancy.** This week / 30-day sessions / Current streak are three angles on *did you show
   up*; only Week volume says anything else. Give the surviving tiles a **comparison** ("3 sessions,
   +1 vs last week") — that is the actual fix for "feels static", and it is smaller than a redesign.
   The comparison renders nothing when there is no prior week, so a new user never sees "+3 vs 0".
4. **Cardio consistency.** One rule for whether a number includes cardio, applied to every tile, and
   stated in the tile.
5. **Scaling rule.** A card earns its place by having something to say this week, else it stays
   collapsed. The Push/Pull comparison already does this via `readyForComparative`; generalise it.
   That, not shorter sentences, is what stops the tab bloating as history grows.

Layout and card order are NOT reworked — the user likes the shape.
