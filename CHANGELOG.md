# Ironlog — Changelog

Versioning: `MAJOR.MINOR.PATCH`. Each published version is labeled in the Artifact version history too.

## v0.22.2 — 2026-09-11 · Internal groundwork, part 1 (Roadmap v5, Phase 0.5-A/B/C)
No user-visible change — this makes the upcoming fixes small and safe. All existing tests pass unchanged; one integrity test added (92 total).
- Test scaffolding now runs against a fixed clock (a Wednesday) instead of the live time, so date/streak tests can't flake depending on the day you run them. Added `history`/`weekly` fixture builders.
- One shared definition of "a session that counts toward progress" (completed, not a deload), used everywhere the app scans your history — instead of the same rule copied in seven places. (progression.js: `real()`, adopted in exerciseSeries/bestE1rmBefore/findPlan/exerciseTenure/progressionStat/personalRecords.)
- Added a safety test that fails if a future exercise is added without its metadata (which would silently mis-tag it). Removed dead code (`isProgressing`) and a duplicated import.

## v0.22.1 — 2026-09-11 · Build hygiene + offline safety (Roadmap v5, Phase 0)
Start of the v5 correctness pass — small, isolated fixes first.
- **Your offline copy can no longer get stuck on an error page.** If a page or icon failed to load (a bad moment during a deploy), the app used to save that failure and keep showing it offline. It now only saves genuinely good responses. (build.js service worker: `cacheable()` guard — skip non-OK/redirected/opaque responses, and the cache write is wrapped in `e.waitUntil`.)
- **Cleaner builds.** The build no longer stamps a timestamp into the page, so rebuilding with no code change produces no phantom diff (and doesn't churn the security hash). (build.js: dropped `new Date().toISOString()` from the bundle header.)
- Removed a security line (`frame-ancestors`) that does nothing inside a `<meta>` tag — it needs a real server header, which GitHub Pages can't set, so it was false reassurance.

## v0.22.0 — 2026-09-11 · Adversarial audit of the builder (Roadmap v4, Phase F — final)
A 10-check adversarial suite attacking every invariant the v4 design relies on. It found and fixed **two real bugs**:
- **Frequency fairness bug (fixed):** `isStalled` looked at the 3 *most-recent* sessions, which for a 3×/week lifter span only a few days — so a high-frequency lifter could **never** trip the 2-week stall requirement and their stalled lifts would never rotate. Now it compares your best in the last ~2 weeks against your best from before that, judging the plateau in *calendar time* — fair across any training frequency.
- **Non-deterministic rotation (fixed):** the replacement for a rotated/anchor-swapped exercise was tie-broken by the build seed, so rebuilding a stalled plan could yield a different swap. Now deterministic (tie-broken by exercise hash) — a rotation isn't a lottery. Verified: 15 builds with random seeds produce one identical plan even with an active rotation.
- **Verified invariants (all pass):** continuity churn (20 builds of a stable plan → identical), "hold what works" (a 10-week progressing lift never rotates), anchor-swap safety (only with stall + deload, same pattern, never dropped), volume ceilings (bump only below threshold, ≤5 sets/exercise, never on a deload), session size/order (compounds first, heavy-axial cap survive reactions), and interaction traps (a swap and a gap-add never both fire; a mid-block modality switch doesn't spuriously rotate).
- 10 new audit tests (91 total). **This completes Roadmap v4** — the builder learns from your data, reacts to the coach, and varies deliberately, all deterministic and with no AI.

## v0.21.0 — 2026-09-11 · Coaching that reads like a coach (Roadmap v4, Phase E)
Coach's Notes no longer repeats the same canned sentences — still with **no AI**, variety comes from your data plus templates.
- **Weekly-rotating wording:** 2–3 phrasings per finding, chosen by hash of (finding + week), so it reads differently next week but is **stable within a week** (no flicker between renders on the same day).
- **Status-aware tone** (built on Phase A's new/persisting/resolved): a *new* issue is stated plainly; a *persisting* one softens to a follow-up ("Still nothing hitting your rear delts…"); and a **resolved** one gets **credit** ("Triceps long head — sorted") shown first as a positive opener. That credit is exactly how the coach acknowledges the builder's reactions worked — and it fades ~a month after the fix.
- **Context from your numbers:** an undertrained muscle that's climbing says so ("up from ~5, keep climbing"), and your real exercise names are woven in.
- Pure phrasing — no algorithm change. Existing string-matching tests were moved to assert the underlying *findings* (the decision), which is the right level after the Phase A split. 6 new/rewritten tests (82 total).

## v0.20.0 — 2026-09-11 · Library expansion (Roadmap v4, Phase D)
The exercise library grows from 77 to **103**, chosen to give the builder *meaningful* choices, not bulk.
- **Variation families:** 2–3 close substitutes per region×pattern (e.g. machine incline press, Pendlay row, neutral-grip pulldown, EZ-bar/concentration curls, machine dip) so a rotation swaps *within a family* rather than jumping movement patterns.
- **Lengthened-position (stretch) movements** — the strongest recent hypertrophy signal — added and tagged `LONG_LENGTH` (incline DB fly, dumbbell/cable pullover, Bayesian cable curl, overhead cable extension, sissy squat, leaning cable lateral…). The builder now gives a small preference to including one stretch-biased option per muscle.
- **Unilateral options** tagged `UNILATERAL` (single-arm cable row/pushdown, reverse lunge, single-leg curl/hip-thrust/calf raise…) — diversifies rotation families and sets up future per-side volume handling.
- **True anatomical gaps filled:** a **glute-medius** region (new, low-priority) with Hip Abduction; 45° back extension for the posterior chain; leg-press & single-leg calf raises; Pallof press & reverse crunch for core.
- No schema break: `RAW`/`META` extended, plus `LONG_LENGTH`/`UNILATERAL` id-sets and the one new `Glutes:medius` region. 4 new tests (77 total); coverage, no-padding and churn guarantees all still hold. (Demo seed data unchanged — it already exercises the reaction system.)

## v0.19.0 — 2026-09-10 · The builder reacts to Coach's Notes (Roadmap v4, Phase C)
The headline feature: "Build me a workout" now acts on the same findings the coach reports — without ever overriding continuity, and still with no AI. `analysis.buildHints()` turns findings into builder inputs; the builder reacts four ways:
- **What to train** — a one-tap **"Coach suggests: …"** nudge on the New-workout screen pre-selects the muscles that are light or unbalanced this week (from `suggestGroups`). Highest-leverage, zero algorithm risk.
- **Which exercise** — candidates that fill a flagged region/pattern gap get a scoring bonus in `pickForGroup` (fresh builds) and are preferred as rotation replacements (`replacementFor`). Fixed when a slot opens, never by reshuffling.
- **How much** — an undertrained muscle in a continued plan earns **+1 set** on one exercise (`volumeBump`), capped at 5 sets/exercise. Self-limiting: the finding clears once weekly volume is adequate, so it accumulates toward the productive range then stops. Never on a deload.
- **Add, don't swap** — a never-covered flagged region gets **one added exercise** if the session is under 7 and nothing else rotated; also self-limiting (once logged, the gap is covered).
- Every reaction carries a plain-English reason, surfaced in the build toast ("added Incline Barbell Press — covers upper chest"). Reactions never trigger a rotation and are deterministic across seeds (churn stays fixed from Phase B). 5 new tests (73 total).

## v0.18.0 — 2026-09-10 · Rotation & progression policy (Roadmap v4, Phase B)
The builder's continuity rules now match the goal — *progress, not variety* — with three research-backed fixes to the mesocycle core (builder.js):
- **Staleness is measured in weeks, not session count.** The old `ROTATE_AFTER=5 sessions` told a 3×/week lifter "time for a change" in under two weeks. Now exposure is tracked by calendar span (`exerciseTenure`), which normalizes by frequency — 8 sessions at 2×/week and 4 at 1×/week are both "4 weeks" of the same movement.
- **A progressing lift is never rotated.** Rotation now fires only on a genuine **stall** — no net e1RM gain across ≥3 performances spanning **≥2 weeks** (the time-span requirement stops short-term noise from reading as a plateau). The old unconditional "hard limit" that swapped a still-improving lift is gone. "Stick with what works" is the default.
- **A stuck main lift can finally be helped.** A stalled **anchor** (≥3 weeks) that a **recent deload didn't unstick** swaps to a same-group, same-pattern tier-1 **variation** (bench→incline, squat→front squat) — never dropping the pattern, and rare by construction (the deload is the gate).
- **Determinism / no churn:** verified on demo data that continuing a plan is now identical across every seed (a churn guard test asserts a stable progressing plan never spuriously rotates).
- Research basis: Baz-Valle 2019 (deliberate variation helps, random variation impairs load progression), Fonseca 2014, block-periodization practice (core lifts held 4–8 weeks); intermediate progress shows over 2–4 weeks → judge stall/staleness in time. 4 tests rewritten/added (69 total).

## v0.17.0 — 2026-09-10 · Findings layer (Roadmap v4, Phase A)
Foundation for the builder reacting to Coach's Notes — no visible change yet.
- **`findings()`** splits *deciding what's true* from *writing the sentence*: it returns typed data (`balance`, `legs-low`, `region-gap`, `pattern-gap`, `volume-low`, `freq-low`, `deload-taken`/`due`, `progression`) that two consumers can read — the coach renders it to text, and (next phase) the builder acts on it.
- **`buildTips()` is now a thin renderer** over `findings()` with byte-identical wording — a pure refactor; every existing analysis test passes unchanged.
- **`withStatus()`** derives **new / persisting / resolved** for each finding by comparing the current 28-day window to the previous one — no new stored state (analyze gained an upper window bound so a shifted `now` reads the right window). This powers "credit when you fix something" and richer phrasing later.
- 4 new tests (66 total); verified in-browser that Coach's Notes is unchanged and status diffing works on real data.

## v0.16.0 — 2026-09-10 · Security hardening
A defense-in-depth pass ahead of a possible store release. No user-facing feature change.
- **Import/sync sanitization (the big one).** All untrusted input — file imports, Dropbox downloads, and the Claude artifact database — is now rebuilt field-by-field from a strict whitelist with every value type-coerced (`cleanSession`/`cleanRoutine`/`cleanSettings` in sync.js). This means a crafted backup can't smuggle HTML/attribute-injection through a "numeric" field, and it's structurally immune to **prototype pollution** (`__proto__`/`constructor` keys are never copied). Also caps array sizes to prevent a malicious file from ballooning memory.
- **Strict Content-Security-Policy** on the site build: `default-src 'none'`, inline scripts pinned by **SHA-256 hash** (no `'unsafe-inline'` for scripts), so even if some untrusted string ever reached the DOM, an injected inline handler (`onerror=`, `onload=`) can't execute. `connect-src` locked to Dropbox's API hosts only.
- **`no-referrer` policy** so the OAuth `code` on the Dropbox return can't leak to the font CDN via `Referer`.
- **Error boundaries** — a bad record can no longer white-screen the app; `render()`/`boot()` degrade to a "Something went wrong · Reload" state with your data intact, plus global `error`/`unhandledrejection` handlers.
- Escaping fix (a recent-session label rendered a name unescaped — CSP already blocked it, now escaped too), `demoURL` crash-guarded for unknown ids, external links get `rel="noopener noreferrer"`.
- **Fitness disclaimer** added in Settings ("general fitness information, not medical advice… train at your own risk") to reduce liability.
- Verified with malicious-import tests in-browser: injection payloads neutralized, no prototype pollution, app boots cleanly under CSP. 62 tests pass.

## v0.15.0 — 2026-09-10 · Progress you can see
Three upgrades to the feedback loop — all from data you already log, no new taps.
- **Per-lift progress trend.** Every exercise's detail sheet now shows a compact sparkline of its best-set estimated 1RM over recent sessions, with the delta (▲ +25 lb) — so "am I getting stronger on bench?" has a one-glance answer. Personal-record rows on the Progress tab are now tappable to open it. Scoped to the lift's current equipment mode, deloads excluded (`exerciseSeries`).
- **Live PR recognition.** Complete a set that beats your all-time best for that lift (same equipment) and a green **★ New PR** line appears right there while you train (`bestE1rmBefore`) — no more PRs quietly slipping into a list unnoticed.
- **Post-workout summary.** Finishing a workout now shows a recap — working sets, volume, and any new PRs — instead of a bare toast (a deload shows a recovery-framed version). A little "here's what you just did" to close the loop.
- Engine: `exerciseSeries` + `bestE1rmBefore` (progression.js). 2 new tests (62 total).

## v0.14.0 — 2026-09-10 · Deload / recovery sessions
Sore or beat up but still want to move? Build a proper recovery session — and the algorithm treats it as recovery, not a setback.
- **A "Deload / recovery session" toggle** on the New-workout screen. With it on, the built (or blank) workout is seeded at **~60% of your last real loads**, reps at the top of the range, with an on-screen coach note: full range, focus on the stretch, stop 3–4 reps shy of failure. (Grounded in the fitness–fatigue model: a brief drop in load lets accumulated muscular *and joint/connective-tissue* fatigue clear while fitness is retained, so overload can resume — standard mesocycle practice, and light long-length work keeps a stretch-mediated stimulus.)
- **Invisible to progression, by design.** A deload never sets a PR, never counts as a stall or regression, and never becomes a progression baseline. `lastPerf`/`suggestion`/PRs/stall-detection/`planWorkout`/`progressionStat` all skip deloads — so your **next real session resumes from your last real one**, and a deload is a transparent pause, not a reset.
- **Recovery shows up in the report.** Deload sessions are badged in history and the active view, still count toward your streak/consistency and volume, and Coach's Notes **acknowledges a recent deload** ("smart — recovery is where the work turns into growth") instead of nagging you to take one; the deload *prompt* now also resets for two weeks after you take one.
- Engine: `deloadSets` (progression.js), deload-aware `seedExercise`/`findPlan`/`exerciseStreak` (builder.js), deload-excluded PRs/progression + recovery-aware coach tip (analysis.js). 7 new tests (60 total). Also pinned a calendar-fragile streak test to a fixed date.

## v0.13.0 — 2026-09-09 · Coaching tune-ups (Roadmap v3, Phase 3)
Two evidence-based, read-only nudges in Coach's Notes — no new logging, no friction.
- **Frequency:** when a muscle is trained with real weekly volume (~6+ sets/week) but essentially in a single session, suggests splitting it across 2 days — ≥2×/week grows a muscle faster per unit of volume than one big session. Only fires once there's a real multi-session history (`readyForComparative`).
- **Deload:** after 6+ unbroken training weeks, a gentle prompt to take a lighter week (about half the sets, same weights) so accumulated fatigue clears before the next block — standard mesocycle practice.
- Engine only (`analyze` now returns `groupFreq`; two tips added to `buildTips`). 2 new tests (54 total).
- Explicitly still out of scope (protecting fast logging): RIR/effort fields and rep-range changes.

This completes Roadmap v3 (remove sets · equipment modality · coaching tune-ups).

## v0.12.0 — 2026-09-09 · Equipment modality (Roadmap v3, Phase 2)
The same movement done with different equipment is now tracked correctly — an overhead press at 25 lb/hand with dumbbells is never compared to 75 on a Smith machine.
- **A modality chip** (`Barbell ▾`) on each logged exercise opens a six-way picker (barbell · dumbbell · smith · machine · cable · bodyweight). It defaults to the exercise's natural equipment and is **remembered** from last time, so the common case (always barbell bench) never shows a decision — invisible until you need it.
- **Progression is scoped to (id, mode):** `lastPerf` / `suggestion` / `nextSets` / stall & progress detection / `planWorkout` / PRs all compare like-for-like. Switch to dumbbells and the "last time" line, prefill and +weight suggestion all follow your dumbbell history, not the barbell one.
- **Weight entry is unambiguous:** in dumbbell mode the weight column reads "Lb ea" and the picker says "enter the weight of one dumbbell."
- **PRs are per-modality** and tagged with the equipment when it isn't the default; cable/machine stacks show **load, not a bogus 1RM** (`e1rm=false`), while barbell/smith/bodyweight keep the e1RM estimate.
- **Optional and inert by default:** `mode` is only stored when it differs from the exercise's native equipment; all existing history derives its mode from `equip` at read time — no migration, and the 47 prior tests pass untouched (52 total now).
- **Deliberately deferred:** equipment-normalized *volume* (e.g. counting a dumbbell as ×2). Applying it would retroactively rewrite historical PR/volume numbers and is ambiguous for one-arm work — it's left for an explicit future opt-in rather than silently changing what you've already logged.

## v0.11.0 — 2026-09-09 · Remove sets (Roadmap v3, Phase 1)
- A **"－ Remove set"** action appears next to "＋ Add set" whenever an exercise has more than one set, and removes the last set — the exact mirror of Add. Chosen over a per-row ✕ because the set-row grid (34px / 1fr / 1fr / 44px) already leaves the +/− steppers little room on a 375px phone; a fifth column would cramp the number fields. Swipe-to-delete was rejected too — it fights the iOS back-gesture on the installed PWA.
- Confirms before removing a set that's already checked done; removes an undone set immediately. **Undo** restores it (toast pattern, same as routine/exercise delete). The control disappears at one set, so an exercise is never left empty (use ✕ to drop the whole movement).
- No engine change — `setPattern`/`nextSets` already handle variable set counts; all 47 tests pass untouched.

## v0.10.0 — 2026-09-09 · Phase 4: mesocycle-aware workout building
"Build me a workout" now builds *toward* progress instead of reshuffling (roadmap #3).
- **Continue, don't rebuild.** Picking muscles you trained within the last 10 days continues that session's exercise list (with Phase 3's progressed weights) — the button itself says *Continue your plan · Session 3 · 5 exercises from Tuesday*, with *Build a fresh plan instead* as the deliberate escape hatch. Matching tolerates one incidental add-on exercise from another group.
- **Deliberate rotation, one movement at a time, never the anchor.** A non-anchor exercise rotates when it's *stalled* (3+ performances, best e1RM not improved across the last two sessions — exactly when a variation helps) or *stale* (5+ consecutive sessions and not currently earning load bumps; 8+ regardless). Stalled beats stale; at most one swap per session; replacement is same group, same region/pattern preferred. The toast names the swap and why.
- **No new persisted state — by design.** The session history *is* the plan: the plan for a muscle combination is the most recent matching session, and streaks/stalls are derived by walking history. It syncs via the existing session merge for free, adds no schema, and can never drift from what was actually done.
- Engine: `planWorkout`, `findPlan`, `exerciseStreak`, `isStalled`, `isProgressing`, `replacementFor` in `src/engine/builder.js` (design comment there). 6 new tests (47 total).

## v0.9.0 — 2026-09-09 · Phase 3: pattern-aware progressive overload
The overload engine now understands how you actually structure sets (roadmap #2).
- **Pattern detection** (`setPattern`): flat straight sets, ascending ramps, descending top-set-plus-back-offs, or mixed (pyramids). One rule covers all of them: the heaviest working set(s) are the *anchor*, and only the anchor decides whether to add load. Where the max sits determines the pattern; the pattern only changes how the other sets are carried.
- **Prescription** (`nextSets`, double progression): every anchor set at the top of the rep range → anchor gets one plate increment and its reps reset to the bottom of the range; non-anchor sets shift *proportionally* (same ratio to the anchor, rounded to the plate grid, never below last time, never above the anchor) so a ramp keeps its shape. Anchor short → last time carried forward verbatim as the target, with the message stating exactly how many anchor reps were missing ("2 more reps on your top set earns +5lb"). Below the range → "stay at X and own it". Bodyweight-only → progress by reps.
- **Prefill:** new sessions and added exercises are seeded with the prescription instead of a stale copy of last time. The card explains what was done and offers a one-tap **Keep last** revert until a set is marked done. The old uniform "+5 to every set" button is gone — it was wrong for anything but flat sets.
- **Last-time display** (`fmtPerf`): flat work reads `3×8/8/8 @ 135lb`; ramped work reads `135→155→185lb · 10/8/6` so you can see the shape.
- 6 new engine tests (42 total).

## v0.8.10 — 2026-09-09
**Confirmed fixed on device.** The tab bar saga (v0.8.0–v0.8.10, spanning sticky/fixed/flow/dvh positioning attempts, a colour-seam theory, and finally on-device instrumentation) is closed.
The v0.8.9 launch timeline identified the trigger: `4ms deficit 62 · nudge scroll · nudge meta · touch · tab today` all did nothing; `1413ms tab history → 1449ms deficit 0`. History is the first tab whose content is taller than the 894px launch viewport, i.e. the first time the document becomes scrollable — that is what makes WebKit recompute the viewport. Today is shorter than 894px and never triggers it; a one-frame nudge wasn't long enough for the round trip.
- **Fix:** in the installed app the document is kept at least `screen.height` tall. In the launch state that makes it 62px taller than the viewport, which triggers the correction within ~40ms of first paint; once corrected the viewport equals the screen so nothing is scrollable and nothing changes. Removed the one-frame scroll/meta nudges.
- The tab-switch "flicker" was the correction landing (labels appearing); with the correction at boot there is nothing left to land.

## v0.8.9 — 2026-09-09
v0.8.8's compositing change did not bring the labels back, which is itself informative: below the short launch viewport WebKit paints only solid layer colours, never real content. So the labels cannot be drawn there; the only fixes are to stop depending on JS timing for the bar's position and to make WebKit's correction happen at boot.
- **Flicker:** in the installed app the tab bar is now anchored by its *top* to `screen.height` (a constant, exposed as `--screen-h`) rather than to the viewport bottom. Its screen position is identical before and after the correction with no JS in the loop.
- **Labels / launch state:** a second, stronger boot-time kick — rewriting the viewport meta for one frame, which makes WebKit recompute viewport geometry the way a rotation does — scheduled alongside the scroll nudge at 0/120/400/800ms.
- **Launch timeline in Settings:** logs the deficit at boot, each nudge, first touch, tab switches and the moment the deficit clears, so the next report shows exactly which event fixes it.

## v0.8.8 — 2026-09-09
v0.8.7 confirmed on device: bar in the right place on every tab, `deficit 0` after correction. Two leftovers, both consequences of the launch deficit state:
- **Tab labels missing on Today at launch.** The icons were drawn but the labels sit below the 894px launch viewport, and only composited layers get painted in that overflow region (which is exactly why the parked sheet, with its `transform`, was visible there). The tab bar and rest bar now carry `transform:translateZ(0)` so they are composited and paint fully below the line.
- **Light flicker on tab switch.** Switching tabs scrolls to top, which is what triggers WebKit's viewport correction; for up to 150ms the bar was offset by a now-stale 62px. The deficit is now checked every animation frame (one subtraction — free) and on `scroll`, so it can never be stale beyond the frame the correction lands in. Also, at boot the app nudges the scroll position by 1px and back (document made scrollable for one frame) to try to make WebKit correct itself before the first paint the user sees.

## v0.8.7 — 2026-09-09
First version built from real on-device numbers (the v0.8.6 Settings readout: `screen 440×956 · inner 440×894 · inset top 62`, iPhone Pro Max, installed PWA). They overturned v0.8.6's colour-seam theory.
- **What the numbers say.** The layout viewport at launch is 894px on a 956px screen — short by 62px, which is the *top* inset (Dynamic Island), not the 34px home-indicator inset. WebKit subtracts the status-bar height from the bottom of the viewport until a later native layout pass (usually the first scroll) corrects it. `env()` itself is fine: the tab bar's icons in the screenshot sit at exactly the pixel a bar anchored to a 894px viewport with a 34px inset would put them. And the white strip under the bar was the *closed bottom sheet* — parked at `translateY(101%)` just below the viewport, in the overflow region iOS still paints at launch.
- **Fix:** in standalone mode only, measure the shortfall directly (`screen.height − innerHeight`, a number that is available at all times and needs no timing luck) into `--deficit`, and push every fixed-bottom element down by it: tab bar, rest timer, toast, sheet and scrim. Re-measured on resize / visualViewport resize / pageshow / visibility / focus, plus a light poll (150ms for the first 10s, then 1s) because WebKit's correction fires no event. When WebKit corrects itself the shortfall reads 0 and nothing changes on screen, because the bar's bottom edge was already at the true screen bottom. Browser tabs and the Claude artifact are untouched (there `innerHeight` legitimately excludes toolbars/chrome).
- Closed sheet is now `visibility:hidden` (after its slide-out), so it can never show through that overflow region again.
- Diagnostics readout fixed (the probe's `height` was clamped by border-box sizing to the top padding — that's why it printed "bottom 62"); now also prints the measured deficit.

## v0.8.6 — 2026-09-09
The tab bar, done from the mechanism up rather than by trying another positioning scheme.
- **What was actually happening.** On iOS (standalone PWA and the Claude app's WKWebView alike) a freshly launched page is first laid out with the safe areas applied as an *inset* — the viewport is shrunk to the safe rectangle and `env(safe-area-inset-*)` reads 0 — and only at a later native layout pass (typically the first scroll) does it flip to full-bleed with real insets (WebKit bug 191872; the Cordova report's launch `innerHeight` of 818 vs 896 after correction is exactly 44 + 34, the two insets). In the inset state the 34px strip under the home indicator is *outside the viewport*: nothing can paint there, WebKit fills it with the canvas colour. So a white (`--surface`) bar sitting correctly at the viewport bottom showed a grey (`--bg`) strip beneath it — a colour seam, not a positioning error. That is why sticky, fixed, flow and dvh all "half-worked": every one of them put the bar in the right place.
- **Fix:** make the layout invariant across both states so the flip is invisible. The bar is `position:fixed; bottom:0` again (so it stays visible on long tabs — the v0.8.4 trade-off is reversed), painted opaque `--bg` instead of `--surface`, with `padding-bottom: env(safe-area-inset-bottom)`. Inset state: bar bottom 34px above the screen edge, 0 padding. Full-bleed: bar bottom at the screen edge, 34px padding. The icons land on the same screen pixel either way and the padding region is the same colour as the strip it replaces. `html` and `body` both carry `--bg` explicitly so the un-paintable strip is a known colour. Body `padding-bottom` tracks the bar with the same `env()`, so content clears it in both states. No timers, no JS measurement, no dvh.
- Settings now shows a one-line layout readout under the version (screen/inner/visual viewport size and measured top/bottom insets) so any future report comes with numbers instead of guesses.

## v0.8.5 — 2026-09-09
v0.8.4 removed too much: without any min-height, the tab bar sat right after content with nothing pushing it down on short screens — correct in principle, but looked broken (nav floating above a large dead patch of empty space instead of settling at the bottom). User confirmed on the installed PWA specifically, calling it worse than before.
- **Fix:** brought back `body{display:flex;flex-direction:column;min-height:100vh;min-height:100dvh}` with `#view{flex:1 1 auto}` — but the tab bar itself still has zero position rule (no fixed, no sticky), so it's still immune to the WebKit viewport-metrics bug that started this whole saga. What changed is *why* it sits at the bottom on short screens: not because it's pinned there, but because `#view`'s flex-grow naturally fills whatever space is actually available and pushes the bar down after it — a mechanism that degrades gracefully even if `min-height` itself is imprecise (worst case a small sliver, never a large gap), since flex-grow works off whatever height flex-column computation actually resolves to, not off requiring that number to be exactly correct.
- Confirmed in testing: settles flush on short screens, still scrolls correctly with the bar reachable at the end on tall ones (Library, Progress).

## v0.8.4 — 2026-09-09
The actual, final fix for the tab bar gap — confirmed and closed out. v0.8.2's `position:fixed` did NOT fully solve it either: the user confirmed it still gapped on first launch of the installed standalone PWA (a third context, distinct from both the Claude app and a plain Safari tab), and — critically — confirmed the gap self-corrects after visiting a scrollable tab, in *both* the Claude app and the standalone PWA. That matching self-correction pattern in two independently-tested contexts confirms both `sticky` (v0.8.0/.1) and `fixed` (v0.8.2) were failing for the exact same reason: both anchor to the same native viewport concept that WebKit bug 191872 documents as unreliable at launch, so no CSS positioning scheme built on it was ever going to be reliable.
- **Fix:** the tab bar is no longer positioned at all — plain normal document flow, immediately after the page's content. Normal flow has no viewport-relative dependency to get wrong; it just follows real, locally-measured content height. This is the one approach that's structurally immune to this entire bug class.
- **Trade-off, deliberate and confirmed with the user first:** on tabs taller than one screen (Library, Progress) the tab bar now scrolls out of view like the rest of the page instead of staying persistently pinned at the bottom — the cost of a bar that is simply never wrong, versus three previous attempts that each looked right in some contexts and wrong in others.
- Also removed the now-unused `--vvh`/`window.visualViewport` measurement code entirely (nothing depends on it anymore) and the `min-height` chain on `body` (unnecessary — confirmed the browser's own canonical canvas-background-propagation behavior already paints the full screen with the page's background color regardless of content height, entirely at paint time, so it's immune to this bug class too).
- Fixed a real, separate small bug found while debugging this: the header's short cloud-status text showed the identical word "Backed up" for both the Claude artifact and a connected Dropbox account, which caused genuine confusion mid-investigation (a Dropbox-synced PWA was mistaken for the Claude artifact). Dropbox now shows "Synced" instead.

## v0.8.3 — 2026-09-09
Fix for the installed home-screen PWA getting stuck on an old version after a deploy (separate issue from the tab bar saga above — this is specific to `docs/` / GitHub Pages, not the Claude artifact).
- **Root cause:** the offline service worker cached everything, including the app's own HTML document, cache-first with no revalidation — once cached, it would never check the network again for a newer copy, so an installed PWA could get stuck on whatever version happened to be cached the first time, indefinitely, even while online. That's exactly what happened: stuck on v0.8.1 through two full app force-quits.
- **Fix:** network-first specifically for the HTML document (the one thing that must never go stale while online — the whole app is a single self-contained file, so a fresh document *is* a fresh app), falling back to the cached copy only when genuinely offline. Static assets (icons, manifest) stay cache-first since those rarely change and don't need revalidating. Future version bumps will now be picked up automatically on next launch while online, no manual cache-clearing needed.
- **To unstick a PWA already stuck on an old cached version right now:** iOS Settings → Safari → Advanced → Website Data → find the site → swipe to delete, then remove and re-add the home-screen icon. That forces a fully clean install; going forward this class of staleness shouldn't recur.

## v0.8.2 — 2026-09-09
v0.8.1's fix wasn't enough either — real-device follow-up: tab bar was flush on Today/History at first launch, misaligned, but visiting Library and Progress corrected it — permanently, even back on Today/History. That specific pattern (wrong until a real scroll happens, then fixed everywhere from then on) pointed at something more specific than a timing/staleness issue, so before patching again this was researched properly rather than guessed at a second time.
- **Root cause, confirmed:** this is a known, unresolved native WebKit bug (bugs.webkit.org #191872) — inside an embedded WKWebView specifically, `env(safe-area-inset-*)` and related viewport metrics stay wrong until an *arbitrary, undeterminable* point after load, sometimes only after the WebView's internal scroll view performs a real layout pass. There is no confirmed JS-only way to force that correction — it's native-side, and this app can't touch the host app's native code.
- **Fix — a different strategy, not another timing patch:** stop trying to measure the broken metric at all for the one thing that actually matters (the tab bar's own position). The tab bar is back to `position: fixed` (not sticky, not flex-derived) — anchored straight to the viewport edge by the browser engine, completely independent of the buggy body/viewport-height measurement. `min-height`/`--vvh` stay on `body` only as harmless cosmetic polish for short screens, no longer load-bearing for anything visible. The classic "fixed bottom bar jumps as Safari's address bar auto-hides" bug this originally moved away from doesn't actually apply to this app's real delivery contexts anyway — the Claude iOS app's WKWebView and an installed standalone PWA both run with no address bar to begin with.
- Verified: tab bar position measured identical (812px, flush) across all four tabs, before and after scrolling, in a fresh reload — with a mechanism that no longer depends on the one measurement confirmed unreliable on-device.

## v0.8.1 — 2026-09-09
Fix for the tab bar still being inconsistent after v0.8.0 (confirmed by real-device screenshots: flush on short tabs like Today/History, a visible gap below it on taller/scrolled tabs like Progress/Library).
- Root cause, confirmed against WebKit's own bug tracker: `100dvh` is unreliable inside an embedded WKWebView specifically (the Claude iOS app renders Artifacts in one) — WebKit bugs 170595 and 261185 document real, shipped bugs where the viewport-height calculation gets "baked in" at a stale/mid-animation moment and doesn't reliably recompute afterward, unlike stock Safari. Since this app is a single-page app where `<body>` never reloads (only `<main>`'s content swaps between tabs), a stale snapshot from whenever a given tab last happened to reflow could persist indefinitely — explaining why it was tab-dependent rather than uniformly broken.
- Fix: measure the real visible height directly with `window.visualViewport` (built on more reliable lower-level WebKit machinery than the `dvh` CSS unit) and drive the page's height from that instead — a JS-set `--vvh` custom property, re-synced on every viewport resize/scroll event, on every app render (i.e. every tab switch and in-app navigation), and via a couple of delayed re-checks after load to catch the WKWebView's own native layout still settling after first paint. `100vh`/`100dvh` remain as CSS-only fallbacks for the instant before JS runs.
- Verified the fix mechanism directly in a live page: setting `--vvh` immediately and correctly cascades through to `body`'s height and the sticky tab bar's position.

## v0.8.0 — 2026-09-09
Roadmap v2, Phase 2 — iOS usability pass. Full plan in `ROADMAP-v2.md`.
- **Fixed:** rapid taps on the weight/rep +/- steppers could trigger iOS Safari's double-tap-to-zoom gesture, zooming the whole page. Added `touch-action: manipulation` document-wide — kills the double-tap-zoom gesture everywhere while still allowing normal panning and pinch-zoom-out for accessibility.
- **Fixed:** odd rubber-band bounce/reveal at the top and bottom of the screen. Added `overscroll-behavior-y: contain` to the page, plus `overscroll-behavior: contain` on the bottom-sheet's own scroll area so scrolling to the end of a sheet doesn't also start scrolling the page behind it.
- **Fixed:** the bottom tab bar sat in a different spot depending on which tab you were on. Root cause: it was `position: fixed`, which iOS Safari positions relative to a "layout viewport" that can be taller than what's actually visible while the address bar is showing — a well-known Safari quirk where fixed bottom bars visibly shift as the address bar auto-hides/shows during scroll, so a short tab (address bar stays visible) and a long, scrolled tab (address bar hides) rendered the bar in different places. Rewrote the page as a flex column with the tab bar as `position: sticky` — sticky elements follow normal document flow instead of that ambiguous viewport math, so the bar now settles at the same true bottom edge on every tab, confirmed identical (812px in testing) on both a short empty screen and a long scrolled one, before and after scrolling.

## v0.7.0 — 2026-09-09
Roadmap v2, Phase 1 — correctness fixes from first real-world use. Full plan in `ROADMAP-v2.md`.
- **Fixed:** the "suggested" exercise at the bottom of a workout could recommend a movement from a muscle group not even in your session (e.g. a press suggested on a pull day) — this came from a session-level push/pull "balance" bonus that ignored group membership entirely. Removed it; suggestions are now always restricted to muscle groups already in the workout. Push/pull balance is a multi-week concern and stays in Coach's Notes, where it belongs.
- **Fixed:** Coach's Notes could deliver comparative verdicts ("you press more than you pull", "legs are undertrained") after a single lopsided session. Those now require real history — **at least 4 distinct sessions spread across at least 10 days** — before they appear. Before that threshold, you get an honest "log N more sessions" message plus whatever per-muscle tips (region/pattern gaps) are already individually meaningful — the report genuinely gets richer as your history grows, instead of jumping straight to full judgment on day one.
- **Fixed:** volume read as "10k lb", which reads like an ambiguous unit rather than a number. Session/week volume now shows full comma-formatted numbers ("12,480 lb") up to 99,999 — far more readable for weight-room numbers than an abbreviation — and reserves "k"/"M" for numbers actually too long to read at a glance. Tap the ⓘ next to any "Volume" label for a one-line explainer of what it means.
- **Added:** a **Forearms** muscle group — Wrist Curl, Reverse Wrist Curl, Reverse Curl, Farmer's Carry, Wrist Roller — fully wired into the smart builder, search, and coaching analysis like every other group.
- **Added:** 5 more exercises broadening thin spots in the library — Nordic Hamstring Curl, Step-Up, Chest-Supported Row, Rack Pull, Landmine Press.

## v0.6.2 — 2026-09-09
- Bumped version to force the service worker to refresh cached clients (the Dropbox-key config change in the previous commit didn't bump the version, so the offline cache didn't know to invalidate itself).
- Moved "Cloud backup" higher in Settings, right under Units, so the Connect Dropbox button doesn't require scrolling past the rest-timer options to find.

## v0.6.1 — 2026-09-07
Shareable demo + fixes from reviewing the app with real-looking data.
- **Demo build** (`dist/demo.html`): no cloud database (so it can be shared publicly), seeded on first open with ~5 weeks of a progressive push/pull/legs rotation, routines and a bodyweight. Each viewer keeps their own copy; Settings has "Reset sample data".
- Coaching: "legs undertrained" now needs a real 3:1 skew (2:1 is normal on push/pull/legs); the weekly-volume tip counts secondary-muscle work at half credit (a press trains triceps too) and skips core/calves.
- PRs: compound lifts first by e1RM; isolation shows best set only (an estimated 1RM for a calf raise is meaningless); bodyweight moves read "Bodyweight × 10".
- Library: the "+" on a row adds straight to today's workout; chip rows no longer show a scrollbar on desktop.
- Settings: bodyweight steps by 2.5 lb / 1 kg and the value is tappable to type; calendar month arrows are bigger; sheets are centered at a sane width on large screens.

## v0.6.0 — 2026-09-07
Structural overhaul + feature sprint.
**Structure**
- Source split into `src/` modules (data · engine · app), assembled by `build.js` into two targets: `dist/app.html` (Claude Artifact) and `docs/` (standalone GitHub Pages PWA).
- **33 unit tests** (`npm test`, node:test, zero dependencies) lock in the smart behaviour: region/pattern coverage per muscle, foundational anchors, progression continuity, ordering invariants, the spinal-load cap, set prescription, suggestions, coaching tips, warm-up/bodyweight handling, sync/tombstone merging, unit round-trips, search.
- Engine modules are pure (take sessions in; no DOM/state), which is what makes them testable.
- Standalone site build: installable PWA with **offline service worker**, web manifest, generated app icons, iOS full-screen meta, and an "Update ready" toast when a new version deploys.
- **Cloud backends are pluggable**: Claude DB (artifact), **Dropbox** (site — OAuth PKCE in-browser, one JSON file in the app folder, multi-device merge with deletion tombstones), or on-device only.
- Schema stamp + migration hook; deletions tracked with 90-day tombstones so no device resurrects a deleted workout.
**Features**
- **In-progress workout is cloud-synced** (survives a dead battery / continues on another device).
- **Undo** for delete session, discard workout, remove exercise, delete routine.
- **Edit past sessions** (History → session → Edit): same editor as a live workout.
- **Warm-up sets**: tap a set number to mark it "W" — excluded from PRs, volume, suggestions and analysis.
- **Bodyweight setting**: pull-ups, dips and push-ups now carry real load in volume and e1RM.
- **Saved routines**: save any workout (live or past) by name; load it in one tap from the start screen; delete with undo.
- Smart suggestion: a session with pressing and *no* pulling now always suggests a pull first.
- Unit conversion resolution refined (kg 0.1 / lb 0.25) so lb↔kg round-trips exactly.

## v0.5.0 — 2026-09-07
Algorithm review & refinement for max performance + data-integrity fixes.
- **Lift tiers.** Every exercise tagged 1 (foundational), 2 (secondary/key accessory), 3 (finisher). The session anchor is always a tier-1 lift on the muscle's *key* pattern — no more upright-row shoulder anchors or deadlift-as-back-filler.
- **Progression continuity.** If you have history on a foundational lift for that muscle, the builder anchors on the *same* lift so progressive overload compounds week to week; accessories are what rotate (small penalty for repeating last session's accessories).
- **Complementary patterns.** New `IDEAL_PATS` per muscle: hamstrings get hinge **and** curl, quads get squat **and** lunge (+ isolation), back gets vertical **and** horizontal pull. Lower body no longer uses fake "regions."
- **No padding.** The filler loop stops when nothing adds real coverage; duplicate isolation (fly + crossover) is penalised; a different-equipment compound variant is allowed; ties prefer loadable equipment over bodyweight.
- **Safety cap.** Max two heavy barbell squat/hinge lifts per session (spinal load/recovery); extras swap to a non-barbell variant. Hip thrust exempt (loads hips, not spine).
- **Set prescription.** New exercises start with a real plan: main lifts 4 sets, other compounds 3, isolation 3, finishers 2 — reps prefilled at the bottom of the target range.
- **Honest finish.** Untouched prescribed sets are dropped on save; sets with a weight (or reps on bodyweight moves) count as performed.
- **Suggestions & coaching** now understand pattern pairing ("your hamstrings work has no hip hinge — pair it with RDL") and never suggest niche moves to fix push/pull balance.
- **Bug fix — unit switch.** Switching lb↔kg previously just relabelled numbers, silently corrupting history and PRs. Now converts every stored weight (nearest 0.25, round-trips cleanly) after confirmation.
- Schema version stamped on sessions (`schema: 1`) with a migration hook at boot.

## v0.4.1 — 2026-09-07
Sharper exercise ordering for whole-session performance.
- Ordering now scores each lift by movement demand **plus loadability** (barbell compounds lead their tier) and leads with your **focus muscle's** key lift — not just compound-before-isolation.
- Added **"Auto-order for best performance"** on the workout screen (3+ exercises) so manually built workouts get the same smart ordering.

## v0.4.0 — 2026-09-07
Smart workout intelligence + effectiveness analysis.
- **Region/pattern metadata** added to every exercise (which head/part of the muscle it emphasizes + its movement pattern).
- **Intelligent workout builder** — instead of random, picks a compound anchor then fills to comprehensively cover a muscle's regions (e.g. upper/mid/lower chest, front/side/rear delts) and varies movement patterns; avoids stacking too many heavy compounds; orders big lifts first for safety.
- **Dynamic complementary suggestions** — a "Suggested" pick on the workout screen and a "Smart picks" section in Add-exercise, computed from what you've already chosen (fills region gaps, adds new movement angles, balances push vs pull).
- **Effectiveness analysis in Progress** — Push/Pull and Upper/Lower balance bars plus "Coach's notes": push/pull imbalance, leg neglect, uncovered muscle regions, weekly-volume adequacy (10+ sets/week landmark), and a monthly progression read (how many lifts are trending up).

## v0.3.0 — 2026-09-07
Rest timer + customization.
- **Rest timer** that auto-starts when you complete a set (toggleable). Sticky countdown bar with progress, +15s, and Skip.
- **Between-set alert** — sound beep + phone vibration (Android) + optional on-screen "Go!" and phone notification banner when rest ends. Works while the app is open (iOS blocks background/locked-screen alerts for web apps).
- **Customizable in Settings:** auto-start on/off, sound on/off, phone notification on/off, and separate rest lengths for big lifts (default 2:00) vs isolation (default 1:15).
- Note on Apple Watch/Health: not possible from a web app (Apple gates HealthKit/WorkoutKit to native App Store apps). Documented in-app guidance to run an Apple Watch workout alongside for rings/heart-rate.

## v0.2.0 — 2026-09-07
UX/UI overhaul based on first-round feedback.
- **New home screen.** Today tab now opens on a dashboard (greeting, week stats, streak, last session, quick links) instead of dropping straight into workout setup.
- **Navigation fixed.** Added a back button on the workout screen and a dedicated "Start a workout" flow — you can leave a workout and come back to it.
- **Resume workout.** An in-progress workout now shows a "Resume your workout" card on the home screen; leaving the screen no longer strands you.
- **Discard now works.** Replaced the browser `confirm()` dialog (blocked inside the app sandbox) with a custom in-app confirmation. Same fix applied to "Delete session."
- **Watch demo now works.** Replaced blocked pop-up calls with real links that open the demo video reliably.
- **Tap an exercise** in a workout to open its details/instructions in a slide-up sheet.
- Added a visible version number in Settings.

## v0.1.0 — 2026-09-07
Initial build (Phase 1).
- Muscle-group workout builder + recommendations.
- 67-exercise library with fuzzy "type a description" search.
- Fast set logging with weight/rep steppers.
- Progressive-overload autofill (prefills last session, suggests increases).
- Calendar history + session detail.
- Progress: weekly volume chart, PRs (e1RM), streak, sets-by-muscle.
- Local-first storage synced to cloud database; file export/import backup.
