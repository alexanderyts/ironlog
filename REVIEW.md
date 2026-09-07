# Ironlog — App Review & Roadmap (at v0.5.0)

*An honest expert review of the algorithm, features, usability, and how the app is built — with prioritized recommendations.*

---

## 1. Algorithm review — what was wrong and what changed

| Weakness found | Impact | Fix (shipped in v0.5.0) |
|---|---|---|
| Anchor lift chosen randomly among compounds | Upright rows anchoring shoulder days; push-ups anchoring chest | **Lift tiers** — anchor is always a foundational (tier-1) lift on the muscle's key pattern |
| No progression continuity | Main lift changed every session → nothing to add weight to | Anchor on the **same foundational lift you have history on**; accessories rotate |
| Lower body modeled by fake "regions" | Couldn't express "hamstrings need hinge *and* curl" | **Ideal movement patterns per muscle** (hinge+curl, squat+lunge, vertical+horizontal pull) |
| Padded sessions with redundant moves | Fly *and* crossover on the same day | Stops when nothing adds coverage; duplicate isolation penalized |
| No spinal-load guard | Squat + deadlift + RDL could all land in one session | **Cap of 2 heavy barbell squat/hinge lifts**; hip thrust exempt |
| No set/rep prescription | New exercises started as one blank set | Main lifts 4 sets, compounds 3, isolation 3, finishers 2 — reps prefilled |
| Deadlift as back-day filler | Led every back day by weight | Heavy axial lifts penalized as filler when off the muscle's key pattern |

**Verified outputs now:** Back = row + pulldown + face pull + straight-arm · Legs = squat + SLDL + hip thrust + Bulgarian + extension + curl + kickback (2 axial) · Chest = bench + incline + dip + fly · 5-muscle upper day = balanced push/pull, compounds first.

**Remaining ceiling (by design, not bugs):** the builder is deterministic for the main lift (good for progression) — variety comes from accessory rotation once you have history. It doesn't yet periodize (deload weeks, rep-range cycling) or account for fatigue across *days* (e.g., avoiding heavy hinge the day after heavy squat). Both are sensible next-level features.

---

## 2. Bugs fixed in this pass
- **Unit switch corrupted history.** lb↔kg only relabelled numbers. Now converts every stored weight with confirmation, rounded to 0.25 so it round-trips exactly.
- **Untouched sets were saved** into history. Finish now drops blank prescribed sets and treats weighted sets as performed.

---

## 3. Usability & feature refinements (prioritized)

### P1 — daily-use wins
1. **Saved routines** — name a session ("Push A") and reload it in one tap; the biggest remaining friction for someone who struggles to keep up.
2. **Edit past sessions** — currently you can only delete. Fixing a typo shouldn't cost the whole workout.
3. **Undo** for delete/discard (a 5-second "Undo" toast) — safer than a confirm dialog alone.
4. **Warm-up vs working set flag** — so warm-ups don't pollute PRs, volume, or the progressive-overload suggestion.
5. **Bodyweight setting** — so pull-ups/dips carry real load in volume and e1RM (today they count as 0 lb).
6. **Per-exercise rest override** and show "next: set 3 of 4" in the rest bar.
7. **Targeted DOM updates for the set list** — completing a set re-renders the whole screen and can drop keyboard focus. Smoother to patch just that row.

### P2 — insight
8. **Per-lift progress charts** (e1RM / top set over time) — the PR list is a snapshot; a trend line per lift is what motivates.
9. **Weekly "plan vs done"** — sets/week per muscle against the 10–20 landmark, shown as a bar with a target band.
10. **Expand the library** (67 → 150–250). The smart engine gets better with more, well-tagged options; add cable/machine variants and unilateral work.

### P3 — power
11. **AI description matching** via the artifact `sample` capability ("that angled push machine" → Incline Machine Press) — fuzzy search covers most cases already.
12. **Plate calculator**, notes/RPE per set (collapsed by default), deload suggestion when progression stalls for 3+ sessions.

---

## 4. How it's built — assessment

**Current shape:** one ~1,500-line HTML file (CSS + vanilla JS), no framework, no build step, no automated tests. Storage is local-first (localStorage) with dirty-flag sync to the artifact cloud database (one document per session + a settings doc). Design system is token-based (light/dark/system).

**Strengths:** zero dependencies, instant load, nothing to update or break, trivially publishable as a single artifact, and the engine is pure logic (easy to test).

**Risks and recommendations, in priority order:**

1. **Single file is getting large.** Split source into `src/` (exercise data, engine/builder, engine/analysis, store, views, styles) with a ~20-line build script that concatenates into `app.html`. The artifact stays single-file; development gets sane. *Effort: small. Value: high, compounding.*
2. **No automated tests for the "smart" logic.** Everything above was verified by hand in the browser. The builder, ordering, analysis, and unit conversion are pure functions — add node tests that assert invariants (every ideal region/pattern covered, ≤2 axial lifts, compounds ordered first, lb→kg→lb identity). Without this, a future tweak can silently make workouts worse. *Effort: small–medium. Value: high.*
3. **Offline on first load.** The app loads from claude.ai; a web artifact can't register a service worker, so the *first* open needs signal (after that it works offline for the session). In a basement gym this matters. Mitigations now: add to Home Screen and keep it open. The real fix is a standalone PWA (own domain, service worker, install manifest/icons) — which also means you'd host it (Vercel/Netlify) and run a database (Supabase). **This is the main architectural fork ahead.** Recommendation: stay on the artifact while features stabilize (zero maintenance, free cloud storage), and revisit only if offline-first becomes a real pain.
4. **In-progress workout isn't cloud-synced** (only on-phone). A dead battery mid-session loses the current workout. Sync the active session to a cloud document as well. *Effort: small.*
5. **Sync is last-writer-wins per document.** Fine for one person; two devices editing the same session simultaneously could clobber. Acceptable for personal use — just don't log the same workout from two devices at once.
6. **Schema versioning** is now stamped (`schema: 1`) with a migration hook — keep every future shape change behind a migration step so old history never breaks.
7. **Accessibility:** add `aria-label`s to the +/− steppers and verify light-mode contrast of the accent on white; tap targets are already ≥44px.
8. **Privacy/security:** the database is organization-internal to your account, no secrets in the client, no third-party calls except the demo video link. Appropriate for a personal app.

---

## 5. Suggested next three sprints

- **Sprint 1 — foundation:** source split + build script; automated engine tests; cloud-sync the active session; undo toast.
- **Sprint 2 — daily use:** saved routines; edit past sessions; warm-up flag; bodyweight setting; per-exercise rest.
- **Sprint 3 — insight:** per-lift trend charts; plan-vs-done weekly bars; library expansion; AI description matching.
