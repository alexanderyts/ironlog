# Ironlog — Roadmap v3

Follows the fully-shipped Roadmap v2 (all four phases in by v0.10.0). Driven by a second round of use and three user asks, scoped through one lens: **most user-friendly and easy to use**, protecting the app's north star of fast, simple logging. Decisions below were made deliberately in a plan → objective-review pass.

Guiding rule adopted for this round: **invisible until you need it** — zero friction for the common case, one tap for the exception.

---

## Phase 1 — Remove sets (ship first)

Pure ease-of-use win, no engine risk, fully independent.

- A **"－ Remove set"** action next to "＋ Add set", shown only when the exercise has more than one set. It removes the last set — the exact mirror of Add, matching the user's own framing, discoverable, and it doesn't squeeze the tight set-row grid (34px / 1fr / 1fr / 44px already leaves the +/− steppers little room on a 375px phone; a 5th column would cramp the number fields).
  - **Not** a swipe gesture — swipe fights the iOS back-gesture on the installed PWA; **not** a per-row column — no space on mobile.
- Confirm before removing a set that's already checked done; delete an undone set immediately.
- **Undo** via the existing toast-with-Undo pattern (same as routine/exercise delete).
- Never strands an empty exercise — the control disappears at one set (use "✕ remove exercise" to drop the whole movement).
- Engine untouched — pattern detection (`setPattern`) and prefill (`nextSets`) already tolerate variable set counts.

## Phase 2 — Equipment modality (`mode`)

The honest fix for "same movement, different equipment," designed to be **remembered and ignorable**.

- New optional `mode` on a *logged exercise instance* (not per-set): `barbell · dumbbell · machine · smith · cable · bodyweight`.
  - **Absent ⇒ today's exact behavior**, derived from the exercise's `equip` at read time. No migration; the 47 existing tests must pass untouched before new ones are added.
- **Remembered:** an exercise opens in the mode used last time (falling back to its `equip` default). The common case (always barbell bench) never shows a decision.
- **One tap to change:** a small `Barbell ▾` chip on the logged exercise opens a picker. Switching relabels the weight field (e.g. **"lb per dumbbell"**) so the user enters what's printed on the equipment; the app handles the math.
- **Comparison integrity (the core correctness fix):** `lastPerf` / `suggestion` / `nextSets` / `exerciseStreak` / `planWorkout` / PRs all compare within **(id, mode)**. One movement stays one name and one history; progression never compares 25 lb dumbbells to a 75 lb Smith. A modality switch is also a natural mesocycle "variation" signal.
- **Load accuracy — deliberately limited to the unambiguous case:** dumbbell (two-hand) counts as ×2 for volume/e1RM; machine / cable / smith stay ×1 with **no barbell-1RM-equivalence claim** (`e1rmComparable=false`). We do **not** invent precision for machine stacks or unilateral doubling.
  - The ×2 dumbbell factor applies **going forward / behind a clear toggle** — never silently rewrites the historical PR board or past weekly-volume numbers the user has been watching.
- Rejected alternative: adding `smith-overhead-press`, `cable-ohp`, … as separate library IDs. Cheaper to build but *less* friendly daily — forces re-searching a differently-named exercise on every equipment switch and fragments one movement's history across unrelated entries.

## Phase 3 — Scientific-accuracy tune-ups (frictionless items only)

The app is already broadly evidence-aligned (double progression, ~10+ weekly-set volume target, multi-region coverage, sensible rest). Adopt only changes that add **no logging friction**:

- **Frequency nudge:** coaching tip when a well-trained muscle is hit <2×/week (≥2×/week is well-supported for a given volume). Read-only analysis, no new input.
- **Deload prompt:** gentle "you've progressed N weeks — consider a lighter week" after a long unbroken progression streak (block periodization normally ends in a deload). Read-only nudge.
- **Modality comparability** (delivered by Phase 2) is itself a scientific-accuracy fix: you cannot progressively overload across incomparable loads.

**Explicitly out of scope this round (protect simplicity):**
- **RIR / proximity-to-failure** — highest-value science lever but highest logging friction; a required per-set effort field would harm fast logging. If ever added, only as a single skippable tap, and as its own future phase.
- **Rep-range changes** — the compound 5–8 lean is intentional (powerbuilding-friendly), not wrong; changing it rewrites every prescription and all tests to impose a philosophy. Documented, not changed.
- **Fractional-volume 0.5** heuristic — kept and documented; the evidence is unsettled and 0.5 is a reasonable middle.

---

## Sequencing rationale

Ordered by risk and independence: Phase 1 is trivial and isolated; Phase 3's items are read-only coaching with no algorithm risk; Phase 2 is last because it touches the just-stabilized Phase 3–4 progression engine and must stay optional-and-inert by default. Each phase ships independently, is covered by `npm test`, bumps the version, and updates the changelog.
