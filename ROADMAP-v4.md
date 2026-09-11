# Ironlog — Roadmap v4

Theme: **the builder learns from the user's own data over time** — reacting to Coach's findings and progressively varying exercises — without ever becoming random and without any AI model. Guiding principle: **continuity first; variety only enters when the data says it should.**

Each phase ships independently (version bump, `npm test`, changelog, republish).

---

## Phase A — Findings layer (foundation)
Separate *deciding what's true* from *writing the sentence*, so both the builder and richer phrasing can consume the same facts.
- `findings(a, sessions, now, bw)` in analysis.js → a typed list (`region-gap`, `pattern-gap`, `balance`, `legs-low`, `volume-low`, `freq-low`, `deload-taken`, `deload-due`, `progression`) — data, not text.
- `findingKey(f)` + `withStatus(...)` derive **new / persisting / resolved** by comparing the current 28-day window to the previous one (call `analyze` with `now-28d`; no new persisted state).
- `buildTips()` becomes a thin renderer over `findings()` — **byte-identical wording**, so this phase is invisible and every analysis test stays green.
- Risk: low. Analysis.js only.

## Phase B — Rotation & progression policy (research fixes to the builder core)
Fix continuity semantics *before* wiring reactions onto them.
- Staleness measured in **weeks**, not session count (≈4 min, 6–8 typical) — a 3×/week lifter isn't told "time for a change" at under 2 weeks.
- Hard rotation becomes **conditional** (progress flattened + block elapsed), never firing while a lift still progresses.
- A permanently-stalled **anchor** may take a same-pattern **variation swap** — only after a long stall (≈3 wk) AND a deload that didn't unstick it — never dropping the pattern.
- Stall detection requires ≥2–3 **weeks** of non-improvement and checks reps-at-load, not just e1RM.
- Research: Baz-Valle 2019 (deliberate variation helps; random variation impairs progression), Fonseca 2014 (variation for uniform development), block periodization (core lifts held 4–8 wk). Progress for intermediates shows over 2–4 wk → judge stall/staleness in time.
- Risk: medium (mesocycle heart; churn test is the guardrail).

## Phase C — The builder reacts to findings
`findings()` → `buildHints()` → **scoring/volume inputs that never override continuity**:
1. **What to train:** start-screen nudge with pre-suggested groups for weekly imbalances / undertraining.
2. **Which exercise:** score bonus in `pickForGroup` and preference in `replacementFor` for candidates that fill a flagged gap — fixed when a slot next opens, not by reshuffling.
3. **How much:** an undertrained group in a continued plan gets **+1 set** (once per block, ≤5/exercise, ≤~20/muscle/wk, never on deload).
4. **Add (not swap)** one exercise for a never-trained region if under the size cap.
- Gating mirrors the coach (comparative reactions need `readyForComparative`). Every reaction carries a one-line reason string (surfaced as a toast).
- Risk: medium.

## Phase D — Library expansion (hypertrophy-focused, builder-aware)
~77 → ~115 exercises chosen to give the builder *meaningful* choices:
- Variation families (2–3 close substitutes per region×pattern) so rotations swap within a family.
- Lengthened-position (stretch) movements, tagged `LONG_LENGTH` so the builder can prefer a stretch option.
- Machine/cable/Smith variants (modality + gym availability); unilateral options tagged `UNILATERAL`.
- True anatomical gaps (glute medius/abduction, erectors/45° extension, adduction, rear-delt/upper-back).
- Minimal data model: keep RAW/META; add `LONG_LENGTH`/`UNILATERAL` id-sets; at most one new region (`Glutes:medius`, low `gapPrio`). New tier-1s only where a lift can truly anchor.
- Refresh seed.js so the demo shows the reactions. Risk: low-medium.

## Phase E — Coaching that reads like a coach, not a form letter
Variety from data + templates, still no AI:
- 3–4 wordings per finding type, chosen by hash of (type + week) — varies weekly, stable within a week.
- Contextual clauses from the numbers (trend vs last window, persistence, the user's real exercise names).
- Status-aware tone (Phase A): new = flagged; persisting = gentle follow-up; **resolved = credit** ("Rear delts: sorted").
- Explain the builder's reactions in the notes. Risk: low.

## Phase F — Adversarial audit of the builder (last)
Defined checks: churn (continue 20× w/ unchanged data + big library → identical), frequency fairness across 1–3×/wk, "hold what's working" (10-wk progressing lift never counter-rotated), anchor-swap safety, volume ceilings, session size/order invariants survive additions, interaction traps (gap-add + rotation same session; hints on deload; modality switch mid-block), determinism/explainability. Fix failures; document residuals.

---

## Build order
A (foundation) → B (fix continuity) → C (headline reactions) → D (better raw material) → E (phrasing) → F (audit). Rationale: reactions need A's data and B's stable base; the library best follows the logic that consumes it; phrasing explains C; the audit runs against the finished whole.
