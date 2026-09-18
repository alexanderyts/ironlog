# Ironlog — Changelog

Versioning: `MAJOR.MINOR.PATCH`. Each published version is labeled in the Artifact version history too.

## v0.60.0 — 2026-09-18 · Export your sessions as a CSV
- **New "Export sessions (CSV)" button** in Settings → Your data. It saves one row per finished workout — date, day, type (Strength / Deload / Cardio), duration, total volume, working sets, exercises, bodyweight, and notes — ready for a spreadsheet or to feed into another health app.
- Volume uses the bodyweight recorded on each workout (so bodyweight lifts are accurate), and cardio sessions include their type, intensity and distance.

A note on health apps: Bevel and Apple Health only accept data through Apple Health, and Apple Health can't store sets/reps/weight — so a direct live sync isn't possible from a web app. This CSV is the portable bridge (a tool like "Health CSV Importer" can push the bodyweight/minutes into Apple Health), and it's the foundation if we later add an Apple Health shortcut.

Not verified on-device.

## v0.59.2 — 2026-09-17 · Plate loader: type the weight in
Polishing the plate loader from your feedback:
- **Type any weight instead of tapping.** Both the weight and the bar weight are now editable — tap the number and type it, and the plates update as you go. No more holding the button for a heavy load.
- **The bar can be set to 0** (for a fully counterbalanced Smith machine), and it stays there.
- **Cleaner layout** — the unit ("lb"/"kg") now sits neatly beside the number instead of slipping underneath.

Not verified on-device.

## v0.59.1 — 2026-09-16 · Smith machine gets its own bar weight
- **The plate calculator now remembers a separate bar weight for the Smith machine.** A straight barbell defaults to 45 lb / 20 kg; the Smith machine defaults to 25 lb / 10 kg (its carriage is usually lighter and is often printed on the machine). Each is adjustable and remembered on its own, so switching a lift between barbell and Smith uses the right bar automatically.

Not verified on-device.

## v0.59.0 — 2026-09-16 · Plate calculator
- **See how to load the bar.** Barbell and Smith-machine lifts now have a "🏋 Plates" button. Tap it and it shows exactly which plates to put on each side for your working weight — colour-coded, largest first. Tap ± to try another weight without leaving the sheet.
- **Set your bar.** Defaults to a standard 45 lb / 20 kg bar, but you can change it (for a lighter bar, EZ bar, etc.) and it's remembered. If a weight can't be made with standard plates, it tells you what's left over.

Not verified on-device.

## v0.58.0 — 2026-09-16 · Swipe a pop-up down to close it
- **Pop-up panels now close with a swipe.** The little bar at the top of a pop-up finally does what it looks like it should — drag the panel down to dismiss it (or flick it), instead of reaching for the ✕. A small drag springs back. The ✕ still works too.

Not verified on-device.

## v0.57.0 — 2026-09-16 · Workout notes, and move a workout to another day
Two long-wanted additions:
- **Add a note to a whole workout.** Tap "📝 Workout note" in the editor to jot how the session felt — sleep, energy, a tweak — separate from the per-exercise notes. It shows on the workout's card in History and in its details.
- **Move a past workout to another day.** Open a past workout → Edit, and there's now a date field. Forgot to log Monday's session until Wednesday? Set it to the right day. Its duration is kept, and History re-sorts automatically.

Not verified on-device.

## v0.56.0 — 2026-09-16 · Your bodyweight is remembered per workout
Bodyweight lifts (pull-ups, dips, assisted machines, planks) are scored partly by your bodyweight. Until now the app used your *current* weight for your *entire* history — so updating your weight quietly shifted every past pull-up number. Fixed:
- **Each workout now remembers the bodyweight you did it at.** Your history stops moving when you update your weight — an old pull-up session keeps the numbers it earned, and a new one is scored at your new weight. Your progress chart for these lifts is finally accurate over time.
- **Your existing workouts are frozen at your current weight** (a one-time step), so they don't drift from here on. New workouts save their own bodyweight automatically when you finish.
- **Carry records now match the chart.** A farmer's/suitcase carry's personal best is ranked by longest hold (heavier load breaks a tie) — the same way the progress chart ranks it, so the PR card and the chart always agree.

Note: history before this update is set to your current weight, so very old bodyweight-lift numbers are approximate; everything from here forward is exact.

Not verified on-device.

## v0.55.0 — 2026-09-16 · Review polish (small correctness + feedback fixes)
A follow-up review of the last three updates turned up a few small things, now fixed:
- **An unassisted rep on an assist machine now counts as your record.** Working an assisted pull-up/dip down to zero assist is the strongest you can do — it used to be dropped from your PR and progress chart; now it's the top of both.
- **Leaving a workout mid-hold tells you.** If a plank/carry stopwatch is running and you tap Home or another tab, it stops and says "Hold stopped — you left the workout," instead of quietly discarding the time.
- **Progress stats stay fresh across midnight.** The performance cache from the last update now rolls over at your local midnight, so an app left open overnight can't show yesterday's week/day windows.
- **The launch layout check is more robust.** After a rotation or returning from the background, the screen-fit routine briefly re-checks itself, then stops again.

Not verified on-device.

## v0.54.0 — 2026-09-16 · Faster, especially as your history grows
Performance work you won't see directly — the app just does less pointless work, which means less lag and less battery drain the more you log.
- **The Progress tab does its number-crunching once, not over and over.** Opening a chart or expanding a section no longer re-scans your entire history each time — the results are reused until your data actually changes. The more workouts you've logged, the bigger this is.
- **Ticking a set during a workout is snappier.** Each exercise card's "personal best" is now worked out once when you open the workout, instead of being recalculated on every single tap.
- **The screen-fit loop stops when it's done.** A background routine that keeps the layout correct at launch used to run forever (a small constant battery cost on an installed app); it now switches off once the screen has settled.

Not verified on-device.

## v0.53.0 — 2026-09-16 · Data safety: nothing gets lost or resurrected
Under-the-hood fixes so your log stays intact in the corners that could bite. Nothing to learn — it just behaves better.
- **A workout in progress can no longer disappear silently.** If your phone's storage fills up mid-session, you now get a clear "Storage is full — export a backup" warning instead of edits quietly failing and the session being lost on reload.
- **The stopwatch and rest timer never stack.** Starting a rest now closes a running plank stopwatch (they share the same spot), and leaving the workout screen — tapping Home or another tab — stops the stopwatch instead of letting it count on in the background.
- **A timed set won't slip through empty.** Ticking a plank or carry with no seconds entered now asks for the seconds first, instead of accepting it and dropping it at Finish.
- **A deleted workout stays deleted across devices.** On the built-in cloud, deleting a session on one phone now reliably removes it on your others — before, another device could quietly bring it back.
- **A corrupt backup can't bloat sync forever.** The internal "deleted" and "seen" lists are now size-capped.

Not verified on-device.

## v0.52.0 — 2026-09-16 · Planks, carries and assisted machines are now first-class
A review turned up that the time-held and assist-machine lifts were only half-wired into the stats. Fixed:
- **Bodyweight holds now get a personal record.** A plank, wall sit, dead hang, side plank or hollow hold now shows a best (longest hold) on your PR board — before, they silently never did.
- **The progress chart reads the right direction for these lifts.** An assisted machine's chart now rises as you *drop the assist* (before, getting stronger looked like a decline), labelled "resistance"; a plank's chart shows seconds ("hold"), instead of being blank.
- **The builder won't retire an assisted lift while you're improving on it.** Dropping your assist week to week now correctly counts as progress, not a plateau.
- **The stopwatch logs to the right exercise.** If you delete or reorder exercises while a hold is timing, the seconds now land on the lift you started — before, they could go to the wrong one or vanish. It also skips over a warm-up set when writing the time.
- Not verified on-device (tested in a desktop browser at iPhone size, including a real countdown-and-hold — 253 tests green; review snapshot unchanged).

## v0.51.0 — 2026-09-16 · Progress tab: clearer numbers, honest comparisons
The Progress tab's top numbers now move with what you actually did, and a long-standing wording bug is fixed.
- **Every stat now shows how it compares to last week** — e.g. "5 sessions · +4 vs last week." It compares fairly: early in the week it measures against the *same point* last week, not a finished week, so a Tuesday never looks like a slump.
- **The confusing "30-day sessions" box is gone.** In its place: **Sets this week** — so the four tiles each tell you something different (sessions, volume, sets, streak) instead of three that all just count how often you showed up.
- **Fixed: Coach's Notes said "Deload this week" when it was actually last week.** It now uses the same Monday-to-Sunday weeks as everywhere else and reads "this week," "last week," or "N days ago" — matching the Recovery card instead of contradicting it.
- Sessions and streak count all activity (lifts and cardio); volume and sets are lifting-only — a down week is shown in calm grey, never as a red failure.
- Not verified on-device (tested in a desktop browser at iPhone size, against your 2026-09-16 backup — 240 tests green; review snapshot unchanged).

## v0.50.0 — 2026-09-16 · A built-in stopwatch for planks, carries and holds
For anything measured by time instead of reps — planks, farmer's carries, dead hangs — you can now time it in the app instead of watching a separate clock.
- **⏱ Stopwatch button** on those exercises' cards during a workout. Tap it → a 5-second "get set" countdown → it counts up while you hold → **Stop & log** drops the seconds straight into your next set and checks it off.
- It runs off the clock, so locking your phone mid-hold doesn't lose your time.
- **Five new time-based exercises:** Dead Hang, Wall Sit, Side Plank, Hollow Hold, and Suitcase Carry — search for them like any other.
- These lifts can be logged by time alone (no weight needed), and — as before — they count as sets for your balance and frequency, but never as weight-times-reps volume.
- Small fix: in your History list, a bodyweight hold now reads "2×27s" instead of "2×27 · 0lb".
- Not verified on-device (tested in a desktop browser at iPhone size, including a real countdown-and-hold — 235 tests green; review snapshot unchanged).

## v0.49.2 — 2026-09-16 · Polish on the PR-adjust feature
A review of v0.49.0/.1 turned up four rough edges, now fixed.
- **Opening a Note or exercise info mid-workout no longer loses your place.** The panel still opens cleanly over the keyboard, but closing it now returns you exactly where you were instead of the top of the workout.
- **"Count it again" restores one record at a time**, matching how you set them aside — so if you walked a couple of records back, you can bring them forward one by one.
- **The "tap a record" hint waits until you actually have a record** — new users no longer see it above an empty list.
- **Set-aside times now read in seconds** (e.g. a carry shows "50lb × 45s", not "× 45").
- Not verified on-device (tested in a desktop browser at iPhone size — 229 tests green; review snapshot unchanged).

## v0.49.1 — 2026-09-16 · Making "adjust a PR" findable
The feature shipped in v0.49.0 was too well hidden — unless you happened to set a PR with the finish screen open, there was nothing telling you it existed.
- **Personal Records rows now show a ›** so it's clear they open something.
- **A one-time note above your records:** "Tap a record for its trend — or set it aside if the form wasn't there." One "Got it" and it's gone for good, on every device.
- **Fixed: setting a record aside from the finish screen jumped you somewhere else.** It threw away the "Done" button in the middle of finishing a workout. Now the row just ticks to **Set aside ✓** and you carry on.
- Not verified on-device (tested in a desktop browser at iPhone size — 225 tests green; review snapshot unchanged).

## v0.49.0 — 2026-09-16 · Adjust a PR, and the sheet that wouldn't appear
Sometimes you hit a number your form didn't earn. Now you can say so, without losing the fact that you hit it.
- **"That rep wasn't clean."** Open a lift from your Personal Records (or tap it right after the workout announces it) and set the record aside in one tap. Your PR falls back to your previous best, and the row shows **PR adjusted** with the set-aside lift and its date — so the history is still right there.
- **Nothing is deleted.** The set stays in your History and keeps counting toward your volume and your sets-per-muscle. It just stops being the bar.
- **The app stops pushing you off it.** Your next suggestion — and the weights the builder prefills — come from your last *clean* set instead. Real example: barbell row 75→90→110 with the 110 set aside now prefills **95**, not 115. If every set that day was set aside, it falls back to the workout before; if you've never logged a clean one, nothing changes.
- **A deliberate step back no longer looks like decline.** On the lift's trend, an adjusted point turns the arrow neutral instead of warning-orange and says why.
- **Changed your mind?** "Count it again" puts it straight back.
- **Fixed: tapping something that opens a panel while the keyboard was up did nothing.** The exercise library (and every other panel) was opening below the visible screen, leaving a blank band where the keyboard sits. Panels now drop the keyboard first and open at the top, on the search bar.
- **Fixed: a fake "★ New PR" on assisted and timed lifts.** An assist machine (less weight = harder) and a plank or carry (where "reps" are seconds) can't be ranked by an estimated 1-rep max, so the in-workout PR flash could both miss real improvements and invent fake ones. It now stays quiet on those lifts — your Personal Records list already ranked them correctly and still does.
- Not verified on-device (tested in a desktop browser at iPhone size, against your 2026-09-16 backup, plus the automated suite — 223 tests green; review snapshot unchanged).

## v0.48.2 — 2026-09-15 · Assisted-lift volume counts the real work
Follow-up to v0.48.0: the assisted-dip *progression and PRs* were fixed, but its **volume** still counted the machine's assistance as the load. Now an assisted lift counts the resistance you actually moved.
- **Assisted Dip / Assisted Pull-Up volume = bodyweight − assist.** Just like a *weighted* dip counts bodyweight + the added plate, an *assisted* dip now counts bodyweight minus the help. So a 216 lb lifter with 70 lb of assist counts 146 lb per rep, not 70. Your weekly volume, session totals and the volume chart all reflect the true work now — and the harder set (less assist) correctly counts as *more* volume, not less.
- Needs your bodyweight set (Settings → Bodyweight); without it, an assisted lift now contributes 0 rather than a misleading number.
- Nothing to re-edit: the numbers just recompute. (Last Monday's session, for example, goes from 7,600 to ~10,484 lb.)
- Not verified on-device (tested in a desktop browser and with the automated suite — 212 tests green; review snapshot unchanged).

## v0.48.1 — 2026-09-15 · Editing & keyboard cleanups
Three fixes to how things behave while you're logging.
- **Sheets open at the top.** Tapping "Add exercise" (or any picker) now opens with the search bar in view, instead of somewhere in the middle of the list where the last sheet left off.
- **The tab bar gets out of the keyboard's way.** With the keyboard up, the bottom tab bar no longer floats over it or gets shoved to the top of the keyboard when you scroll — it hides until the keyboard closes.
- **Clean rest times on the Time card.** The "rest between sets" numbers were showing long decimals (like `2:40.813813`). They now read as plain minutes and seconds (`2:41`).
- Not verified on-device (the keyboard behaviour especially — tested in a desktop browser at phone width; 211 tests green).

## v0.48.0 — 2026-09-15 · Honest numbers for the odd lifts
Fixes for exercises that don't fit "weight × reps", and for a way the rest timing could be thrown off — all from a real workout.
- **Assisted Dip is now its own exercise.** If you do dips on an assist machine, log it as **Assisted Dip** (search "assisted dip"): the number you enter is the *assistance*, so less weight is harder, the next-time suggestion asks for **less assist** as you get stronger, and it never shows a bogus 1RM. (Before, an assisted dip logged on the wrong exercise counted the assist as your load and pushed you the wrong way.)
- **Planks and carries are timed, not counted.** For **Farmer's Carry** and **Plank** the second column now reads **Sec**, cards show "50 lb × 45 s", and they no longer inflate your weekly volume or invent a 1RM — a loaded carry isn't a weight-×-reps lift. They still count as sets toward your muscle balance and the coach.
- **Sets ticked seconds apart aren't counted as rest.** If you tick several sets at once, or fix a mis-logged set, those near-instant gaps used to drag your "rest between sets" numbers down (and could read "0 s"). They're now ignored — only real rests count. Un-ticking a set also keeps its original time, so fixing a mis-tap no longer moves it to "now".
- **Back-date a cardio session.** The manual "log one you already did" now has a **When** date, so a walk you forgot to start is logged on the day it happened.
- **Fixed:** searching "assisted dip" used to return the (unrelated) Machine Dip.
- To clean up last Monday: open that session, edit it, swap Tricep Dip → Assisted Dip with the same numbers. The carry's stray PR clears itself.
- Not verified on-device (tested in a desktop browser at phone width and with the automated suite — 210 tests green, run 3×; the lifting review snapshot is unchanged).

## v0.47.0 — 2026-09-14 · Log your cardio
You can now log a cardio session — a walk, the treadmill, the elliptical, whatever — right alongside your lifting.
- **Two ways to log it.** On Home, tap **Log cardio**. Either **Start now & time it** (a live clock runs; tap Finish when you're done) or, under "log one you already did", enter the **minutes** by hand — so a walk you forgot to start is easy to add after the fact.
- **Pick what it was.** Type (Treadmill · Elliptical · StairMaster · Outdoor · Indoor), intensity (Easy · Moderate · Hard), and an optional distance (mi/km, following your weight-unit setting). You can edit or delete any cardio session later.
- **It shows up where it should.** Cardio appears in **History** (its own card and a calendar dot), counts toward your **"This week"** total and your **streak**, and gets its own **Cardio summary** on the Progress tab (this-week minutes and a by-type breakdown).
- **It never touches your lifting numbers.** Cardio is deliberately kept out of your volume, PRs, the coach's analysis, and the workout builder — the same way a deload never affects your progression. Your strength stats are exactly what they were.
- **Safeguards carry over.** A cardio session left running for hours offers an honest end time instead of recording a 40-hour "walk", and a full-storage warning protects it just like a workout.
- Not verified on-device (tested in a desktop browser at phone width and with the automated suite — 204 tests green, run 3× for stability; the lifting review snapshot is unchanged, proving cardio stays invisible to the strength math).

## v0.46.0 — 2026-09-14 · Weeks that turn over, readable bars, tidier notes
Polish from your observations on the Progress and Home screens.
- **"This week" now means this calendar week (Monday–Sunday).** Before, the "This week" and "Week volume" figures (on Home and Progress) counted a rolling last-7-days, so they never reset on Monday — Monday morning still showed Thursday and Friday's workouts. They now start fresh each Monday. (Nothing else changed: "30-day workouts" is still a rolling month, and streaks are unaffected.)
- **You can read the volume bars.** The tallest bar in the 8-week chart is always labelled with its number so the chart has a scale; tap any other bar to see its value. (Screen readers get every bar's value without tapping.)
- **Coach's notes, Recovery and Time fold away.** Each of those three sections now has a tap-to-collapse header with a one-line gist (e.g. "last one 6d ago"). Collapse the ones you don't want taking up space; the app remembers your choice per section and syncs it across your devices. They start open.
- **The deload notes stopped repeating themselves.** The coaching note about a deload now has a wider set of shorter wordings that rotate week to week, and it no longer echoes the "own the stretch" reminder that already shows inside the workout — so the same idea isn't said three times on one screen.
- Not verified on-device (tested in a desktop browser at phone width and with the automated suite — 192 tests green).

## v0.45.3 — 2026-09-14 · Checkpoint: fix the bugs the review found before polishing
A three-lane adversarial review of everything changed since the last checkpoint, to catch anything I'd introduced. It found a real one:
- **Cross-device data loss, fixed.** The safeguard that stops an older copy of the app from overwriting a backup written by a newer one only worked for one sync — the very next set you logged could slip past it and clobber the newer backup. It now stays blocked until this phone is updated, then resumes on its own.
- **A deload on an assisted machine was backwards.** On an assisted pull-up (less weight = harder), the deload was *cutting* the assist — making the "recovery" set harder than the last real one. It now adds assist, as a deload should.
- **Editing a past workout when storage is full** no longer says "Changes saved" when it didn't save — same protection the Finish button already had.
- **The Settings toggle switches** get their proper large tap area (a rule added last update was quietly overridden and doing nothing).
- **The "+X lb" hint is honest after a unit switch** — when a converted weight lands off the plate grid, the label now shows the actual jump instead of a rounded-off number.
- **A flaky test is fixed** — a hold-to-repeat test was asserting an exact number of timer fires and occasionally failed under load; the suite is now green on repeated runs (188 tests, 5/5 clean).
- Two minor cosmetic items (an assisted-lift set order, a "Session N" counter resetting after a deload week) are noted and deferred rather than risk touching stall detection in a stabilisation pass.

## v0.45.2 — 2026-09-14 · Fix the font properly (it was falling back to Times)
Found the real cause of the "off" font. In v0.45 a stray brace ended the page's base style one line too early, which knocked the body typeface, text size and smoothing out of effect **except while a rest timer was on screen** — so almost everywhere, text was silently rendering in the browser's default serif (Times) at the wrong size. My earlier tweaks couldn't fix it because they weren't the problem.
- **Body text is IBM Plex Sans again, everywhere, at the right size.** Headings stay Archivo; weights and reps stay IBM Plex Mono.
- **One consistent font system.** All three roles (headings, body, numbers) are now defined once and used everywhere with the same fallback list, so nothing can drop to a stray typeface again. The bold weights the app actually uses are now loaded too, so bold text is real bold instead of a smeared synthetic bold.
- Checked in the browser: body, labels and headings all resolve to the right typeface.

## v0.45.1 — 2026-09-14 · You pick the workout; the app just remembers
Two changes from your feedback on v0.45.
- **Reverted the type changes.** The muted-text colour and the slightly larger labels from the last update are back to how they were. (One thing kept: the green Finish button uses dark text in dark mode — it was genuinely too faint to read before, and it's invisible in light mode.)
- **The app no longer says "your plan".** You never set a plan, so it shouldn't claim one. Home now simply leads with **Start a workout** — you choose what you're training that day. Once you pick your muscles, it offers to fill in the same lifts with your **weights prefilled from last time** (or different exercises if you'd rather), and the last-session card and coach notes are there as guidance. The wording throughout ("Session N", "continue your plan", "plan continued") is gone — the app remembers and suggests; it doesn't drive.

## v0.45.0 — 2026-09-13 · Faster, clearer, one tap to your plan (Roadmap v7, Phase D)
The between-sets experience: less friction, easier to read, sized for a thumb.
- **One tap to keep going.** Home now leads with **Continue your plan · [your muscles] · from [when]** — a single tap builds your next session with the weights carried forward. The full "what are you training?" picker is still there behind **Something else**. (It used to take four or five taps to get to the same place.)
- **The rest timer no longer hides the Finish button.** While a rest countdown is up, the page reserves room for it, so the last set row and the **Finish** button stay tappable.
- **Easier to read.** The muted text (set headers, sub-labels, tab names) and the green **Finish** button and set checkmarks now meet the standard contrast level in both light and dark — the old values were too faint. A few of the smallest labels were bumped up a point.
- **Weights step by the right amount.** A dumbbell or an isolation move (curls, raises, extensions) now increases by 2.5 lb / 1 kg instead of a jarring 5 — a lateral raise no longer jumps from 15 to 20. On a wide rep range the reps reset one above the bottom instead of dropping several. The +/- buttons match.
- **Small friction gone:** tapping **Build** with nothing selected now asks you to pick a muscle group instead of quietly building a chest-and-back day; the mode chip, toggles and "Keep last" have bigger touch targets; History loads 30 sessions at a time (a year of history no longer freezes the tab); and the warm-up tip only shows for your first couple of sessions.
- Not verified on-device beyond this: the contrast values were computed to the WCAG AA threshold and the flows (one-tap continue, disabled Build, History paging, the new increments) have automated tests; the Home card, green button, rest-bar spacing and legibility were checked in the browser at phone width in both themes. Deferred: folding the per-exercise **Watch demo / Note** links into the ⓘ sheet (a larger card-density change) is left for the polish pass.

## v0.44.0 — 2026-09-13 · The coach knows your gym, your limits, and when you've heard it (Roadmap v7, Phase C)
The coaching gets honest about your profile. If you don't set a profile, every note is exactly as before (the real-data check confirms it's unchanged).
- **It only suggests things you can actually do.** At a machine or home gym, the coach no longer says "try an Incline Barbell Press" or "add a Face Pull" — it suggests a lift your gym has, or says nothing. The workout builder won't quietly add an off-equipment exercise either.
- **It respects what you're protecting.** Keeping your legs light for a knee? It stops telling you "legs are undertrained" and stops nudging you toward squats. Rehabbing one side? It won't push you to train it more.
- **You can tell it "Got it."** Any coaching note now has a small **Got it** to hide it — useful when you already know and don't want the reminder. You can bring them all back from Settings. (The builder still quietly acts on what it knows; you've just muted the words.)
- **A deadlift finally counts as pulling.** A balanced full-body program (squat, bench, row, press, deadlift) is no longer flagged "too much pressing" forever — the deadlift is counted as posterior-chain pull work.
- **Volume advice matches reality.** The "volume is low" note now says the number it actually checks against (8+ sets/week, not a mismatched 10+), and a 2-day-a-week lifter is held to a realistic 6, not 10. And when the builder adds a set for low volume, it adds it to **one** muscle per session and the message names it — instead of quietly adding five and saying "+1 set".
- **Deferred, on purpose:** the "don't flag everything low right after a two-week layoff" idea (review #14) was tried and pulled — dividing volume by active weeks *overstates* an intermittent lifter's real weekly volume, which is worse for the people this app is for. It needs proper layoff detection, so it's left for a later pass. The "notice when you ignore a suggestion" item (#12) is likewise deferred to its own careful change.
- Not verified on-device: every lever has automated tests with hand-computed expected findings and Balanced/off-lever controls, the "Got it" mute was driven through the real Progress tab, and the real-data review snapshot is byte-for-byte unchanged.

## v0.43.0 — 2026-09-13 · Continuity: the plan survives real life (Roadmap v7, Phase B)
Ten fixes so the builder and the numbers hold up over months of normal training — missed weeks, deloads, long histories, unit switches. Balanced coaching output on real data is unchanged (the snapshot test confirms it).
- **A deload week or a missed week no longer wipes your plan.** Coming back, Ironlog continues the same session with your weights where you left off (up to about six weeks away — it says "welcome back, continued from…"), instead of shuffling in random exercises. A deload block bridges the gap rather than resetting it.
- **Doing exactly what the app told you is no longer read as a stall.** When you add reps at the same weight week to week (100×12 → 105×8 → 9 → 10), it now sees that as progress and keeps the lift, instead of swapping it out.
- **Your main lifts stay put.** A flat deadlift or squat is never rotated out like an accessory — only lighter accessory lifts rotate, and only on a real stall.
- **"Time for a deload" is honest again.** It counts from your last deload (not through it), so it won't claim "12 weeks without a deload" three weeks after one, and it mentions it once per block instead of every week. A single week off no longer resets your streak.
- **Assist machines work the right way round.** On an assisted pull-up, progress means *less* assist — the prescription lowers the weight and your record is the least assist, not the most.
- **Size goal no longer shrinks high-rep moves** (a plank or a farmer's carry keeps its long rep range), a converted weight snaps back onto the plate grid on the next bump instead of drifting, the set prescription follows your last *real* session's equipment (a deload on different gear won't switch it), "Straight" sets now hold the top set's reps, and the weekly streak is correct in every timezone (a New Zealand daylight-saving change used to miscount it).
- Not verified on-device: every change has an automated test with a hand-computed expected value and a control (including the timezone one, run in four zones); the real-data review snapshot is unchanged.

## v0.42.0 — 2026-09-13 · Trust: nothing is lost silently (Roadmap v7, Phase A)
The first phase after the big review. All about not losing data — none of your workouts or coaching change. Plan in `ROADMAP-v7.md`.
- **A full phone can't swallow a finished workout any more.** If saving fails because storage is full, Ironlog keeps the workout open on your phone (a reload brings it right back) and tells you plainly, instead of showing "Workout complete" over nothing. The header shows "Storage full", and Settings now shows how much space Ironlog is using so you can see it coming.
- **Dropbox now syncs the things it used to miss.** A profile change, a saved routine, or a deleted workout used to reach your other phone only the next time you finished a workout — now they upload on their own. A workout deleted on one phone stays deleted on the other.
- **Ticking a set with no weight is caught.** On a barbell or dumbbell lift, Ironlog asks for the weight instead of quietly saving a set worth nothing (which skewed "last time"). Bodyweight moves are unaffected.
- **Importing a backup saved in the other unit no longer disturbs your history.** It converts the weights for display without making the old file look newer than what's on your phone — so it can't undo a deletion or overwrite a more recent edit.
- **Sync is sturdier for a phone left off a while:** deletions are remembered for about 13 months (was 3), a profile you reset on one device now clears on the others, the "≈ estimated end time" mark survives a backup, and an older copy of the app won't overwrite a backup written by a newer one.
- Not verified on-device: everything here has automated tests through the real app — a simulated full disk on Finish, the Dropbox upload path with a stand-in server, the blank-weight catch, and the import/round-trip rules — each with an expected result and an off case. The Settings storage line was checked in the browser. Your coaching output is byte-for-byte unchanged (the real-data snapshot test confirms it).

## v0.41.0 — 2026-09-13 · Profile review tool + adversarial audit (Roadmap v6, Phase P4 — final)
The last phase of the profile work: a way to *see* what a profile changes, and an audit that proves the levers hold under every combination. This is a developer/reviewer tool plus an internal safety net — nothing in the app screens changes.
- **`review.js --profile '{…}'`** overlays a training profile on a real backup and prints, for each preset, the build with and without the profile side by side, marking (✎) every pick the profile changed; `--why` names the exact lever that dropped each one. It also shows the coach's notes auto vs. profile. The profile is validated through the same rules the app uses.
- **A combinatorial audit** now builds every profile the app can produce (goal × gym × length × push, plus protect and avoid) against all six presets — 1,000+ builds — and asserts each one covers its groups, excludes what the gym setting forbids, never keeps an avoided lift, and never puts a heavy free-weight compound on a protected muscle.
- **Bug the audit caught and fixed:** the "no more than two heavy barbell squat/hinge lifts per session" safety swap picked its replacement without consulting the profile, so it could quietly bring back a lift you'd avoided, a barbell under a machine-only gym, or a heavy lift on a protected muscle. The replacement now clears the profile too, or the extra lift is simply dropped. The avoid/gym/protect rule now lives in one place both the pool and this swap read from.
- Not verified on-device: this phase is tooling and engine-internal; the overlay was exercised on a synthetic backup and every invariant has an assertion. Full suite 161 tests.

## v0.40.1 — 2026-09-13 · The 50-hour workout, and a Finish you can find
A real bug report: a workout started before Ironlog timed sets, finished two days later, was logged as 50 hours long. Plan in `PLAN-finish-and-duration.md`.
- **Finish now asks when the sets have no timestamps.** If a workout was started a while ago and none of its sets carry a time, Finish offers *End now*, *About an hour after I started* (shown as ≈), or *Don't record a length* — instead of silently logging the whole gap as training time.
- **A length over 8 hours is treated as unknown.** It's a forgotten Finish, not a workout: it no longer shows on the History card and no longer drags the Time averages. This also fixes the already-saved 50-hour session wherever it's read — no data editing needed.
- **Finish is now in the top bar of a live workout,** next to Discard, as well as at the bottom. It's greyed until a set is checked. No changes to the tab bar or safe-area layout.
- Not verified on-device: the top-bar button was checked in the browser; the no-timestamp Finish sheet and the 8-hour cap have automated tests with expected values and controls.

## v0.40.0 — 2026-09-13 · The coach listens to your profile (Roadmap v6, Phase P3)
**Balanced is still exactly today's coach.** With a profile set, the Progress-tab coaching reads the same facts through your lens — it never changes what was measured, only what's worth saying.
- **Days per week** — on a 2-day week most muscles can only be trained once, so the "spread this across two days" tip stays quiet. With 3 or more days it works as before.
- **Goal** — the "volume is low" tip uses a landmark for your goal: *Size* ~10 sets/week, *Strength* ~6, *Balanced/General* ~8 (the same as today). The wording names it: "For size, chest at ~9 sets/week is below the ~10 that reliably grows it."
- **Protect** — a muscle you're keeping light no longer gets nudged toward heavy compound lifts (no more "add an overhead press"). Instead you get one line crediting what's covering it: "You're keeping shoulders light — Lateral Raise is covering it." Light isolation gaps (say, rear delts) are still mentioned. The builder reads the same list, so it stops trying to add heavy work there too.
- **Just record** — the monthly strength-trend line states the numbers and stops; it no longer tells you to lean on the +weight prompts you've turned off.
- Not verified on-device: nothing behavioural — each lever has a test with hand-computed expected findings plus Balanced and off-lever controls, the real-data review snapshot is unchanged, and the protect line was confirmed in the rendered Progress tab through the app's own screen code (the browser preview has no history, so it only confirmed the tab still renders cleanly). The good-news protect line is placed after any warnings so the five-tip cap never drops a warning for it.

## v0.39.1 — 2026-09-13 · Profile stability pass (two fixes from a cold review of P2)
A deliberate re-read of the P2 change before moving on. Two things were wrong; both fixed, both now have a hand-computed test.
- **"Just record" now really just records.** The coach line said "Recorded — last time was 185×8" but the set rows were still prefilled with the heavier 190×5 — the rows and the words disagreed. The rows now mirror last time too. A deload is untouched (still lighter on purpose).
- **Ramping on a heavy-opener pattern.** If your last session was a heavy first set then lighter back-off sets (say 200×5, 180×8, 180×8), Ramping put the back-off *reps* on the top weight (200×8). It now carries the reps from the set that actually held the top weight (160×5 → 180×5 → 200×5).
- Also checked and found sound: every gym filter leaves at least one exercise per muscle (Home is thin for Back/Hamstrings/Glutes but never empty); imported profiles are enum-checked and capped; an avoided lift's replacement correctly becomes the plan's anchor; the full suite passed 152/152 on three consecutive runs, so the earlier timing failure was load, not a defect.
- Not verified on-device: nothing behavioural — both fixes were confirmed at runtime against expected values and end-to-end through the app's session-start path.

## v0.39.0 — 2026-09-13 · The builder listens to your profile (Roadmap v6, Phase P2)
**Still nothing changes unless you set a profile.** Balanced remains byte-for-byte today's app; this update just makes the workout builder act on the profile you saved in P1.
- **Avoid** — exercises you list are never proposed. If a plan you're already running contains one, it's swapped for another lift for the same muscle (with a reason: "you asked to avoid it"), and this holds even on a deload.
- **Gym** — *Machine-focused* stops proposing barbell lifts on fresh plans (unless you've logged that lift in Smith mode, which it keeps as Smith); *Home* proposes dumbbell and bodyweight moves only.
- **Protect** — a muscle you're keeping light drops heavy free-weight compounds from what's *proposed* and never gets an extra set added to it.
- **Session length** — Short trims the session, Long allows one more exercise.
- **Goal** — *Size* prescribes a couple more reps before adding weight; *Strength* keeps reps low and adds load sooner. *Balanced* is unchanged.
- **Set style** — *Ramping* turns a main lift's top set into a 3-step climb (e.g. 150 → 170 → 190); *Straight* keeps every set at the same weight.
- **Coaching** — *Just record* stops the app from ever suggesting a heavier weight; it only mirrors last time.
- **What this means, plainly:** a Machine-focused or Home profile can change which exercises a *continued* plan proposes for muscles you haven't trained yet, but it never retroactively rips out a lift you're already progressing — those are kept, and the per-exercise equipment chip still records how you actually did each one.
- Not verified on-device: nothing behavioural — every lever has an automated test with a hand-computed expected result and an off-lever control, and the builder's churn/hold/anchor-safety audits were re-run with a profile set. One rest-timer hold-repeat UI test is timing-sensitive under parallel load (green on its own); it's unrelated to this change.

## v0.38.0 — 2026-09-13 · An optional training profile (Roadmap v6, Phase P1)
**Nothing changes unless you want it to.** Everyone stays on the balanced default, which is exactly today's app.
- A one-time card on Home introduces it: **Take me there** opens the settings, **I'm good** dismisses it for good (and it won't reappear on your other devices).
- The **Training profile** (in Settings, and a "Profile: … · change" line on the New-workout screen) lets you set your main goal, the kind of gym you use, days per week, session length, set style, coaching style, muscles to keep light, and specific exercises to avoid. Every field defaults to **Balanced**; changes save instantly.
- This update only *stores* your answers — the workout builder starts using them in the next update, so you can set it up now and nothing about your workouts changes yet.
- Not verified on-device: nothing behavioural — the card, sheet, and that a saved profile leaves builds unchanged were all checked automatically and in the browser.

## v0.37.0 — 2026-09-13 · See how you spend your time (Roadmap v6, Phase T3)
A new **Time card on the Progress tab**, all from the timestamps added in the last two updates:
- **Average workout length** and **density** (working sets per 10 minutes).
- **How long you actually rest** between sets — split by compound lifts vs isolation — which you can now compare to your rest-timer setting.
- **Where your time goes**, as a bar per muscle group over the last 4 weeks.
- Each exercise's detail sheet now shows **the rest you typically take on that lift** (e.g. "~3:00").
- All of it ignores sessions logged before timing existed, and any single break over 15 minutes is capped so a phone call doesn't get counted as training. (analysis.js `timeByGroup`/`restTaken`/`sessionDensity`/`timeTrends`.)
- Not verified on-device: nothing behavioural — the card and numbers were checked in the browser against a hand-built fixture.

## v0.36.0 — 2026-09-13 · If you forget to press Finish (Roadmap v6, Phase T2)
The app never ends a workout on its own — it just notices and asks.
- **A "Still training?" banner** appears on a workout that's been idle a long time (no set checked for over an hour), with Finish and Discard right there. The Home "Resume" card and the header show the idle time too.
- **When you finish a long-idle workout, it asks when you actually finished** — "End at my last set (9:59 AM)" or "End now (11:31 AM)" — so a workout you left open for hours doesn't get logged as a 3-hour session. The last-set option marks the length as an estimate (shown with a "≈"). A normal finish doesn't ask.
- **Optional background nudge:** if you've allowed rest notifications, a single "Still training?" notification can fire while the app is in the background.
- Not verified on-device: reliable background notification delivery — a web app can't wake itself, so on a suspended iPhone PWA this may not fire; the in-app banner is the dependable safety net.

## v0.35.0 — 2026-09-13 · Workouts record how long they took (Roadmap v6, Phase T1)
- **The editor header now shows a live workout timer** ("Workout in progress · … · 47 min"), and your **finished workouts show their length** on the summary and in History.
- Under the hood, each set records *when* you checked it off, and the session records when you finished. Those timestamps are what the next updates use for time-per-muscle, how long you actually rest, and a "did you forget to press Finish?" nudge. (progression.js `sessionDuration`/`setTimeline`; new optional `set.at` and `session.endedAt` fields, kept through save/sync/import.)
- Older workouts logged before this update simply won't show a length — nothing is guessed.
- Not verified on-device: nothing behavioural is unverified here; the timer and duration were checked in the browser (shown: a 47-min session).

## v0.34.0 — 2026-09-13 · Easier to tap, easier to type (Roadmap v6, Phase U1)
- **Tapping a weight or rep number now selects the whole number**, so you just type the new one — no more caret landing mid-number and digits going in the wrong place. Tapping an already-selected number selects it again. Enter/Done jumps to the next field (weight → reps → next set).
- **+ and − are much easier to hit.** They look the same size (so "102.5" still fits on a small phone) but their touch area is ~40% larger and reaches the full row height. **Hold either one to keep counting.**
- **Every small control got a bigger touch area** — set numbers, the check button, sheet close, delete buttons, the rest-timer buttons, the settings steppers, text buttons — with a visible press state. Apple's 44-pt minimum was the target; visuals didn't grow.
- Not verified on-device: haptic tick on step (Android only; iOS Safari has none) and the exact feel of hold-to-repeat timing — tell me if 0.4 s to start / 9 per second is wrong.

## v0.33.0 — 2026-09-13 · Foundation for what's next (Roadmap v6, Phase 0)
No user-visible change — this is groundwork so the coming features (workout timing, an optional training profile) are built safely.
- **The app finally has automated UI tests.** Until now, screen behaviour was only ever checked by hand. A test harness (jsdom) now boots the real app and runs the five flows that matter — finishing saves only your checked sets, the "unchecked sets" prompt, comma decimals, the deload build, presets — so they can't silently break. (120 tests, up from 112.)
- **Your real backups are now a safety net.** A test runs your exported history through the engine and flags if a change would alter what the builder or coach does for your actual data, before it reaches your phone. (Kept private on the dev machine.)
- **The biggest file (the UI, ~1,000 lines) was split into four** for navigability, with zero change to how it runs (verified byte-for-byte). Weak tests were tightened to check the *right* answer, not just that code ran.
- Not verified: nothing new to verify — this phase changes no behaviour; all screens were re-checked in the browser.

## v0.32.0 — 2026-09-13 · Notes, Recovery view, commercial-gym machines
- **Notes on exercises.** Tap "✎ Note" under any exercise while logging (or editing a past session) to leave a note — "left shoulder pinchy, stayed light", a form cue, anything. It's saved with that session and shown the next time you do the lift, right above the sets, so a lower-than-expected number has its reason next to it. The exercise info sheet lists your recent notes. Synced and backed up with the session. (500 characters max.)
- **Deloads are yours — the app no longer assumes why.** Reverses v0.31.0's "deload as baseline": a deload never feeds your prescriptions, PRs, or the builder, whatever loads you chose (form work, injury, a light day). If you've only ever done a lift on a deload, the editor now says so ("your last deload here was 70×9 — set your baseline") and leaves the prefill blank.
- **New Recovery card on Progress** — a read-only look at how you deload: how many of your recent sessions were deloads, how often, how your deload loads compare to your working loads on the same lifts, and which exercises have only ever appeared on a deload. It's a mirror, not a judgment, and it's kept strictly separate from the progression logic. (analysis.js `deloadStats`.)
- **11 commercial-gym machines** (the Planet Fitness floor): assisted pull-up, machine lateral raise, machine bicep curl, machine triceps extension, hip adduction, glute kickback machine, machine hip thrust, ab crunch machine, torso rotation, machine back extension, cable wrist curl. Every muscle group now has a pin-loaded option. Search aliases added ("hip abductor", "adductor", "ab machine", …). Library: 114.
- **Review tool:** `node tools/review.js backup.json --why` prints the score breakdown behind every exercise the builder picks, plus the Recovery stats and notes.
- 3 new tests (112).

## v0.31.0 — 2026-09-13 · Fixes from reviewing real data
The first pass with the owner's actual history (`tools/review.js`) turned up three things.
- **A deload with nothing before it now counts as your starting point.** If the only time you've done an exercise was on a deload, the app used to ignore it and prefill blanks next time. Now it prefills those exact loads (not progressed, not cut again) and says so. (progression.js `baselinePerf`; builder.js `seedExercise`.)
- **The Working-sets and Volume tiles now update live** when you change the weight or reps of a set you've already checked off (they only updated on check/uncheck/remove before). (ui.js `refreshStats`, no re-render so typing keeps focus.)
- **A checked set with zero reps is dropped at finish, and ignored in history**, so it can't prefill as "0×0" next time. (progression.js `finalizeSets`, `lastPerf`.)
- 2 new tests (109).

## v0.30.0 — 2026-09-11 · Robustness & polish (Roadmap v5, Phase 8 — final)
- **Weights fit on small phones.** A number like "102.5" no longer gets clipped in the weight box on a 375-px screen (verified). (styles.css: tighter set-row columns, 28-px steppers, 16-px input.)
- **No crash from a retired exercise.** A workout or import that references an exercise id the app no longer knows can no longer crash Auto-order or the exercise-info tap. (builder.js `perfPriority` guards unknown ids; ui.js guards the detail taps.)
- **The status bar tints correctly in light mode** (was always dark). (build.js: light/dark `theme-color` metas.)
- **The rest timer stops when you finish or discard a workout** (it used to keep counting), and **+15s during the "Go!" state now starts a fresh rest** instead of doing nothing. (ui.js.)
- **Fewer needless "Update ready" nudges**, and the app checks for a new version when you reopen it (so a long-suspended install doesn't run stale code). (build.js service-worker registration.)
- The Home "Last session" card fix from earlier this pass is confirmed working. 107 tests.

## v0.29.0 — 2026-09-11 · Multi-device sync fixes (Roadmap v5, Phase 7)
For people who use Ironlog on more than one device (Dropbox sync or the cloud artifact).
- **A workout you finished on one device no longer comes back as "Resume" on another.** Finishing now records *when* you ended it, and that "ended" moment is compared against the other device's open workout — the more recent action wins, so a stale open session can't resurrect a completed one. (store.js `activeClearedAt`; sync.js pure `resolveActive`.)
- **Dropbox: sessions logged during an upload are no longer lost.** The sync now clears only the exact sessions it uploaded, and a 30-second safety timeout prevents sync from getting stuck. (store.js `syncNow`.)
- **Importing a backup from a different unit converts the weights** (a kg backup into an lb install no longer shows kg numbers as lb). (store.js `importBackup`.)
- Deferred (needs two-device testing): unifying the cloud artifact's live-sync through the shared merge so deletions propagate there too — noted in ROADMAP-v5. The Resume fix above already covers the artifact.
- 2 new tests (107).

## v0.28.0 — 2026-09-11 · Honest coaching + import hardening (Roadmap v5, Phase 6)
- **The coach no longer congratulates you for a problem you didn't fix.** If a "gap" disappears only because you stopped training that muscle (or stopped logging enough), it's no longer shown as "sorted." Credit is given only when the muscle is still trained and the issue is genuinely gone. (analysis.js `withStatus`/`canResolve`.)
- A within-workout exercise suggestion can no longer appear with a blank reason line. (builder.js `complementSuggestions`.)
- Importing a backup is safer: a set with no "done" flag now counts as performed (matching how the app reads history), and an unrecognized equipment tag is dropped instead of white-screening the Progress tab. (sync.js `cleanSet`/`cleanExercise`.)
- Deferred to a later pass (not a bug): folding the coach's finding types into a single ordered registry — noted in ROADMAP-v5 v6-candidates.

## v0.27.0 — 2026-09-11 · One-tap workout presets + precise plan matching (Roadmap v5, Phase 5)
- **New: one-tap Quick picks** on the New-workout screen — Full body, Upper, Lower, Push, Pull, Arms. Tapping one selects those muscle groups (you can still fine-tune the chips), and tapping it again clears. Browser-verified: each builds a balanced session and "Continue your plan" works when you pick it again. (exercises.js `PRESETS`; UI only — no new builder logic.)
- **Picking a single muscle now builds for that muscle.** Before, choosing just "Chest" the day after a push day would continue the whole push workout. Now it builds a chest session; to continue a push day, pick Push (or the same groups). (builder.js `findPlan`: counts add-ons across all non-picked groups.)
- Safety: a session is capped at 7 exercises even if you select every muscle group. (builder.js `buildRecommendation`.)

## v0.26.0 — 2026-09-11 · The builder stops "fixing" what's working (Roadmap v5, Phase 4)
- **The builder no longer swaps out a lift right after you add weight to it.** When you bump the weight, you drop reps back down — which briefly lowers the estimated 1-rep-max, and the old stall check misread that dip as a plateau and could rotate the lift away. Now a heavier top-set weight always counts as progress, so a working lift is left alone. (builder.js `isStalled`: compares top weight, bounded to the current training run.)
- **Coming back after time off no longer looks like a stall.** The stall check now only considers your current unbroken run of an exercise, not heavier sessions from months ago. (builder.js `exerciseTenure` ends a run at a long gap; `recentPerfs` is bounded to it.)
- **An anchor lift is only swapped after a deload of that same muscle** — a legs-only deload no longer unlocks a bench-press swap. (builder.js `recentDeload` checks which muscle was deloaded.)
- Net effect: fewer rotations, more continuity — the intended design. 3 new adversarial tests (102).

## v0.25.0 — 2026-09-11 · Deload actually deloads (Roadmap v5, Phase 3)
Fixes the reported bug where turning on "Deload" still built a normal, progressed workout. Browser-verified.
- **A deload now continues your exact plan, just lighter.** Before, the deload toggle never reached the workout builder, so on a continued plan it still showed "Session N," could swap an exercise out, and (via Repeat / Routine) even pre-filled *heavier* progressed weights. Now a deload keeps the same exercises, cuts the load to ~60%, caps each exercise at 3 sets, and makes no swaps or additions — from every start button. (builder.js `planWorkout` honours `opts.deload`; `seedExercise` caps deload sets at 3.)
- The build button now reads "🌿 Deload this plan" (not "Session N") and offers "Build a fresh deload instead," updating live when you flip the toggle.
- Repeat and Routine now respect the deload toggle too.
- Internal: `seedExercise` moved to an options argument (tidier call sites).

## v0.24.0 — 2026-09-11 · Streak counts real weeks (Roadmap v5, Phase 2)
- **Your streak now counts real Monday-to-Sunday weeks.** Before, the week boundary fell mid-week (between Wednesday and Thursday), so three sessions on Tuesday–Thursday could show as a "2-week streak." Now it's correctly 1 week. This also fixes an hour of drift in the weekly-volume chart around daylight-saving changes. (progression.js: `weekIndex`/`weekStart`, local Monday-start, replacing the epoch-week math in calcStreak, the coach's phrasing rotation, and weeklyVolumes.)
- Note: the Home "This week" tile is a rolling last-7-days count and is unchanged — it can differ from the streak's calendar week, which is expected.

## v0.23.0 — 2026-09-11 · Only the sets you did get saved (Roadmap v5, Phase 1)
The most important fix in this pass. Browser-verified end to end.
- **Finishing a workout now saves only the sets you checked off.** Before, when the app pre-filled your weights, any set with a weight in it was saved as "done" even if you never touched it — so checking 2 of 3 sets could quietly log all 3, inflating your history, volume, PRs and streak. Now an unchecked pre-filled set is never saved. (ui.js `cleanSets` → progression.js `finalizeSets`; setsOf/Finish already counted correctly.)
- **If you typed numbers on a set but forgot to check it off, the app asks** ("Save them as done, or leave them out?") instead of silently dropping them.
- **Comma decimals work:** "12,5" is read as 12.5, not 125. (progression.js `parseWeightInput`.)
- **Starting a new workout while one is in progress now asks first** before discarding your logged sets (Repeat / Routine / Build).
- Note: sessions logged before this version may contain sets you didn't actually do. They are **not** auto-changed (a phantom set looks identical to a real one) — edit a session from the History tab if a number looks off. New sessions are clean.

## v0.22.4 — 2026-09-11 · Internal groundwork, part 3 (Roadmap v5, Phase 0.5-F/G)
Mostly internal, with one real fix. Browser-verified; no console errors.
- **Fixed:** the "Last session" card on the Home screen now opens that workout when tapped (it did nothing before — the tap only worked on the History tab).
- The New-workout screen's buttons now use one shared click system, so adding a button (like next update's one-tap Full body / Push / Pull presets) is just markup — no wiring. (ui.js: delegated `data-action` table on `#view`, installed once.)
- Wrote down the rule both cloud backends follow ("adapters move bytes; one function merges") so the sync fixes later can't drift. (store.js comment.)

## v0.22.3 — 2026-09-11 · Internal groundwork, part 2 (Roadmap v5, Phase 0.5-D/E)
No user-visible change — verified in the browser that every way of starting a workout still works. Sets up the deload and safety fixes coming next.
- Every way to start a workout (Build, Start from scratch, Repeat, Routine, repeat-from-history) now goes through one function, so behaviour is consistent and the next fixes touch one place instead of five. (ui.js: `startSession(spec)`.)
- The New-workout screen's picks (muscle groups + deload toggle) live in one `draft` object, reset in exactly one place when a workout begins — so a stale pick can't leak into your next visit.

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
