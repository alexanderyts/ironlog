# Ironlog — Roadmap v7: "Hold up over years"

Source: `REVIEW-v0.41.md` (adversarial review, 2026-09-13; finding numbers below are its numbers).
Written to be executed phase by phase by Claude (Opus 4.8). Read this whole file before starting a phase.

## How to work this roadmap (same rules as v6 — do not relax them)

- **One phase = one version bump = one commit = one push = republish BOTH artifacts with `url`
  + update memory.** Version pattern: A→v0.42.0, B→v0.43.0, C→v0.44.0, D→v0.45.0, E→v0.46.0.
  A hot-fix inside a phase is a patch (v0.42.1).
- **Testing standard.** Every behavioural change needs an ORACLE test (the expected value computed by
  hand in a comment before the assertion) and a CONTROL (the same input with the lever/fix off, or an
  adjacent input that must NOT change). Completion-only tests ("it ran", "is an array") are not
  acceptable as the sole assertion. For anything the user SEES, the oracle must be at the row/screen
  level via `test/ui-harness.js` (`launch()` → `h.state, h.S, h.IL, h.click, h.$, h.$$, h.text,
  h.bodyText, h.has, h.win`), not only at the helper. Run `node build.js` before UI tests — they boot
  the built bundle.
- **Test helpers:** `const {IL,session,set,history,weekly,NOW}=require('./test/load.js')` — require it
  FIRST (it overwrites `globalThis.IL`). `NOW` = Wed 9 Sep 2026 12:00 local. `session(daysAgo, [[id,
  [set(w,r),…]],…], {now, deload})`, `history(...)` sorts newest-first, `weekly(exs, weeks, {now,
  every, start})`.
- **Before editing, run the suite and the real-data snapshot** (`node --test test/*.test.js`; the
  snapshot test in `test/review-snapshot.test.js` runs when `data/*.json` fixtures exist). A phase that
  changes coach output MUST say in its changelog line that the snapshot changed and why, and update
  the `.expected.txt` deliberately with `--update`.
- **Locked decisions (never relitigate):** no AI model; deterministic rules only. A deload never feeds
  progression / PRs / builder / stall / tenure, at any load, and the app never assumes why someone
  deloaded. The app never auto-ends a workout. Profile levers default to Balanced = unchanged
  behaviour. The iOS tab-bar / safe-area layout (v0.8.6) is an invariant — no sticky bars above the
  tab bar, no body-padding model changes beyond what a phase below names explicitly.
- **Style:** match the surrounding code — dense single-line functions where the file does that, a
  comment that says WHY above anything non-obvious, plain-language changelog with a
  "Not verified on-device:" line. Complexity is a cost: prefer one shared predicate over two copies
  (see `profileAllows`). Never widen a function's contract silently — new behaviour behind a new
  option or a new parameter with the old default.
- **Git:** `git -c user.name="Alexander" -c user.email="alexander.yts@gmail.com" commit`, trailer
  `Co-Authored-By: Claude <model> <noreply@anthropic.com>` per the session's attribution reminder.
  Artifacts: app `https://claude.ai/code/artifact/edf1bb41-a9fb-4c1c-ad7c-fea91b5f86ad`, demo
  `https://claude.ai/code/artifact/a37aeb71-6fe4-46fa-85b4-36795020e840` — republish from
  `dist/app.html` / `dist/demo.html` with `url`.

---

## Phase A — Trust: nothing is lost silently  (v0.42.0 · data · findings #1 #2 #19 #20 #21)

### A1 · Storage full must not lose the finished workout (#1)
`src/app/store.js` `lsSet` (line ~11) currently `try{localStorage.setItem(k,v)}catch(e){}`.
- Make `lsSet(k,v)` return `true` on success, `false` on any throw. Add `state.storageError` (boolean,
  not persisted).
- Every caller that persists the sessions blob (`upsertSession`, the merge path in `absorbRemote`,
  `deleteSession`, `convertUnits` save) checks the return. On `false`: set `state.storageError=true`,
  `emit()`, and **do not clear `state.active` / `il_active`** in `commitFinish` — the finished session
  stays in `state.sessions` in memory AND remains the active workout on disk, so a reload can't lose
  it. Concretely in `src/app/ui-bind.js commitFinish`: after `S.upsertSession(s,false)`, if
  `state.storageError` then keep `state.active=s`, `S.persistActive()`, toast (persistent, not 6 s)
  "Couldn't save on this phone — storage is full. Export a backup from Settings.", and return before
  `showSummary`.
- Header cloud badge (`ui-core.js` / wherever "On this phone / Backed up / Sync problem" is rendered):
  when `state.storageError`, show "Not saving — storage full" in `--warn`.
- Settings sheet: under Export, a line "Storage used: 1.2 MB" (sum of `localStorage` item lengths ×2
  bytes / 1e6, one decimal) so the user can see it coming.
- **Tests (ui.test.js):** (a) stub `h.win.localStorage.setItem` to throw for key `il_sessions` only;
  build, tick a set, Finish → assert `h.state.active` is still the session, `il_active` still holds it,
  the toast text contains "storage is full", `h.state.sessions` has it in memory, no summary sheet.
  Reload the harness state via `S.load()`/`launch()` with the same storage → the workout resumes.
  (b) CONTROL: without the stub, Finish clears active and shows the summary (existing behaviour).

### A2 · Dropbox uploads every change, not only sessions (#2)
`src/app/store.js` `syncNow` line ~199: `let pushNeeded=state.dirty.size>0;`.
- Add a persisted flag `il_pushPending` (`lsGet/lsSet`, boolean). Set it to `true` in `pushSettings`,
  `pushRoutine`, `pushActive`, `deleteSession`, `deleteRoutine` (every place that today only calls
  `schedule()`).
- `let pushNeeded=state.dirty.size>0||pushPending;` After a successful `D.upload`, clear the flag
  (`pushPending=false; lsSet(...)`). If upload throws, leave it set.
- `exportPayload` already includes settings/routines/deleted/active — verify `active` is in the
  payload; if not, add it (the v0.29 "survives a dead battery" promise depends on it).
- **Tests (sync/ui):** with a fake Dropbox adapter (`D` object with `getMetadata/download/upload`
  spies — the harness lets you replace `IL.cloud`/adapter; find where `D` is bound): change
  `settings.profile` → next `syncNow` uploads (spy called once) with the profile in the payload;
  delete a session → uploads with the tombstone. CONTROL: with no change at all, `syncNow` does not
  upload (`upload` spy not called).

### A3 · A ticked set with no weight (#19)
`src/app/ui-bind.js` set-check handler (~line 252) and `src/engine/progression.js finalizeSets`.
- On ✓ when the exercise's `equip!=='Bodyweight'` and the weight input is blank (`''`): do not mark
  done; focus + select the weight input; toast "Add a weight first" (short). Bodyweight moves: unchanged.
- `finalizeSets`: additionally drop sets where `equip!=='Bodyweight' && !(+st.w>0)` (keeps 0-rep
  guard). This is the belt for imported/edited data.
- **Tests:** ui: new-user build, tick set 1 with blank weight → set not done, weight input focused,
  toast present; type 100, tick → done. CONTROL: push-up (bodyweight) ticks with blank weight.
  progression: `finalizeSets([{id:'barbell-bench-press',sets:[{w:'',r:6,done:true}]}])` → `[]`;
  same for `push-up` → kept.

### A4 · Import stamped in the other unit (#20 first half)
`src/engine/progression.js convertSessions` (~262) sets `updatedAt=now` on every session.
- Keep the backup's `updatedAt` on conversion. Only the VALUES change; the record is not "newer".
  (The local-toggle path `convertUnits` in `ui-views.js` is a user edit and MAY bump `updatedAt` —
  leave it; make `convertSessions` take `{stamp:true}` for that caller and default to not stamping.)
- **Tests (sync.test.js):** local has `a` deleted (tombstone t=100) and `b` edited at t=200 (w:999);
  import a kg backup containing `a` (updatedAt 50) and `b` (updatedAt 150, w:220.5) → after
  `parseImport`+merge, `a` stays deleted and `b` keeps 999. CONTROL: same import in the same unit —
  identical result (already true).

### A5 · Sync durability trio (#21)
- `src/engine/sync.js`: `TOMB_KEEP` 90 → 400 days. Test: a tombstone aged 300 d survives
  `pruneTombstones`; aged 401 d is pruned (oracle on both sides of the boundary).
- `cleanSession`: keep `endEstimated` (boolean) when `endedAt` is present. Test: round-trip a session
  with `endEstimated:true` through `parseImport` → still true; with `endEstimated:'yes'` → dropped.
- Settings merge (`store.js absorbRemote` ~103, `Object.assign(state.settings, remote.settings)`):
  when the remote settings are newer (compare the `settingsUpdatedAt` if it exists, else treat remote
  as newer when the file rev changed and local settings weren't dirty), replace with
  `Object.assign({}, DEFAULT_SETTINGS, cleanSettings(remote.settings))` so a removed key (profile
  reset) propagates. Test: local `{profile:{goal:'size'}}`, remote newer with no profile → local
  profile is `undefined` afterwards. CONTROL: local newer → keeps `size`.
- Version gate: `exportPayload` already writes `version`. In `syncNow`, if the downloaded file's
  `version` is newer than `CFG.VERSION` (compare semver as three ints), **do not upload**; set
  `state.cloudError='This phone's app is older than the backup — update the app to sync.'` Test with
  a fake adapter: remote version `9.9.9` → `upload` not called, cloudError set. CONTROL: equal
  version → uploads.

**A ship checklist:** all of the above green; suite count noted; snapshot unchanged (Phase A touches
no coach output); changelog v0.42.0 "Trust: nothing is lost silently"; commit/push/republish/memory.

---

## Phase B — Continuity: the plan and the numbers survive real life  (v0.43.0 · engine · #3 #4 #7 #15 #16 #17 #18 #28 #29 #30)

### B1 · Double progression is not a stall (#3)
`src/engine/builder.js` `recentPerfs` (~289) and `isStalled` (~305).
- In `recentPerfs`, alongside the top weight per performance, record `topR` = max reps among sets at
  that top weight.
- In `isStalled`, after the existing `rTop>oTop → not stalled` guard, add: if `rTop===oTop` and
  `max(topR over recent perfs at rTop) > max(topR over old perfs at oTop)` → **not stalled** (reps
  climbed at the same top weight).
- **Oracle test (audit.test.js or builder.test.js):** weekly dumbbell-row `100×12 → 105×8 → 105×9 →
  105×10` (newest last; use `session(3/10/17/24,…)`) → `isStalled(...)` **false**, and
  `planWorkout(['Back'],…)` has `rotation===null`. CONTROL: `105×8 → 105×8 → 105×8 → 105×8` over the
  same dates → **true** (a truly flat lift still stalls). Second control: `100×12 → 105×8 → 105×8 →
  105×8` → true (the bump alone doesn't earn 3 weeks of grace).

### B2 · The plan survives a deload week and a missed week (#4)
`src/engine/builder.js` `findPlan` (~255), constant `CONTINUE_DAYS=10`.
- Walk **all completed** sessions newest-first with a moving reference `ref` (start `now`). For each:
  if `ref - s.date > CONTINUE_DAYS*DAY` → stop. If `s.deload` → `ref = s.date; continue` (a deload
  advances the window rather than consuming it). Else it's a candidate: match groups as today; on
  match return it; else `ref = s.date` and continue. (A non-matching real session also advances the
  reference — the plan for *these* groups can be the session before it.)
- Add a second window: if nothing matched, repeat the walk with `LAPSE_DAYS=42` and, on a match,
  return it with `plan.lapsed=true`. `planWorkout` passes `lapsed` through; `buildAndStart` in
  `ui-today.js` sets the toast to "Plan continued from N weeks ago — weights kept where you left them"
  (N = round(days/7)). With `lapsed`, **no** volumeBump and **no** rotation/stall check (a returning
  lifter isn't stalled; they were away) — return the ids progressed by `seedExercise` only.
- **Oracle tests:** (a) real Chest+Triceps at −17.5 d and −10.5 d, deloads at −5 and −3 → `mode:
  'continue'`, `lapsed` absent/false, `streak` counts the two real sessions, ids equal the −10.5 d
  session's ids. CONTROL: the same history with the two deloads removed → the −10.5 d session is
  outside the 10-day window, so it lands in the lapse window instead: `continue` with `lapsed:true`.
  The difference between the two proves it is the deloads that advance the reference. (b) one missed
  week: last real −12 d, prior −19 d, no deloads → `continue`, `lapsed:true`, `volumeBump` empty,
  `rotation:null`. CONTROL: last real −45 d → `fresh`. (c) The existing CHURN/HOLD audits in
  audit.test.js and profile.test.js stay green.

### B3 · Deload-due counts from the last deload; streak forgives one week (#7)
`src/engine/analysis.js findings` (~78) and `src/engine/progression.js calcStreak`.
- `deload-due`: `const weeksSince = lastDeload ? Math.floor(sinceDeload/7) : Infinity; const weeks =
  Math.min(streakWk, weeksSince); if(weeks>=6 && weeks%6<2) push {weeks}` — fires at weeks 6–7,
  12–13, … (once per block), never within 6 weeks of a deload.
- `calcStreak`: a single empty week between two trained weeks does not break the streak (two
  consecutive empty weeks do). Document in the comment that this is the "life happens" allowance.
- **Oracle tests** (write the arithmetic in the test comments): 12 weeks PPL with a deload week every
  4th, `now` 22 d after the last deload → `weeksSince=3`, so no `deload-due`. CONTROL 1: the same
  history with all deloads removed → `weeks=streak=12`, `12%6=0` → fires with `weeks:12`. CONTROL 2
  (block cadence): 7 straight weeks, no deload → `7%6=1` → fires; 8 straight weeks → `8%6=2` → does
  NOT fire (the block window closed); 13 weeks → fires again. Streak: weeks trained `[1,1,0,1,1]`
  (oldest→newest) → 4; `[1,1,0,0,1]` → 1; `[1,1,1,1,1]` → 5 (control).

### B4 · Tier-1 lifts are anchors (#15)
`builder.js planWorkout` `anchors` (~373): `new Set([...planAnchor ids, ...ids.filter(id=>EX[id]&&
EX[id].tier===1)])`.
- **Oracle:** plan `[deadlift, pull-up, barbell-row]` with deadlift flat 5 weeks and no back deload →
  `rotation===null`. CONTROL: `lateral-raise` flat 5 weeks in a shoulders plan → rotates (accessory
  behaviour unchanged).

### B5 · Inverted-load exercises (#16)
`src/data/exercises.js`: export `INVERTED_LOAD=new Set(['assisted-pull-up'])` (add
`assisted-dip` if it exists). `progression.js nextSets`: for those ids, `inc=-inc` and floor the new
top at 0; `suggestion()` text for a bump: "Hit top reps — prefilled with 5 lb less assist".
`analysis.js personalRecords`: rank inverted-load lifts by lowest load, label "least assist".
- **Oracle:** assisted-pull-up 60×12×2 → `[{w:55,r:lo},{w:55,r:lo}]`; at 0×12 → stays 0 (floor),
  `bumped:false`, text suggests "try an unassisted pull-up". CONTROL: `pull-up` bodyweight path unchanged.

### B6 · Size goal cap (#17)
`progression.js repRange`: `const cap=Math.max(15,hi); size → [Math.min(lo+2,cap),
Math.min(hi+2,cap)]`.
- **Oracle:** plank `[30,60]` → `[32,60]`; lateral-raise `[12,20]` → `[14,20]`; bench `[5,8]` → `[7,10]`
  (unchanged). CONTROL: `general` → native.

### B7 · Straight style reps (#18)
`builder.js shapeStyle` straight branch: `topR` from the set carrying `w` (same lookup as ramp);
`sets.map(s=>({w, r:(+s.w||0)===w ? s.r : topR, done:false}))`.
- **Oracle:** `200×5 / 180×8 / 180×8` → `200×5, 200×5, 200×5`. CONTROL: `185×8 ×2` → `190×5 ×2`
  after the auto bump (unchanged).

### B8 · Equipment mode from real sessions only (#28)
`builder.js seedExercise`: `lastModeFor` must read `real()` sessions (or take an option
`{realOnly:true}` used here and in `suggestion`), so a deload done on different equipment doesn't set
the instance mode. If the last real perf has a mode different from the derived default, use it.
- **Oracle:** real bench in Smith 225×8 (−10 d), deload barbell 110×8 (−3 d) → instance `mode:'smith'`
  and sets `230×5…`. CONTROL: no deload → identical.

### B9 · Off-grid anchors snap once (#29)
`progression.js nextSets`: `const g=inc/2, off=Math.abs(p.top/g-Math.round(p.top/g))>1e-6; const
newTop=(off?roundTo(p.top,g):p.top)+inc;`
- **Oracle (kg):** top 102.1 → 105 (102.1→102.5+2.5); top 100 → 102.5 (unchanged); microplate 101.25
  (on the 1.25 half-grid) → 103.75. CONTROL (lb): 225 → 230.

### B10 · weekIndex anchored (#30)
`progression.js`: `const W0=weekStart(4*DAY)` (the first Monday after the epoch in local time);
`weekIndex(ts)=Math.round((weekStart(ts)-W0)/(7*DAY))`.
- **Oracle:** consecutive Mondays across 2026-04-05 and 2026-09-27 differ by exactly 1 in every
  zone tested by setting `process.env.TZ` in a child process (`node -e` with `TZ=Pacific/Auckland`,
  `America/New_York`, `Europe/Berlin`, `Asia/Kolkata`). Tue and Thu of one week share an index; Sun
  and Mon differ. Existing weekIndex/weekStart tests stay green.

**B ship checklist:** all oracles + controls green; CHURN/HOLD/anchor audits green; the review
snapshot may change for deload-due/streak — state it; changelog v0.43.0 "Continuity: the plan
survives real life"; commit/push/republish/memory.

---

## Phase C — Coach honesty: it knows your gym, your limits, and when you've said no  (v0.44.0 · #5 #6 #12 #14 #22 #23)

### C1 · Gap-add and coach examples respect the gym (#5)
- `builder.js gapFillExercise`: the `gp.exId` shortcut only if `profileAllows(EX[gp.exId], gp.group,
  profile, sessions)`; replace `profilePool(...)` with a strict
  `.filter(x=>profileAllows(x,gp.group,profile,sessions))` — a gap-add is optional: **drop, never back
  off**. (Contrast with `pickForGroup`, which must never strand a group and keeps the backoff.)
- `analysis.js findings`: pass `profile.gym` into example selection. Add `exampleFor(g,r,allow)` /
  the pattern-gap `EXERCISES.find` a predicate `allow` = `e=>profileAllows(e,g,profile,[])` when
  `profile.gym` is set (import `profileAllows` from `IL.builder` — analysis already requires
  progression; check load order in build.js MODULES; if analysis loads before builder, move
  `profileAllows` to `progression.js` or `data/exercises.js` and re-export). If no example passes,
  **skip the finding** (an unsatisfiable gap is not a gap in that gym). Findings are still typed data —
  no wording change beyond the example name.
- **Oracle tests (profile.test.js / findings.test.js):** machine gym, hamstrings via leg curls only,
  continued Quads+Hams plan with hints → reactions contain **no** `gap-add` whose exercise is Barbell;
  CONTROL: full gym → `gap-add: romanian-deadlift` (today's behaviour). Home gym, back via pull-up +
  db-row → no finding whose example is Cable/Machine/Barbell; the five Home-empty regions
  (`Back:upper, Biceps:short, Quads:iso, Glutes:medius, Calves:soleus`) produce no finding at Home;
  CONTROL: same history, no profile → `region-gap Back:upper → Face Pull`.

### C2 · Protect gates the comparative findings and the nudge; a per-finding mute (#6)
- `findings`: when every group on the lagging side of `legs-low` (Quads/Hamstrings/Glutes) is
  protected → don't emit `legs-low`; emit the existing `protect` finding instead. `balance`: if the
  side that needs more work is entirely protected (push side = Chest+Shoulders+Triceps, pull side =
  Back+Biceps), don't emit the warn variant.
- `buildHints.suggestGroups`: exclude protected groups.
- Mute: `settings.seen['mute:'+findingKey]` (the `seen` map is already synced and sanitized — check
  `cleanSeen` accepts arbitrary keys with a cap; if it whitelists, add the `mute:` prefix). `buildTips`
  skips muted findings (they stay in `findings()` for the builder). UI: each tip in the Progress
  "Coach's notes" card gets a small "Got it" link (`.linkbtn dim`, 44 pt overlay) → sets the mute,
  re-renders; Settings gets "Unmute all coaching" (one line, only shown when ≥1 mute).
- **Tests:** ui: with a legs-low history and `protect:['Quads','Hamstrings','Glutes']` → the
  Progress tab text contains no "Legs are" and no "Coach suggests: … Quads"; CONTROL: no profile →
  both present. Mute: tap "Got it" on the balance tip → tip gone, `settings.seen['mute:balance']===true`,
  and `A.findings(...)` still contains `balance` (builder still sees it). Sync: `cleanSeen` keeps
  `mute:balance:…` keys (oracle on the sanitizer).

### C3 · Push/pull counts the hinge (#22)
`analysis.js analyze`: `pull = hpull+vpull + 0.5*hingeSetsFromBackGroup` where hinge sets count only
for exercises whose `group==='Back'` or `muscles` includes Back (deadlift family), not RDL/hip thrust.
- **Oracle:** full body squat/bench/row/OHP/deadlift ×4 weeks (2 sets each) → `balance.dir==='even'`
  (compute: push = bench 8 + OHP 8 = 16; pull = row 8 + 0.5×deadlift 8 = 12 → 16 < 12×1.5 → even).
  CONTROL: bench+OHP+pushdown only → `dir:'push'` (unchanged).

### C4 · Volume landmark by days; one bump per session; honest toast (#23)
- `VOL_LANDMARKS`: when `profile.days<=2`, use low landmark 6 for every goal (`Math.min(lo,6)`); copy
  in `renderFinding` uses `f.target` when present, else "8+" — **fix the existing "10+" to match the
  8 trigger** (Balanced wording changes: snapshot will change — say so).
- `builder.js planWorkout` step 4: bump only the ONE undertrained group with the lowest `perWeek`
  (hints must carry `perWeek`; add it to `buildHints.undertrained` as `[{group, perWeek}]` — keep the
  old string array too as `undertrainedGroups` to avoid breaking callers, or update the two callers).
- `ui-today.js buildAndStart` toast: "+1 set on Hamstrings" (the group), and if a gap-add also
  happened: "… · added Leg Curl".
- **Oracle:** 2-day full body → `volume-low` only for groups under 6/wk; the continued build bumps
  exactly one exercise (`volumeBump.length===1`) belonging to the lowest group; toast text names it.
  CONTROL: no profile, 7 groups under 8/wk → still one bump (this changes today's behaviour of
  bumping all — deliberate; state it).

### C5 · Layoff-aware weekly volume (#14)
`analysis.js analyze`: `activeWeeks = new Set(done.map(s=>weekIndex(s.date))).size; perWeek =
effSets / Math.max(2, activeWeeks)`. Keep `a.weeks=4` for `freq-low` (frequency is about the
calendar).
- **Oracle:** 4 weeks PPL then 14 days off then one push session → chest `perWeek` = chest sets /
  3 active weeks (hand-compute), no `undertrained` for chest; CONTROL: same 4 weeks without the gap →
  /4 (unchanged).

### C6 · The app notices when it's ignored (#12)
- `progression.js suggestion`: count `declined` = consecutive real sessions where `nextSets` would
  have bumped and the user logged the same top weight as before (compare last 3 real perfs: each
  "ready" but top weight unchanged). If `declined>=3`: `kind:'match'`, text "You've hit 8 at 185
  three times — add a 4th set, or take 190×5", and `seedExercise` under the same condition adds one
  set (respecting `MAX_SETS_PER_EX`) instead of bumping weight. (`push:'quiet'` still short-circuits.)
- `builder.js planWorkout` rotation: if the plan's previous session contains neither the stalled lift's
  proposed replacement nor the stalled lift → treat the rotation as declined and don't re-propose the
  same `to` for 28 days (derive from history: the `to` id was proposed = it appears in a `reactions`…
  no — reactions aren't persisted. Derive: the user's last session for these groups still contains
  the "stalled" lift → they kept it → suppress rotation for that lift for 28 days after the first
  stall detection… also not persisted. Simplest honest rule: **rotation is proposed only when the stalled
  lift's tenure run is a multiple of 4 sessions** (sessions 4, 8, 12 of the stall), so a declined swap
  reappears every ~4 weeks, not weekly.) Document the rule.
- **Oracle:** 8 weekly sessions bench 185×8×3 → session 4's suggestion `kind:'match'` with the "add a
  4th set" text and `seedExercise` yields 4 sets at 185; CONTROL: 3 sessions → still the bump.
  Rotation cadence: a stalled accessory proposes at stall-sessions 4 and 8, not 5/6/7.

**C ship checklist:** snapshot WILL change (10+→8+, one-bump rule, hinge) — update deliberately and
list each reason in the changelog; v0.44.0 "The coach knows your gym, your limits, and when you've
said no"; commit/push/republish/memory.

---

## Phase D — Between sets: fast, legible, one tap to the plan  (v0.45.0 · UI · #8 #9 #10 #11 #13 #24 #25 #26 #27)

Browser-verify every item on the 375×812 viewport via `preview_start name:"ironlog"` (server.js,
port 4321) and take one screenshot per changed screen. Harness tests for structure; screenshots for
layout.

### D1 · Rest bar never covers content (#8)
`styles.css`: `body:has(.restbar.on){padding-bottom:calc(var(--tab-h) + var(--safe-b) + 60px)}`
(the rest bar is ≈50 px; 60 gives a gap). Action toasts (`.toast.act`) get `bottom` raised by the
same 60 px while the rest bar is on. **Do not** change `.tabbar` or the base padding.
- Test: ui — start rest (tick a set), scroll to bottom → `#btnFinish` bounding box bottom ≤ viewport
  height − restbar top (jsdom has no layout; assert the computed `padding-bottom` of body contains
  "60px" while `.restbar.on` exists and not otherwise — CONTROL). Screenshot proof.

### D2 · Contrast and type floor (#10)
- Light `--ink-3` → `#6b7a89` (verify ≥4.5:1 on `#eef1f5` and `#ffffff` with the WCAG formula in a
  test — write the formula in `test/ui.test.js` as a pure function and assert on the CSS tokens
  parsed from `src/styles.css`). Dark: `.btn.good` and `.set-check.on` colour → `--accent-ink`-style
  dark ink (`#0d1219`), verify ≥4.5:1 on `#34c184`.
- Type floor: every `font-size` in `src/styles.css` and inline in `src/app/*.js` ≥ 12px; anything
  coloured `--ink-3` ≥ 13px. Grep-based test that fails on regressions (allow-list for the 10px chart
  axis labels if they must stay — prefer 11px).

### D3 · Tap targets (#27)
`::after` hit-slop overlays (the existing mechanism) on `.modechip`, `.sw`, `.sugg .apply`,
`.seg button`; widen the outer stepper overlay to −8px. Test: computed styles in the harness can't
measure; assert the selectors exist in the CSS and screenshot one card.

### D4 · Increments by equipment (#11)
`progression.js unitIncrement(unit, ex)`: dumbbell or isolation → 2.5 lb / 1 kg; machine/cable → 5 lb
/ 2.5 kg (stack pins); barbell → 5 / 2.5 (unchanged); bodyweight n/a. Rep reset after a bump: `lo+1`
when `hi-lo>=4`, else `lo`. Thread `ex` into every `unitIncrement` call (nextSets, deloadSets,
shapeStyle, suggestion, review.js).
- **Oracle:** lateral raise 15×20 (rr 12–20) → `17.5×13`; DB press 25×12 (rr 8–12) → `27.5×9`;
  bench 185×8 → `190×6` (5–8 → lo+1=6 since range 3 <4 → stays 5? — range is 3, so reset to lo=5:
  `190×5`, unchanged). State the arithmetic. CONTROL: kg bench 100×8 → 102.5×5.

### D5 · Next up on Home; continue without re-picking (#9)
- `ui-today.js` Home: above the Start card, if `findPlan`-style lookup (reuse `B.findPlan` via a
  small `B.nextUp(sessions, now)` that returns `{groups, session:N, lapsed}` for the most recently
  trained group set, or the least-recently trained preset when no plan) → card **"Next up: Push ·
  Session 4 · last Tue"** with one button "Start" → `buildAndStart(false)` with `draft.groups` preset.
  Below it, the existing Start flow becomes "Something else".
- New-workout screen: pre-select last session's groups when arriving from Home's generic Start.
- **Tests:** ui: with pushHistory, Home shows "Next up" naming Chest/Shoulders/Triceps and "Session
  4"; one click → `state.active` exists with the continued ids (equal to `planWorkout` result).
  CONTROL: no history → no Next-up card, Start flow unchanged. Tap count assertion: from Home, 2
  clicks to a ticked set (Start → ✓).

### D6 · Live card density (#24)
- Move "Watch demo" and "Note" into the ⓘ sheet (keep the 📝 note line visible when a note exists —
  tapping it opens the editor). "Remove set" stays (frequent). Equipment chip stays (frequent for the
  wife) but gets D3's target. First-card tip shows only until `settings.seen.warmupTip` (synced).
  Hide "Auto-order" when the session came from the builder (`source==='build'`).
- **Tests:** ui: count buttons per exercise card ≤ 20 (from 30); tip absent on the second session;
  ⓘ sheet contains "Watch demo" and "Note". CONTROL: a scratch (non-built) session still shows Auto-order.

### D7 · Build needs a choice (#25) · Home order and stale copy (#26)
- Build button disabled until ≥1 group; when the user has a plan, the button label is "Build Chest +
  Triceps". Test: 0 groups → `#btnBuild.disabled===true`; CONTROL: 1 group → enabled.
- Home: profile intro card moves below the Start card. Profile sheet: delete the sentence "the
  workout builder starts using these in the next update". Test: DOM order (Start before intro);
  sheet text does not contain "next update".

### D8 · History pagination (#13)
`ui-views.js` history: render the first 30 sessions + a "Show more" button (30 at a time); the
calendar and the detail sheet unchanged; keep the current scroll position on append.
- **Oracle:** with 563 sessions the DOM has 30 session cards, "Show more" present; click → 60. Timing:
  render ≤ 300 ms in the harness at 563 (assert with a generous bound and the number in the message).
  CONTROL: 12 sessions → 12 cards, no button.

**D ship checklist:** screenshots for D1, D3, D5, D6 on the phone viewport; v0.45.0 "Between sets:
faster, legible, one tap to your plan"; commit/push/republish/memory.

---

## Phase E — Polish batch  (v0.46.0 · the Low list)

Each is one edit + one oracle; do them all in one commit. Sanitizer clamps (`w∈[0,5000]`, `r∈[0,1000]`,
`date∈[2000-01-01, now+1d]`) · SW `c.put('./index.html',copy)` · viewport diagnostics behind a 5-tap
on the version · `role="button" tabindex="0"` + Enter/Space on clickable divs (library rows, calendar
cells, session cards, ⓘ) · sheet titles without emoji; one deload explainer (the editor banner) ·
history card shows top set (`8/8/7` → "3 sets · top 185×8") · wording: "Legs are getting less work",
"Short of the range last time — hold 72.5 lb", finish line = stats only · import/sync cap
`MAX_SESSIONS=50000` (separate from `MAX_ARR`) · PR board: e1RM only when reps ≤ 12, else show the
set as "50 reps @ bodyweight" without an estimate · `face-pull` and `back-extension` get `pat:'iso'`
for coverage (keep their muscles) · accessory rotation: when the best replacement is the lift rotated
OUT within the last 8 weeks, take the next candidate.

---

## After v7
Deferred on purpose: canonical-unit storage (D-#20 second half; needs a migration — write a plan
first), second-user namespacing on a shared phone, cardio/mobility logging, RIR opt-in, App Store
packaging. Each needs its own roadmap entry with user decisions before code.
