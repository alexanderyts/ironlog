# Logging edge cases — report

Two observations from the 2026-09-14 workout, each traced through the code, with the honest options and a recommendation. Guiding test for every option: does it make the app **simpler or more accurate without making it messy**. Where the elegant-general solution costs more surface area than the problem is worth, it says so.

---

## Part 1 — Exercises that don't fit "weight × reps"

### Checked against your real backup (2026-09-15)

Everything below is measured from the Monday 14 Sep session in your export, run through the app's own functions — not estimated.

**Tricep dip on the assisted machine — sets 70 / 55 / 70, mode "machine", note "lbs are the assistance".** One correction to my first draft: your **bodyweight setting is 0**, so the app did *not* add 217 — it recorded the dip at **70 lb, 55 lb, 70 lb**, i.e. it believes the assist number *is* the load. Three consequences, all measured:
- **Volume undercounted, not inflated:** those sets count **2,230 lb**; the true work (217 − assist) is **5,148 lb**. Your session shows 7,935 lb and should be closer to 10,850.
- **Progression points the wrong way.** The app's next-time hint for the dip right now is *"Top set hit the range — top set prefilled at 75 lb"*. 75 lb of assist is *easier* than 70; the app calls it progress. And your middle set (55 lb assist) was your **hardest**; the app reads it as your lightest.
- **No fake 1RM — because you tagged it "machine".** That mode shows load instead of an estimate, so the PR list wasn't polluted. Your instinct did the right thing; the engine just doesn't know which way "harder" is.

**Farmer's carry by laps — 45×3, 50×2, 50×2, note "reps are laps".** The library already means seconds here (the `20–40` range is seconds), but that lives only in the instruction text and the column says **Reps**, so laps was a fair read. Measured damage:
- **A fake PR is live on your Progress tab now:** *"Farmer's Carry · est 53 lb e1RM"*, computed from 50 lb × 2 laps. It sits between your Incline Press and Overhead Press.
- Volume for the carry counts **335 lb** — a meaningless number in either direction.

The note field preserved the truth in both cases for a human reader; nothing in the engine reads notes.

### The inventory — every exercise with non-standard semantics

I read the whole library for this. The cases fall into five classes; three need nothing.

| Class | Exercises | Today | Needs a change? |
|---|---|---|---|
| **Assisted** (less weight = harder) | `assisted-pull-up` only | Handled — `INVERTED_LOAD` flips progression, PR = least assist, no 1RM | **Yes — no assisted dip exists.** Also a data bug: `machine-dip` (a press-down machine, *normal* load) carries the search alias **"assisted dip"**, so searching for the right thing returns the wrong machine and repeats your mistake. |
| **Time-held** (seconds, not reps) | `plank`, `farmers-carry` | Convention in the instruction text only; column says Reps; volume and 1RM computed as if reps | **Yes** — the volume/PR distortion is real, and the label invites the wrong unit. |
| **Counted per side / total** | `russian-twist` (total touches), `pallof-press`, `torso-rotation-machine` (per side) | Reps are reps; the convention is a note in the instruction | No — these are genuine reps. (Visibility of the convention is a nicety, not a fix.) |
| **Odd unit** | `wrist-roller` (rolls, range 1–3) | Reps = rolls | No. |
| **Weighted bodyweight** | pull-up, chin-up, both dips, push-up (×0.65) | `BW_FACTOR` adds bodyweight to the load | No — already right. |

So the whole problem is two classes: **assisted** and **time-held**. Nothing else in the library is affected, and "laps" isn't a class — time is the standard, loggable unit for a carry.

### Options

**A — Fix the data, follow the precedent.** Add an `assisted-dip` exercise (Machine, in `INVERTED_LOAD`, no `BW_FACTOR`) exactly as `assisted-pull-up` already works: you enter the assist weight, less is harder, the PR is the least assist, no 1RM. Remove the misleading "assisted dip" alias from Machine Dip. ~5 lines of data. *Leaves the time-held problem untouched.*

**B — An `assisted` mode.** The app already lets a logged instance carry a mode (barbell / dumbbell / smith / machine / cable / bodyweight). Add `assisted`, valid on any `BW_FACTOR` exercise: weight = assistance, load = bodyweight − assist, inverted progression, header reads "Assist lb". One dip exercise keeps one history. This is the elegant-general version — and the most invasive: it threads through `setLoad` (needs bodyweight *and* mode), every `INVERTED_LOAD` check in progression/analysis (`(id)` → `(id, mode)`), the mode picker, the import whitelist, and the review snapshot. It also *requires* bodyweight to be set, or the load is unknowable — which is precisely what the assisted-pull-up design side-steps by tracking the assist number itself. Right shape for a v2 if a third assisted case appears; too much surface for one machine today.

**C — A `metric: 'time'` tag on the exercise** (library-level, not per-instance). For `plank` and `farmers-carry`: the column reads **Sec**, cards and PRs read "50 lb × 45 s", **no 1RM**, and they're **excluded from lb volume** (volume is a weight-×-reps concept; these still count as sets for muscle balance, frequency and the coach). Progression needs *no* change — double progression on seconds ("hit 40 s, add weight") is exactly what the 20–40 range already means. Contained: the tag, the header label, `sessionVolume`, `personalRecords` (`showEst=false` + format), `fmtPerf`.

### Recommendation

- **Assisted → Option A, now.** It's the pattern the app already chose, it's a handful of lines, and it separates history *correctly*: an assisted dip and a bodyweight dip are different lifts, so when you graduate to unassisted you start clean on "Tricep Dip" — which is right, not a loss. Option B stays on the shelf until a third assisted case exists. One thing your data argues for: you already reach for the mode picker (machine on the dip, cable on the wrist curls, smith on the extension), so discoverability matters — **Assisted Dip goes in Triceps next to Tricep Dip, and "assisted" must search to it, not to Machine Dip.**
- **Set your bodyweight** (Settings → Bodyweight; it's 0 now). Until then every pull-up, chin-up, dip and push-up you log counts only the added weight — the assisted-dip fix doesn't need it, but your bodyweight lifts do.
- **Time-held → Option C.** Small, honest, and it stops two real distortions (inflated weekly volume, fake PRs). Log carries in **seconds**; the note field is there if you also want laps.
- **The alias bug** gets fixed regardless.
- **Your existing data:** Monday's Tricep Dip (70×12, 55×10, 70×12) stays wrong until edited. Once Assisted Dip exists: open that session → Edit → remove Tricep Dip → add Assisted Dip with the same three sets. The carry's fake PR disappears the moment the time tag ships (no edit needed); re-log the carry in seconds if you want the record right. Two minutes total.

What we're deliberately **not** doing: a per-set "this number means…" toggle (a control on the one row we fight for space on), and a distance unit for carries (nobody standardises it; time does the job).

---

## Part 2 — Set timestamps and the mis-logged set

### What happened — found in the data

Your export shows exactly where: the three farmer's-carry sets were ticked at **0.30 s and 0.46 s** apart — all three inside three-quarters of a second — the signature of sets re-entered and ticked in one go. Every other exercise in the session has honest gaps (92 s to 390 s). Measured effects on that one session:

| Number | Today | With a 20 s floor |
|---|---|---|
| Session rest median (all) | 132 s | **140 s** |
| Compound rest median | 161 s | **175 s** |
| "Rest you usually take" on the carry's own sheet | **0 s** (nonsense) | not shown until real gaps exist |
| Time by muscle (Chest 31 · Forearms 20 · Triceps 14 min) | plausible | unchanged |

So: the session-level medians drift by 8–14 s (small, because you had many good gaps to dilute them), the per-exercise figure for the carry is flat wrong, and time-by-muscle happens to survive because the batch's first set inherits the real interval before it. Downstream in general:

| Uses the stamps for | Effect of the correction | Fragile? |
|---|---|---|
| **Forgotten-Finish safety** (honest end time from the last set) | None — the last tap really was the last tap | No |
| **Session duration** (start → end) | None — doesn't use per-set stamps | No |
| **Density** (sets per 10 min over the session) | None | No |
| **Rest medians** (compound / isolation, and per-exercise history) | 3–5 s "rests" enter the medians; the per-exercise median for that lift is skewed for good | **Yes** |
| **Time by muscle group** | That group gets ~0 minutes; the previous group inherits the real time | **Yes** |

So the feature's *safety* value — the reason it was built — is untouched. The damage is confined to two analytics, and it comes from **implausible intervals**, not from the stamps existing. The same distortion happens in a far more common case: ticking three sets at once after an exercise instead of one by one. Any fix should cover both.

### Options

**A — Remove per-set stamps.** Simplest possible. Loses the forgotten-Finish end-time estimate (the 50-hour bug's fix falls back to "started long ago" with a coarser guess), all rest analytics, and time-by-muscle. Trades away the most useful part to fix the least useful.

**B — A "move set to another exercise" action** that carries the stamp. Fixes exactly this path — and adds a control to the set row, the tightest space in the app; and people will still fix things the way you did. Doesn't help batch-ticking at all.

**C — Make the analytics robust.** Nobody rests four seconds between working sets. Treat any interval under a floor (`MIN_REST_S = 20`) as a correction or a batch tick, not a rest: excluded from every rest median (session and per-exercise). Time-by-muscle already gives such sets ~nothing; the "previous group inherits the time" effect is accepted and stated. Zero UI, about six lines, and the test is a pure oracle: a 4 s gap is dropped, a 90 s gap is kept.

**D — Stop discarding the stamp on un-tick.** Today un-tick deletes `at` and re-tick stamps "now". Keep the old stamp instead and only stamp on tick when none exists. A mis-tap fixed two seconds later keeps its true time. Three lines, no UI. **Honest caveat from your data:** your sets were re-entered on a *different* exercise — new set objects — so D would not have helped Monday. It covers the accidental un-tick only; C is the fix that actually addresses what happened.

**E — Editable timestamps.** No. That's the mess.

### Recommendation

**Keep the feature; ship C + D.** The stamps earn their place through the forgotten-Finish safeguard and honest durations; the fragility is entirely in how two analytics *read* them, and a plausibility floor fixes that for the correction case and the batch-tick case in one stroke. D removes the most common way a good stamp gets thrown away. Add one honest line to the Time card — "Sets ticked seconds apart aren't counted as rest" — so the number never claims more than it knows.

Not doing: the move action (space), editable stamps (mess), or a "log after the fact" mode (a second logging path to explain).

---

## What ships (proposed, in one small version)

1. `assisted-dip` exercise (Machine, `INVERTED_LOAD`), aliases "assisted dips, dip machine assist"; remove "assisted dip" from `machine-dip`.
2. `metric:'time'` on `plank` and `farmers-carry`: header **Sec**, `fmtPerf` → "× 45 s", excluded from `sessionVolume`, `personalRecords` shows load × seconds with no 1RM.
3. `MIN_REST_S = 20` floor in `restGaps` and `exerciseRest`; Time-card honesty line.
4. Un-tick keeps `at`; tick stamps only when absent.
5. Tests, each with an oracle and a control: assisted-dip suggestion goes *down* (75 → 70) while tricep-dip goes up; carry volume = 0 while its set still counts for Forearms; PR row for a carry has no `est`; a 4 s gap excluded / 90 s kept; un-tick → re-tick preserves the original stamp.
6. Review snapshot must stay byte-identical (no owner data hits any of these paths).

Then you fix the one wrong session by hand, and the numbers are honest again.
