# Ironlog — adversarial review at v0.41.0 (2026-09-13)

Four independent review lanes (engine over long horizons · data/storage/sync · UI/usability ·
product/engagement) plus the lead's own scale probe through the real bundle. **Every finding marked ✓
was re-run by the lead with a hand-computed expectation before it made this list.** Nothing here is
"it might". Severity is about the user over years, not code aesthetics.

The verdict up front: the foundation is honest and fast — the things most trackers get wrong
(unchecked sets never save, deloads never feed progression, PRs per equipment, no template to
maintain) are right here, and nothing is O(n²) over sessions. The problems cluster in four places:
(1) two silent data-loss paths in sync/storage, (2) the plan forgets itself on any 10-day gap, (3)
the coach and builder ignore the profile in a few side paths and never learn when they're ignored,
(4) between-set friction and legibility on the live screen. All are fixable in small, testable steps.

## Ranked findings

Effort: S = under an hour, M = a session, L = a phase. Lane: E engine · D data · U ui · P product.

### Critical — silent loss or a wrong decision the app keeps repeating

| # | Finding | Where | Fix | Effort |
|---|---|---|---|---|
| 1 ✓ | **Storage full = the workout you just finished is gone, with "Workout complete 💪" on screen.** `lsSet` swallows QuotaExceededError; `il_sessions` fails, `il_active` (small) succeeds and clears. Reload: nothing. Projected at ~year 5–7 on iOS (5 MB, UTF-16 accounted). | D · store.js:11,53 | `lsSet` returns false; on failure keep `state.active`, persistent toast "Storage full — export a backup", flip the cloud badge. | M |
| 2 ✓ | **Dropbox never uploads a change that doesn't dirty a session.** `pushNeeded = dirty.size>0` and only sessions are dirty. Profile/theme/routine changes and *deletions* reach the other phone only after the next finished workout; the in-progress `active` never reaches the file. | D · store.js:199-206 | A persisted `pushPending` flag set by every non-session push, OR'd into `pushNeeded`. | S |
| 3 ✓ | **Double progression is read as a stall and the lift is rotated out mid-climb.** 100×12 → 105×8 → 105×9 → 105×10 weekly (exactly what the app prescribed): Epley ties (105×10 = 100×12 = 140) → `isStalled` true → dumbbell-row swapped for a cable row. Hits every 1×/week accessory. | E · builder.js isStalled | Track top-set reps in `recentPerfs`; same top weight + more reps at that weight = not a stall. | S |
| 4 ✓ | **The plan forgets itself on any 10-day gap** — every deload week and every single missed week. `findPlan` walks `real()` sessions from *now* with `CONTINUE_DAYS=10`; a 3+1 block or a holiday restarts the mesocycle with seed-shuffled accessories. This is the exact moment a consistency-struggler needs zero friction. | E/P · builder.js findPlan | Moving reference: a deload advances the window instead of consuming it; fall back to the most recent matching plan within ~42 d labelled "from 3 weeks ago". | S |

### High — will be felt within months

| # | Finding | Where | Fix | Effort |
|---|---|---|---|---|
| 5 | **Gap-add and coach example lifts ignore the gym lever.** Machine gym → `gap-add: romanian-deadlift` (barbell); Home → face-pull (cable) added, and "try Face Pull / Preacher Curl" every week forever (5 regions have zero Home exercises). Contradicts v0.39's promise. | E/P · builder.js gapFillExercise; analysis.js exampleFor | `gapFillExercise`: strict `profileAllows`, drop rather than back off. Findings: pick examples that pass the gym predicate, skip the finding if none (mirror P3 protect). | M |
| 6 | **The coach ignores protect where it hurts, and there's no "I know, stop".** Knee protected → "Legs are still lagging… a squat or hinge day" + "Coach suggests Quads & Hamstrings" every visit. Rehabbing shoulders → "work in a press or two". | P · analysis.js legs-low/balance; buildHints suggestGroups | Gate legs-low/balance/suggestGroups on protect; per-finding mute via `settings.seen['mute:'+key]` (synced, sanitized) rendered as "Got it". | S–M |
| 7 ✓ | **Deload-due fires 3 weeks after a deload with a fabricated count** ("12 weeks without a deload" — `calcStreak` counts through deloads; only guard is `sinceDeload≤14`). And **one empty week zeroes the streak** — a week off, the real-world deload, is punished. | E/P · analysis.js:78; calcStreak | `weeks = lastDeload ? min(streak, floor(sinceDeload/7)) : streak`; fire once per block. Streak tolerant of one empty week (or "weeks trained of last 8"). | S |
| 8 ✓ | **The rest bar covers the bottom Finish button / last set row for the whole rest.** Body pads 64 px + safe; rest bar sits at 74–124 px. Action toasts block the same strip for 6 s. | U · styles.css:67,275,255 | `body:has(.restbar.on){padding-bottom:calc(… + 60px)}`. No tab-bar/safe-area change. | S |
| 9 | **"Continue your plan" only appears after re-picking the exact group set; 4–5 taps to the first set;** Home has no "next up". Pick Chest alone after Chest+Triceps → silently a fresh plan. | U/P · ui-today.js:80-83; builder.js findPlan | Home card "Next up: Pull · Session 4" → one tap into `buildAndStart`; picker stays behind "Something else". | S–M |
| 10 ✓ | **Contrast fails on the most-used text.** Light `--ink-3` on `--bg` **2.71:1** (sub-labels, eyebrows, tab labels, set headers); dark Finish button white on `--good` **2.31:1**. 48 font declarations under 13 px. | U · styles.css:3,18,114,177 | `--ink-3` ≈ `#6b7a89` (4.5:1); dark ink on `.btn.good`/`.set-check.on`; floor 12 px, 13 px for `--ink-3` text. | S |
| 11 ✓ | **One 5-lb increment for everything.** Lateral raise 15×20 → **20×12** (+33 %); DB press 25/hand → 30/hand; reps reset to the bottom of the range. This is the wife's whole gym. | P · progression.js unitIncrement | Increment by equip/type: dumbbell or isolation 2.5 lb / 1 kg; reset reps to `lo+1` on ranges wider than 4. | S |
| 12 | **Ignoring the app is invisible to it.** 8 weeks of 185×8 → "prefilled +5lb" every week; a declined rotation is re-proposed every week. | P · progression.js suggestion; builder.js rotation | Bumped-then-reverted ≥3× → rep/set route ("add a 4th set, or take 190×5"); a plan that omitted a proposed replacement = declined, suppress 4 weeks. | M |
| 13 ✓ | **History renders every session at once** — 563 cards at 2.5 years, 1.8 s in jsdom, a multi-second freeze on a phone by year 2. | U · ui-views.js history | Render 30 + "Show more"; calendar stays. | S |

### Medium

| # | Finding | Where | Fix | Effort |
|---|---|---|---|---|
| 14 | Two-week layoff → every muscle "volume low" (÷4 fixed weeks) and the builder adds sets to a detrained lifter on the first sessions back. | E · analysis.js:36 | `perWeek = effSets / max(2, activeWeeks)`. | M |
| 15 | Non-anchor tier-1 lifts rotate like accessories: 5-week flat deadlift → rack pull, leg press → front squat (a 2nd heavy axial), no deload gate. | E · builder.js:373 | Anchors ∪ all tier-1 ids in the plan. | S |
| 16 ✓ | Assisted pull-up progression and PR are inverted — "hit top reps" → **more** assist (65×8). | E · progression.js:199; analysis.js:277 | `INVERTED_LOAD` set; `inc = -inc`, floor 0; PR ranks by −load. | S |
| 17 ✓ | Size goal caps every range at 15: plank [30,60] → **[15,15]**, lateral raise [12,20] → [14,15]; Size bumps farmer's carry *earlier* than Balanced. | E · progression.js repRange | `cap = max(15, hi)`. | S |
| 18 ✓ | Straight set style copies back-off reps onto the top weight (200×5/180×8/180×8 → 200×5, 200×**8**, 200×**8**) — the v0.39.1 ramp bug, unfixed for straight. | E · builder.js shapeStyle | Reps from the set that carried the top weight. | S |
| 19 ✓ | A ticked set with a blank weight saves as a working set (`{w:"",r:6,done:true}`); "Working sets 2 · Volume 0 lb". | U · ui-bind.js:252; progression.js finalizeSets | On ✓ with blank weight on a non-bodyweight lift, focus the weight input; drop weightless sets in the unchecked prompt. | S |
| 20 | Importing a backup stamped in the other unit sets `updatedAt = now` on every session → resurrects local deletes, overwrites newer local edits. kg→lb→kg drifts 10/80 grid values (25 → 24.9) and `convertUnits` rewrites all history. | D · progression.js:262,254-258 | Keep the backup's `updatedAt`; store a canonical unit and convert at render. | S / M |
| 21 | `TOMB_KEEP = 90 d` (a phone in a drawer for a season resurrects deletes); "Reset profile" never propagates (merge can't delete a key); `endEstimated` is dropped by today's sanitizer; no version gate on the shared file (an old app strips notes/timestamps). | D · sync.js:19,74; store.js:103,208 | TOMB_KEEP 400 d; rebuild settings from remote when newer; add `endEstimated`; refuse to upload over a newer `version`. | S each |
| 22 | Push/pull balance counts deadlift/RDL as neither → a textbook full-body program is "imbalanced" forever, with the persisting "Still —" prefix. | P · analysis.js:66-69 | Hinge deadlift-family counts as half a pull, or compare back+rear-delt vs chest+front-delt effective sets. | S |
| 23 | One volume landmark for everyone; the builder bumps *five* exercises at once (13 → 19 sets) while the toast says "+1 set"; copy says "10+" but the trigger is <8. | P · analysis.js VOL_LANDMARKS; builder.js volumeBump | Scale low landmark by `days` (≤2 → 6); one group per session (lowest perWeek); toast counts what it added. | S |
| 24 | Live card density: ~30 buttons per exercise, a permanent "Tip" on card 1, Note/Watch demo/Remove set links on every card, Suggested/Auto-order/Save-routine below. First-week needs ✓, +/−, Add set. | U/P · ui-today.js:259-279 | Fold Note/Watch demo/Remove/equipment into the ⓘ sheet or a "···"; tip once via `seen`; hide Auto-order when the builder ordered. | M |
| 25 | "Build me a workout" with nothing selected silently builds Chest+Back. | U · ui-today.js:83 | Disable until a chip is on, or label the default. | S |
| 26 | Home leads with the profile-intro paragraph before the CTA; the profile sheet still says the builder "starts using these in the next update" (stale since v0.39). | U · ui-today.js:23-46; ui-views.js:360 | Move the card below Start; delete the sentence. | S |
| 27 | Sub-44 pt targets: equipment chip ≈26 px, switches 30 px, "Keep last" 30 px, segmented ≈35 px. | U · styles.css:189,289,188,305 | `::after` hit-slop on each (the overlay approach already exists). | S |
| 28 | Equipment remembered from a deload de-syncs mode and prescription (Smith history, barbell deload → barbell instance with Smith numbers). | E · builder.js:37-39 | Scope `lastModeFor` to real sessions, fall back to the last real perf's mode. | S |
| 29 | A unit switch leaves anchors off the plate grid forever (225 lb → 102.1 kg → 104.6 → 107.1…). | E · progression.js:199 | Snap an off-grid top to the half-increment grid before adding `inc`. | S |
| 30 | `weekIndex` folds at every DST change in NZ (Monday = exactly 0.5 epoch-week) → streak 2 instead of 9. Clean in US/EU/IN zones. | E · progression.js:271 | Anchor to a fixed Monday: `round((weekStart(ts)-W0)/(7·DAY))`. | S |

### Low (batch into a polish pass)

Sanitizer accepts −500 lb / 1e308 reps / year-3000 dates (clamp) · service worker caches the OAuth `?code=` URL as a key (`c.put('./index.html')`) · Settings shows viewport diagnostics to users · clickable `div`s without role/tabindex · emoji in sheet titles, three deload explainers per run · history card shows first-set reps as "3×8" for 8/8/7 · "Legs are undertrained", "own it", "Consistency is what moves the numbers" read as verdicts · silent 2000-session cap on import/sync (~year 7–10) · Epley at 50 push-ups (est 312) tops a 225×5 bench on the PR board · face-pull alone satisfies Back's row pattern; back-extension satisfies the hinge · accessory rotations form 2-cycles (A↔B) and never explore a third · Dropbox re-uploads the full 1–3.5 MB payload per finished workout (fine on Wi-Fi).

## Numbers

**Engine at scale** (ms, node; phone ≈3–5× slower): analyze 0.3/0.2 · buildTips 1.2/4.5 · planWorkout ≤0.5/1.0 · personalRecords 3.2/9.5 at 800/2000 sessions. Nothing O(n²).

**Storage** (4/wk, 6 ex × 4 sets, timestamps, notes on ⅓): y1 352 KB · y2 705 KB · y3 1.06 MB · y5 1.76 MB · y10 3.5 MB. One blob, rewritten only on finish/edit/merge (7 ms at y3); per-tick writes touch only the ~2 KB `il_active`. iOS 5 MB ceiling ≈ year 5–7 → finding #1.

**UI render through the real bundle at 2.5 years:** Today 26 ms · Progress 67 ms · Library 221 ms · editor 35 ms/render · **History 1,800 ms** (#13).

**Flows (taps from open):** start from last plan → first set **4–5** · full 5-exercise session 17 · add exercise 2 · equipment 2 · finish 2 · last week's bench 1–2 · profile 2 · deload 3 · export 2 · coach 1.

## What is genuinely well built — protect these

- `finalizeSets` + `real()`: only checked sets save; deloads never touch prescriptions, PRs, stall, tenure or anchors — held in every probe.
- `nextSets` pattern-aware prescription in the rows with one-tap Keep last; single set, 0 reps, 500 reps, warm-only, kg ramp, ramp+strength, descending+size, bodyweight all correct.
- History-as-plan: no routine object to drift; tenure in weeks; one change per session; anchor never rotates without a deload of that muscle.
- Import sanitizer rebuilds from a whitelist; CSP pins inline scripts; no user text reaches `innerHTML` unescaped.
- `resolveActive` compares events so a finished workout can't be resurrected; tombstone ties go to the delete; Dropbox `syncNow` snapshots dirty ids before the await and self-heals the overwrite race.
- Service worker: network-first document, refuses bad responses, prunes old caches, version-aware toast — no stuck-bundle path found.
- Every destructive action is undoable; the two Finish interstitials prevent loss rather than nag; the coach refuses to judge before 4 sessions / 10 days; deload copy is never judgmental.
- `profileAllows` as the one shared rule for pool and heavy-axial cap; hash-tiebroken rotations are reproducible.

## Cut or hide (to feel lighter without losing the core)

1. Watch demo + Note links on every live card → into the ⓘ sheet. 2. The always-present "Suggested: …" card → Add-exercise sheet only. 3. Auto-order, the first-card tip after first sight, viewport diagnostics. 4. Profile "Session length" and "Set style" behind "More"; first run asks one question (gym). 5. Recovery card until ≥2 deloads; Time by-muscle bars; Effectiveness bars.

## Proposed order (Roadmap v7 sketch — one phase per version, tests with oracles + controls as always)

- **A · Trust (data)** — #1 quota, #2 push flag, #20 import updatedAt, #21 tombstones/reset/endEstimated/version gate, #19 blank-weight tick.
- **B · Continuity (engine)** — #3 stall guard, #4 continue window, #15 tier-1 anchors, #7 deload-due + streak, #16, #17, #18, #28, #29, #30.
- **C · Coach honesty** — #5 gym-aware gap-add/examples, #6 protect gating + mute, #22 hinge, #23 landmarks by days + one bump/session, #14 active weeks, #12 ignore-detection.
- **D · Between sets (UI)** — #8 rest-bar padding, #10 contrast + font floor, #27 targets, #11 increments, #9 Next-up card, #24 card density, #25, #26, #13 History pagination.
- **E · Polish** — the Low batch.
