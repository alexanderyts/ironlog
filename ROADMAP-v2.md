# Ironlog — Roadmap v2

Feedback from real first use (2026-09-09). Eight issues, root-caused against the actual v0.6.2 code, turned into a phased plan. Each phase ships independently and is covered by `npm test` before it lands.

---

## Issue-by-issue

### 1. Volume display is confusing ("10k lb")
**Root cause:** `fmtVol()` in `src/engine/progression.js:17` abbreviates anything ≥1000 to `"10k"`, and the UI appends the unit right after with no space styling that reads naturally — `10k` + `lb` scans like "10 kilopounds." Single-session and single-week volumes almost always fit under 100,000, where a plain comma-formatted number (`12,480 lb`) is actually *more* readable to a lifter than a `k` abbreviation — lifters are used to reading four/five-digit numbers (405, 225, 12,480), not `k` shorthand.
**Fix:**
- Comma-format volume up to 99,999 instead of abbreviating at 1,000; reserve `k`/`M` for numbers that are genuinely too long to read at a glance.
- Add a one-time info affordance (tap the "Volume" label) explaining what it means: *weight × reps, summed across working sets* — so the number has context the first time someone sees it.
- Leave the 8-week bar chart alone — its axis labels are dates, not volume, so it isn't affected.

### 2. Progressive overload doesn't understand ramping vs. back-off sets
**Root cause:** `suggestion()` in `progression.js:32` treats every set in a session identically — it checks whether **all** sets hit the top of the rep range. That's correct for flat/straight sets (same weight every set) but wrong for the two patterns you described:
- **Ascending (ramp-up):** light → heavy across sets. The *last* (heaviest) set is the one that indicates whether you're ready for more.
- **Descending (top set + back-off):** heavy → light across sets. The *first* (heaviest) set is the indicator; the lighter sets exist to accumulate fatigue, not to progress independently.

Right now the app can't tell these apart, so its "add weight" suggestion is only reliable for flat sets and gives generic advice otherwise.

**Fix — a real feature, grounded in standard periodization practice** (top-set-plus-backoffs and ascending pyramids are both well-established hypertrophy/strength patterns; the key training principle is that *the indicator set* — the heaviest one — is what should drive the load decision, while the other sets exist for volume/fatigue and can trail it):
- Detect the pattern per exercise from the logged sets: compare the first working set's weight to the last. Ascending, descending, or flat.
- Identify the **anchor set** per pattern (last for ascending, first for descending, any for flat) and base the "did you hit your rep target" check on that set alone.
- Prefill next session accordingly: bump the anchor set's weight if it hit the top of the range, and carry the other sets forward proportionally (same relative gap from the anchor) rather than copying them untouched or bumping them all uniformly.
- Rewrite the on-screen suggestion text to say what actually happened: *"Ramped up to 185×6 last time — hit the top of your range on your last set. Try 190 as your top set."* vs. *"Opened at 225×5 and backed off — your first set hit the top of range. Try 230 to start next time."*

### 3. Workout builder should build *toward* progress, not reshuffle every time
**Root cause:** `buildRecommendation()`/`pickForGroup()` already anchor the *primary* lift on exercise history (good — that part works), but accessories are re-picked fresh from a random seed every time you tap "Build me a workout." There's no concept of "this is week 2 of the same plan" — so two sessions eight days apart training the same muscles can get almost entirely different accessory lists, which fights the two things that actually drive hypertrophy progress:
- **Progressive overload requires repeating the same movement long enough to add load to it.** Switching an exercise resets your baseline for it (no history to compare against, no suggestion to give).
- **The "practice effect"** — technical proficiency on a lift improves with repeated exposure, which is itself part of why performance (and trackable progress) improves session-to-session on a *repeated* exercise, distinct from muscular adaptation.

Standard resistance-training programming (mesocycle-based periodization, as used in Renaissance Periodization's and Eric Helms' frameworks, and broadly in Brad Schoenfeld's hypertrophy literature) holds an exercise selection roughly constant for a **block of several weeks** so load can be progressed cleanly, then rotates *deliberately and gradually* — not the whole session at once — to manage staleness and joint wear while still hitting a muscle from multiple angles over time.

**Fix:**
- Introduce a persisted **workout plan/cycle**: when you build a workout for a muscle-group combination you've trained recently (within roughly 10 days), the builder defaults to **continuing the same exercise list** (with progressive-overload prefill from #2) instead of rebuilding from scratch.
- Track how many consecutive sessions each *non-anchor* exercise has been repeated. Once a rotation threshold is reached (e.g., ~4–6 sessions — roughly a mesocycle at typical frequency), allow **at most one** accessory to rotate per rebuild — never the whole list, and never the anchor (unless you explicitly discard the plan).
- Bonus, natural to add here: if an exercise's estimated strength has been flat or regressing for 2+ consecutive sessions, that's a good, well-supported trigger to prioritize it for rotation (a stall is exactly when a movement variation tends to help) rather than waiting purely on the session counter.
- Keep an explicit "Start fresh" escape hatch for whenever you actually want a new plan.

### 4. The "suggested" exercise doesn't respect the muscle groups in the workout
**Root cause — confirmed in code, `complementSuggestions()` in `src/engine/builder.js:138-141`:** when push and pull sets are imbalanced *within the single session being built*, the function scores **any** exercise tier ≤2 that's a press or a pull, with no requirement that it belongs to a muscle group already in the workout. That's how a Back+Biceps (pull) day ends up suggesting a chest or shoulder press — it's not filtered to the workout's own muscles, and push/pull balance isn't even a same-session concern in the first place (a dedicated pull day is *supposed* to be pull-heavy).
**Fix:**
- Remove the cross-group push/pull "balance" bonus from `complementSuggestions()` entirely. Push/pull balance is a program-level (weekly) concern, not a within-session one, and belongs in Coach's Notes (which already reports it, correctly, over a multi-week window) — not as a suggestion while you're actively building a pull day.
- Restrict all suggestions to muscle groups already present in the current workout, ranked purely by the region/pattern-gap logic that already works correctly for #7-adjacent coverage (e.g., a Back day still gets a complementary Back movement, not an unrelated one).

### 5. iPhone usability: zoom-on-tap, scroll bounce, tab bar jumping
Three distinct, well-understood iOS Safari issues — confirmed nothing in the current CSS addresses any of them (`grep` for `touch-action`/`overscroll-behavior` returns nothing):
- **Zoom on rapid stepper taps:** iOS interprets two quick taps as "double-tap to zoom." Fix: `touch-action: manipulation` on all buttons, which tells Safari a fast second tap is intentional, not a zoom gesture.
- **Odd bounce/rubber-banding at the top/bottom of a screen:** the page's default overscroll behavior. Fix: `overscroll-behavior-y: contain` on `html`/`body`.
- **Tab bar not consistently placed tab-to-tab:** the tab bar, rest timer, and toast are all `position: fixed`, which in iOS Safari is anchored to the *visual* viewport — and that shifts as Safari's own address bar auto-hides/shows based on scroll, so a `fixed` bottom bar visibly jumps between a short tab (address bar visible) and a tab you've scrolled down (address bar hidden). Fix: restructure the page as a flex column (`body` = flex column, `<main>` = `flex:1`, nav = `position: sticky; bottom: 0`) so the bar follows normal document flow instead of viewport-relative fixed positioning — the standard, robust fix for this well-known Safari quirk.
- Applies to both builds; the artifact build additionally can't set its own viewport meta tag (claude.ai supplies the page shell), so `touch-action`/`overscroll-behavior` (both plain CSS) are the primary fix there, while the standalone site can also tighten the viewport meta.

### 6. Add forearms, expand the library
No forearm-specific exercises exist today (hammer/barbell curls hit brachialis/brachioradialis incidentally, but nothing targets wrist flexors/extensors or grip). Add a **Forearms** group: wrist curl, reverse wrist curl, farmer's carry, reverse curl, wrist roller — tagged with the same region/pattern/tier schema as everything else so the builder and coach's notes work with it automatically. Also a general pass to broaden thin areas of the current 67-exercise library (more back and leg variations in particular).

### 7. Coach's Notes judges you before you have enough history
**Root cause — confirmed in code, `buildTips()` in `src/engine/analysis.js:37-45`:** the push/pull-balance tip only requires **6 total sets** (`a.push+a.pull>=6`) — that's satisfiable in a single session — and the legs-undertrained tip needs only 8 sets total. Both can fire after your first or second workout, before you've had any real chance to add the movements they're "warning" about, which reads as premature/wrong rather than helpful.
**Fix:** gate *comparative* tips (push/pull ratio, upper/lower ratio, weekly-volume-landmark) behind a real minimum sample: something like **≥4 distinct sessions across ≥10 days**, not just a raw set count that one workout can satisfy. Below that threshold, Coach's Notes shows encouragement/logging-confirmation content instead of comparative judgments — and the depth of what it reports should expand in stages as history accumulates (a few sessions in: basic stats and streaks only; once there's a real week or two: PRs and simple region gaps; once there's a genuine multi-week window: the full balance/volume-landmark analysis it does today). This directly serves the "reporting evolves over time" ask, not just a single higher threshold.

---

## Sequencing — what ships first and why

Grouped by **risk and dependency**, not just difficulty. Bug fixes and self-contained changes go first; the two features that depend on each other's foundation go last, in the order they depend on each other.

**Phase 1 — correctness fixes (small, independent, ship together)**
1. #4 suggestion muscle-group bug — it's actively giving wrong advice right now
2. #7 Coach's Notes premature judgments — same category of problem, same fix pattern
3. #1 volume formatting
4. #6 forearms + library expansion — purely additive data, zero risk to existing logic, easy to batch in alongside the above

**Phase 2 — iOS usability pass (#5)**
Its own phase because it's cross-cutting CSS/layout touching every screen — worth isolating so any regression is easy to bisect, and worth doing early since it affects literally every session from here on, independent of the smarter-coaching work below.

**Phase 3 — pattern-aware progressive overload (#2)** — ✅ shipped v0.9.0 (2026-09-09). Engine: `setPattern` / `nextSets` / `fmtPerf` in `src/engine/progression.js`; the per-exercise "ready / reps short / under range" signal Phase 4 needs is `nextSets(...).short` and `.under`.
The foundation the next phase builds on: once the app can tell ascending/descending/flat apart and knows whether a specific exercise is progressing, that per-exercise signal is exactly what #3's rotation trigger (stalled lift → prioritize for variation) needs.

**Phase 4 — mesocycle-aware workout building (#3)** — ✅ shipped v0.10.0 (2026-09-09). Derived from history, no new persisted plan state; `planWorkout` in `src/engine/builder.js`.
The largest, most architecturally significant change (new persisted plan/cycle state, rotation heuristics) — sequenced last because it consumes #3's per-exercise progress data and reuses #4's now-correctly-scoped suggestion logic for its rotation choices.

---

## Model recommendation, and how to switch without burning usage

Different phases need different things from a model — mechanical correctness fixes need speed, not depth; the mesocycle design needs the most careful reasoning in the whole roadmap. Matching model to phase, and only paying for the expensive model where it earns its cost:

| Phase | What it needs | Recommended model |
|---|---|---|
| 1 — bug fixes, formatting, library data | Speed, precision, low ambiguity | **Sonnet 5** (current) — no switch needed |
| 2 — iOS CSS/layout pass | Careful, systematic execution of well-known fixes | **Sonnet 5** — no switch needed |
| 3 — pattern-aware overload engine | Nontrivial algorithm design with real edge cases (mixed patterns, warm-ups, uneven set counts) | **Opus 5** for the design pass, then back to **Sonnet 5** to implement + test |
| 4 — mesocycle workout building | The hardest reasoning in this roadmap: synthesizing training-science principles into a robust, stateful algorithm | **Opus 5** |

**How to switch without spending more than necessary:** the expensive model should only be "on" for the *design* conversation, not the whole implementation grind (file edits, test runs, back-and-forth debugging burn many more turns than the design decision itself, and Sonnet handles that mechanical work just as well once the design is pinned down).

1. Finish Phases 1–2 on the current model (no action needed).
2. Right before Phase 3, run `/model claude-opus-5` and have a focused design conversation *only* — get the pattern-detection algorithm and prefill logic nailed down, and have me write it directly into the code + a design comment explaining the reasoning (so it's captured on disk, not just in chat).
3. Immediately after that design lands, run `/model claude-sonnet-5` again for the testing/iteration loop and the rest of Phase 3.
4. Repeat the same two-step dance for Phase 4: `/model claude-opus-5` for the mesocycle/rotation design, then `/model claude-sonnet-5` to build it out.

This keeps Opus usage limited to exactly the two conversations that need it, while the higher-volume mechanical work (which is most of the total tokens in any phase) runs on the cheaper model. Your conversation history carries across a model switch, so nothing about context gets lost — it only changes which model is doing the thinking.
