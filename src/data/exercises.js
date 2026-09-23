// Exercise library + the metadata that powers the smart builder and analysis.
// Loaded first; every other module reads from IL.data.
var IL=globalThis.IL||(globalThis.IL={});

const C='compound', I='isolation';
// [id, name, primary group, muscles, equipment, type, target rep range, instructions, search aliases]
const RAW=[
 // Chest
 ["barbell-bench-press","Barbell Bench Press","Chest",["Chest","Triceps","Shoulders"],"Barbell",C,[5,8],"Lie on a flat bench, lower the bar to mid-chest, press up to full lockout.","bench press,flat bench"],
 ["incline-barbell-press","Incline Barbell Press","Chest",["Chest","Shoulders"],"Barbell",C,[6,10],"On a 30° incline bench, lower the bar to upper chest and press up.","incline bench"],
 ["dumbbell-bench-press","Dumbbell Bench Press","Chest",["Chest","Triceps"],"Dumbbell",C,[8,12],"Press two dumbbells from chest level to lockout on a flat bench.","db bench"],
 ["incline-dumbbell-press","Incline Dumbbell Press","Chest",["Chest","Shoulders"],"Dumbbell",C,[8,12],"Press dumbbells on a 30° incline, controlling the descent.","incline db"],
 ["machine-chest-press","Machine Chest Press","Chest",["Chest","Triceps"],"Machine",C,[8,12],"Push the handles forward to lockout, control back to a chest stretch.",""],
 ["dumbbell-fly","Dumbbell Fly","Chest",["Chest"],"Dumbbell",I,[10,15],"With a slight elbow bend, open the arms wide then squeeze back together.","flyes"],
 ["cable-crossover","Cable Crossover","Chest",["Chest"],"Cable",I,[10,15],"Pull the cables down and across the body, squeezing the chest.","cable fly"],
 ["pec-deck","Pec Deck","Chest",["Chest"],"Machine",I,[10,15],"Bring the pads together in front of the chest, control the return.","machine fly"],
 ["push-up","Push-Up","Chest",["Chest","Triceps","Core"],"Bodyweight",C,[8,20],"Lower the chest to the floor keeping a straight line, press back up.","pushup"],
 ["chest-dip","Chest Dip","Chest",["Chest","Triceps"],"Bodyweight",C,[6,12],"Lean forward on parallel bars, dip down, press back up.","dips chest"],
 // Back
 ["deadlift","Deadlift","Back",["Back","Hamstrings","Glutes"],"Barbell",C,[3,6],"Hinge and grip the bar, drive through the floor to stand tall.","dead lift"],
 ["pull-up","Pull-Up","Back",["Back","Biceps"],"Bodyweight",C,[5,12],"Hang from a bar, pull the chin over the bar, control down.","pullup"],
 ["chin-up","Chin-Up","Back",["Back","Biceps"],"Bodyweight",C,[5,12],"Underhand grip, pull up until the chin clears the bar.","chinup"],
 ["lat-pulldown","Lat Pulldown","Back",["Back","Biceps"],"Cable",C,[8,12],"Pull the bar to the upper chest, squeeze the lats, control up.","pulldown"],
 ["barbell-row","Barbell Row","Back",["Back","Biceps"],"Barbell",C,[6,10],"Hinge over, row the bar to the lower ribs, control down.","bent over row"],
 ["dumbbell-row","One-Arm Dumbbell Row","Back",["Back","Biceps"],"Dumbbell",C,[8,12],"Braced on a bench, row the dumbbell to the hip.","db row"],
 ["seated-cable-row","Seated Cable Row","Back",["Back","Biceps"],"Cable",C,[8,12],"Pull the handle to the stomach, squeeze shoulder blades together.","cable row"],
 ["t-bar-row","T-Bar Row","Back",["Back","Biceps"],"Barbell",C,[8,12],"Hinge over the bar and row it into the chest.",""],
 ["straight-arm-pulldown","Straight-Arm Pulldown","Back",["Back"],"Cable",I,[10,15],"With straight arms, pull the bar down to the thighs using the lats.",""],
 ["face-pull","Face Pull","Back",["Shoulders","Back"],"Cable",I,[12,20],"Pull the rope to the face, flaring elbows out for rear delts.",""],
 ["chest-supported-row","Chest-Supported Row","Back",["Back","Biceps"],"Machine",C,[8,12],"Chest braced against the pad, row the handles to your sides.",""],
 ["rack-pull","Rack Pull","Back",["Back","Hamstrings","Glutes"],"Barbell",C,[3,6],"Bar set just below the knee, pull to lockout without a full deadlift descent.",""],
 // Shoulders
 ["overhead-press","Overhead Press","Shoulders",["Shoulders","Triceps"],"Barbell",C,[5,8],"Press the bar overhead from the shoulders to full lockout.","ohp,military press,shoulder press"],
 ["dumbbell-shoulder-press","Dumbbell Shoulder Press","Shoulders",["Shoulders","Triceps"],"Dumbbell",C,[8,12],"Press dumbbells from shoulder height to overhead lockout.","db shoulder press"],
 ["arnold-press","Arnold Press","Shoulders",["Shoulders"],"Dumbbell",C,[8,12],"Rotate palms from facing you to forward as you press overhead.",""],
 ["lateral-raise","Lateral Raise","Shoulders",["Shoulders"],"Dumbbell",I,[12,20],"Raise the dumbbells out to the sides to shoulder height.","side raise,side lateral"],
 ["front-raise","Front Raise","Shoulders",["Shoulders"],"Dumbbell",I,[12,15],"Raise the dumbbells straight in front to shoulder height.",""],
 ["rear-delt-fly","Rear Delt Fly","Shoulders",["Shoulders"],"Dumbbell",I,[12,20],"Hinge over and raise the dumbbells out to the sides.","reverse fly"],
 ["cable-lateral-raise","Cable Lateral Raise","Shoulders",["Shoulders"],"Cable",I,[12,20],"Raise the cable out to the side to shoulder height.",""],
 ["upright-row","Upright Row","Shoulders",["Shoulders","Back"],"Barbell",C,[10,15],"Pull the bar up the body to chest height, leading with the elbows.",""],
 ["shrug","Barbell Shrug","Shoulders",["Shoulders"],"Barbell",I,[10,15],"Elevate the shoulders straight up toward the ears, pause, lower.","traps,shrugs"],
 ["landmine-press","Landmine Press","Shoulders",["Shoulders","Triceps"],"Barbell",C,[8,12],"Press one end of a barbell up and forward from shoulder height.",""],
 // Biceps
 ["barbell-curl","Barbell Curl","Biceps",["Biceps"],"Barbell",I,[8,12],"Curl the bar up keeping elbows fixed, lower under control.","bicep curl"],
 ["dumbbell-curl","Dumbbell Curl","Biceps",["Biceps"],"Dumbbell",I,[8,12],"Curl the dumbbells up, supinating the wrists at the top.","db curl"],
 ["hammer-curl","Hammer Curl","Biceps",["Biceps"],"Dumbbell",I,[8,12],"Curl with a neutral (palms-in) grip for the brachialis.",""],
 ["preacher-curl","Preacher Curl","Biceps",["Biceps"],"Machine",I,[10,12],"Curl over a preacher pad with the upper arms fixed.",""],
 ["incline-dumbbell-curl","Incline Dumbbell Curl","Biceps",["Biceps"],"Dumbbell",I,[10,12],"Curl seated on an incline with arms hanging back for a stretch.",""],
 ["cable-curl","Cable Curl","Biceps",["Biceps"],"Cable",I,[10,15],"Curl the cable bar up with constant tension, control down.",""],
 // Triceps
 ["tricep-pushdown","Triceps Pushdown","Triceps",["Triceps"],"Cable",I,[10,15],"Push the bar down to lockout, keeping elbows pinned to the sides.","pushdown"],
 ["rope-pushdown","Rope Pushdown","Triceps",["Triceps"],"Cable",I,[10,15],"Push the rope down and spread the ends apart at the bottom.",""],
 ["overhead-tricep-extension","Overhead Triceps Extension","Triceps",["Triceps"],"Dumbbell",I,[10,15],"Extend the dumbbell overhead from behind the head to lockout.","skull,french press"],
 ["skull-crusher","Skull Crusher","Triceps",["Triceps"],"Barbell",I,[8,12],"Lower the bar to the forehead, extend to lockout.","lying tricep extension"],
 ["close-grip-bench","Close-Grip Bench Press","Triceps",["Triceps","Chest"],"Barbell",C,[6,10],"Bench with a shoulder-width grip, elbows tucked, for triceps.","cgbp"],
 ["tricep-dip","Triceps Dip","Triceps",["Triceps","Chest"],"Bodyweight",C,[6,12],"Stay upright on parallel bars and dip to work the triceps.","dips"],
 ["tricep-kickback","Triceps Kickback","Triceps",["Triceps"],"Dumbbell",I,[12,15],"Hinge over and extend the dumbbell straight back to lockout.","kickback"],
 // Quads
 ["back-squat","Back Squat","Quads",["Quads","Glutes"],"Barbell",C,[5,8],"Bar on the upper back, squat to depth, drive up through the floor.","squat"],
 ["front-squat","Front Squat","Quads",["Quads","Core"],"Barbell",C,[5,8],"Bar racked on the front delts, squat upright to depth.",""],
 ["leg-press","Leg Press","Quads",["Quads","Glutes"],"Machine",C,[8,15],"Press the platform away to near lockout, control back to depth.",""],
 ["hack-squat","Hack Squat","Quads",["Quads"],"Machine",C,[8,12],"Squat on the machine with the back supported, drive up.",""],
 ["goblet-squat","Goblet Squat","Quads",["Quads","Glutes"],"Dumbbell",C,[8,15],"Hold a dumbbell at the chest and squat to depth.",""],
 ["bulgarian-split-squat","Bulgarian Split Squat","Quads",["Quads","Glutes"],"Dumbbell",C,[8,12],"Rear foot elevated, lunge straight down on the front leg.","split squat"],
 ["walking-lunge","Walking Lunge","Quads",["Quads","Glutes"],"Dumbbell",C,[10,14],"Step forward into a lunge and alternate legs walking forward.","lunge"],
 ["step-up","Step-Up","Quads",["Quads","Glutes"],"Dumbbell",C,[8,12],"Step onto a box or bench, driving through the lead leg to stand tall.",""],
 ["leg-extension","Leg Extension","Quads",["Quads"],"Machine",I,[12,15],"Extend the knees against the pad to straight, control down.",""],
 // Hamstrings
 ["romanian-deadlift","Romanian Deadlift","Hamstrings",["Hamstrings","Glutes"],"Barbell",C,[8,12],"Hinge at the hips with soft knees, feel the hamstring stretch, stand.","rdl"],
 ["lying-leg-curl","Lying Leg Curl","Hamstrings",["Hamstrings"],"Machine",I,[10,15],"Curl the pad toward the glutes, control the return.","leg curl"],
 ["seated-leg-curl","Seated Leg Curl","Hamstrings",["Hamstrings"],"Machine",I,[10,15],"Curl the pad down and under, squeeze the hamstrings.",""],
 ["stiff-leg-deadlift","Stiff-Leg Deadlift","Hamstrings",["Hamstrings","Glutes"],"Barbell",C,[8,12],"Keep legs mostly straight and hinge to load the hamstrings.",""],
 ["good-morning","Good Morning","Hamstrings",["Hamstrings","Back"],"Barbell",C,[8,12],"Bar on the back, hinge forward with a flat back, return upright.",""],
 ["nordic-curl","Nordic Hamstring Curl","Hamstrings",["Hamstrings"],"Bodyweight",I,[5,10],"Kneeling with ankles anchored, lower your torso forward under control and pull back up.","nordic hamstring curl"],
 // Glutes
 ["hip-thrust","Hip Thrust","Glutes",["Glutes","Hamstrings"],"Barbell",C,[8,12],"Shoulders on a bench, drive the hips up and squeeze the glutes.",""],
 ["glute-bridge","Glute Bridge","Glutes",["Glutes"],"Bodyweight",I,[12,20],"From the floor, drive the hips up and squeeze at the top.",""],
 ["cable-kickback","Cable Kickback","Glutes",["Glutes"],"Cable",I,[12,15],"Kick the leg straight back against the cable, squeeze the glute.",""],
 ["sumo-deadlift","Sumo Deadlift","Glutes",["Glutes","Hamstrings","Back"],"Barbell",C,[3,6],"Wide stance, grip inside the knees, drive up to lockout.",""],
 // Calves
 ["standing-calf-raise","Standing Calf Raise","Calves",["Calves"],"Machine",I,[12,20],"Rise onto the toes to full height, pause, lower for a stretch.","calf raise"],
 ["seated-calf-raise","Seated Calf Raise","Calves",["Calves"],"Machine",I,[12,20],"With knees bent, raise the heels and squeeze the calves.",""],
 // Core
 ["plank","Plank","Core",["Core"],"Bodyweight",I,[30,60],"Hold a straight line on the forearms; log seconds as reps.",""],
 ["hanging-leg-raise","Hanging Leg Raise","Core",["Core"],"Bodyweight",I,[8,15],"Hang and raise the legs to hip height or above, control down.","leg raise"],
 ["cable-crunch","Cable Crunch","Core",["Core"],"Cable",I,[12,20],"Kneel and crunch the rib cage toward the pelvis against the cable.",""],
 ["russian-twist","Russian Twist","Core",["Core"],"Bodyweight",I,[16,30],"Seated and leaned back, rotate side to side; log total touches.",""],
 ["ab-wheel","Ab Wheel Rollout","Core",["Core"],"Bodyweight",C,[8,15],"Roll the wheel out keeping a braced core, pull back in.",""],
 ["crunch","Crunch","Core",["Core"],"Bodyweight",I,[15,25],"Curl the shoulders off the floor, squeeze the abs, lower slowly.",""],
 // Forearms
 ["wrist-curl","Wrist Curl","Forearms",["Forearms"],"Dumbbell",I,[12,20],"Rest forearms on your thighs or a bench, curl the wrists up, lower fully.",""],
 ["reverse-wrist-curl","Reverse Wrist Curl","Forearms",["Forearms"],"Dumbbell",I,[12,20],"Palms down, extend the wrists up against the weight, lower fully.",""],
 ["reverse-curl","Reverse Curl","Forearms",["Forearms","Biceps"],"Barbell",I,[10,15],"Overhand grip, curl the bar up keeping elbows fixed at your sides.","reverse bicep curl"],
 ["farmers-carry","Farmer's Carry","Forearms",["Forearms","Core"],"Dumbbell",C,[20,40],"Grip a heavy dumbbell in each hand and walk with tall posture; log seconds as reps.","farmer walk"],
 ["wrist-roller","Wrist Roller","Forearms",["Forearms"],"Other",I,[1,3],"Roll the weight up by twisting the handle, then lower it under control.",""],
 // ── v4 Phase D expansion: variation families, lengthened-position (stretch) options, machine/cable
 //    variants, unilateral movements, and true anatomical gaps ─────────────────────────────────────
 // Chest
 ["machine-incline-press","Machine Incline Press","Chest",["Chest","Shoulders"],"Machine",C,[8,12],"Press the handles up and in on an incline path, control to a stretch.",""],
 ["incline-dumbbell-fly","Incline Dumbbell Fly","Chest",["Chest"],"Dumbbell",I,[10,15],"On an incline, open the arms wide for a deep upper-chest stretch, squeeze back.","incline fly"],
 ["dumbbell-pullover","Dumbbell Pullover","Chest",["Chest","Back"],"Dumbbell",I,[10,15],"Lie across a bench, lower a dumbbell back over the head for a big stretch, pull it back.","pullover"],
 // Back
 ["pendlay-row","Pendlay Row","Back",["Back","Biceps"],"Barbell",C,[5,8],"Row explosively from a dead stop on the floor to the lower chest each rep.",""],
 ["neutral-grip-pulldown","Neutral-Grip Pulldown","Back",["Back","Biceps"],"Cable",C,[8,12],"Pull a neutral-grip handle to the chest, driving the elbows down and back.",""],
 ["single-arm-cable-row","Single-Arm Cable Row","Back",["Back","Biceps"],"Cable",C,[10,15],"Row one handle to the hip, letting the shoulder stretch forward at the front.","one arm cable row"],
 ["cable-pullover","Cable Pullover","Back",["Back"],"Cable",I,[10,15],"With straight arms, pull the bar from overhead to the thighs, feeling the lats stretch up top.",""],
 // Shoulders
 ["machine-shoulder-press","Machine Shoulder Press","Shoulders",["Shoulders","Triceps"],"Machine",C,[8,12],"Press the handles overhead on a fixed path, control back to ear height.",""],
 ["reverse-pec-deck","Reverse Pec Deck","Shoulders",["Shoulders"],"Machine",I,[12,20],"Facing the pad, sweep the arms back and out to hit the rear delts.","rear delt machine"],
 ["leaning-cable-lateral","Leaning Cable Lateral Raise","Shoulders",["Shoulders"],"Cable",I,[12,20],"Lean away from the stack and raise the cable out to the side through a long range.",""],
 // Biceps
 ["ez-bar-curl","EZ-Bar Curl","Biceps",["Biceps"],"Barbell",I,[8,12],"Curl an EZ bar up with a semi-supinated grip, elbows fixed.",""],
 ["concentration-curl","Concentration Curl","Biceps",["Biceps"],"Dumbbell",I,[10,15],"Elbow braced on the inner thigh, curl one dumbbell up with a hard peak squeeze.",""],
 ["bayesian-cable-curl","Bayesian Cable Curl","Biceps",["Biceps"],"Cable",I,[10,15],"Face away from a low pulley so the arm trails behind you, curling from a deep stretch.",""],
 // Triceps
 ["cable-overhead-extension","Cable Overhead Triceps Extension","Triceps",["Triceps"],"Cable",I,[10,15],"Facing away from the stack, extend overhead from a deep long-head stretch.",""],
 ["single-arm-pushdown","Single-Arm Pushdown","Triceps",["Triceps"],"Cable",I,[12,15],"Push one handle down to lockout with the elbow pinned, control up.",""],
 ["machine-dip","Machine Dip","Triceps",["Triceps","Chest"],"Machine",C,[8,12],"Press the handles down to lockout staying upright to bias the triceps.","dip machine,seated dip,tricep dip machine"],
 // Quads
 ["sissy-squat","Sissy Squat","Quads",["Quads"],"Bodyweight",C,[8,15],"Rise onto the toes and lean back, bending the knees to stretch the quads, then drive up.",""],
 ["reverse-lunge","Reverse Lunge","Quads",["Quads","Glutes"],"Dumbbell",C,[8,12],"Step back into a lunge and drive through the front heel to stand; alternate legs.",""],
 // Hamstrings
 ["back-extension","45° Back Extension","Hamstrings",["Hamstrings","Glutes","Back"],"Bodyweight",I,[12,20],"On a 45° bench, hinge down and squeeze the posterior chain to rise to a straight line.","hyperextension"],
 ["single-leg-curl","Single-Leg Curl","Hamstrings",["Hamstrings"],"Machine",I,[10,15],"Curl one leg at a time to even out side-to-side and add range.",""],
 // Glutes
 ["hip-abduction","Hip Abduction","Glutes",["Glutes"],"Machine",I,[12,20],"Press the knees outward against the pads to target the glute medius.","abductor machine,hip abductor,outer thigh,thigh machine"],
 ["single-leg-hip-thrust","Single-Leg Hip Thrust","Glutes",["Glutes"],"Bodyweight",I,[10,15],"Shoulders on a bench, drive one hip up and squeeze; alternate sides.",""],
 // Calves
 ["leg-press-calf-raise","Leg Press Calf Raise","Calves",["Calves"],"Machine",I,[12,20],"On the leg press, push the platform with the toes to full plantarflexion, stretch at the bottom.",""],
 ["single-leg-calf-raise","Single-Leg Calf Raise","Calves",["Calves"],"Dumbbell",I,[12,20],"Balance on one foot holding a dumbbell, rise to a full contraction and stretch down.",""],
 // Core
 ["pallof-press","Pallof Press","Core",["Core"],"Cable",I,[10,15],"Press a cable straight out from the chest and resist the rotational pull; log per side.","anti-rotation press"],
 ["reverse-crunch","Reverse Crunch","Core",["Core"],"Bodyweight",I,[12,20],"Curl the knees and hips toward the chest, lifting the tailbone off the floor.",""],
 // ── Commercial-gym selectorized machines (the Planet Fitness floor): every major movement has a
 //    pin-loaded option so a machine-only gym can still build a complete session ──────────────────
 ["assisted-pull-up","Assisted Pull-Up","Back",["Back","Biceps"],"Machine",C,[8,12],"Kneel on the assist pad and pull the chin over the handles; less assist weight = harder.","assisted pullup,pull-up machine,pullup machine,assisted chin"],
 ["assisted-dip","Assisted Dip","Triceps",["Triceps","Chest"],"Machine",C,[8,12],"Kneel or stand on the assist pad and press to lockout; the number you log is the ASSISTANCE, so less weight = harder.","assisted dip,assisted dips,dip machine,assisted tricep dip,gravitron dip"],
 ["machine-lateral-raise","Machine Lateral Raise","Shoulders",["Shoulders"],"Machine",I,[12,20],"Arms against the pads, raise out to the sides to shoulder height, control down.","lateral raise machine,side delt machine,shoulder machine"],
 ["machine-bicep-curl","Machine Bicep Curl","Biceps",["Biceps"],"Machine",I,[10,15],"Upper arms on the pad, curl the handles up and squeeze, lower fully.","bicep curl machine,arm curl machine,curl machine"],
 ["machine-tricep-extension","Machine Triceps Extension","Triceps",["Triceps"],"Machine",I,[10,15],"Upper arms on the pad, press the handles down to lockout, control back.","tricep extension machine,arm extension machine,triceps machine"],
 ["hip-adduction","Hip Adduction","Glutes",["Glutes","Quads"],"Machine",I,[12,20],"Squeeze the knees together against the pads (inner thigh), control the return.","adductor machine,inner thigh,hip adductor,thigh machine"],
 ["glute-kickback-machine","Glute Kickback Machine","Glutes",["Glutes"],"Machine",I,[12,15],"Drive one foot back and up against the platform, squeezing the glute at the top.","glute machine,kickback machine,glute press"],
 ["machine-hip-thrust","Machine Hip Thrust","Glutes",["Glutes","Hamstrings"],"Machine",C,[8,12],"Back on the pad with the belt across the hips, drive up and squeeze the glutes.","hip thrust machine,glute drive,glute bridge machine"],
 ["ab-crunch-machine","Ab Crunch Machine","Core",["Core"],"Machine",I,[12,20],"Curl the torso forward against the resistance, squeeze the abs, control up.","ab machine,crunch machine,abdominal machine"],
 ["torso-rotation-machine","Torso Rotation Machine","Core",["Core"],"Machine",I,[12,15],"Rotate the torso against the pad through a controlled range; log per side.","rotary torso,twist machine,oblique machine"],
 ["machine-back-extension","Machine Back Extension","Hamstrings",["Hamstrings","Glutes","Back"],"Machine",I,[12,20],"Push the pad back by extending the hips and lower back, control forward.","lower back machine,back extension machine,lumbar extension"],
 ["cable-wrist-curl","Cable Wrist Curl","Forearms",["Forearms"],"Cable",I,[12,20],"Forearms braced, curl the low-pulley handle up with the wrists, lower fully for a stretch.","low pulley wrist curl,cable forearm curl"],
 // Time-held additions (v0.50.0) — the "reps" field is SECONDS; use the ⏱ stopwatch on the card or type it in.
 ["dead-hang","Dead Hang","Forearms",["Forearms","Back"],"Bodyweight",I,[20,60],"Hang from a pull-up bar with a full grip and active shoulders; log seconds held.","bar hang,grip hang"],
 ["wall-sit","Wall Sit","Quads",["Quads","Glutes"],"Bodyweight",I,[30,60],"Slide down a wall to a 90° knee bend and hold; log seconds held.","wall squat hold"],
 ["side-plank","Side Plank","Core",["Core"],"Bodyweight",I,[20,45],"On one forearm, stack the hips and hold a straight line; log seconds per side.","side bridge"],
 ["hollow-hold","Hollow Hold","Core",["Core"],"Bodyweight",I,[20,45],"On your back, press the low back down and lift shoulders and legs into a dish; log seconds held.","hollow body hold"],
 ["suitcase-carry","Suitcase Carry","Forearms",["Forearms","Core"],"Dumbbell",C,[20,40],"Carry one heavy dumbbell at your side, resisting the lean; log seconds per side.","one arm carry,suitcase walk"],
 // v0.62.0 additions — machine/cable/dumbbell staples a Planet-Fitness-style gym has (the builder audit's
 // library-gap list). The Dumbbell RDL gives machine and home gyms a real hinge for the hamstrings.
 ["dumbbell-romanian-deadlift","Dumbbell Romanian Deadlift","Hamstrings",["Hamstrings","Glutes"],"Dumbbell",C,[8,12],"Dumbbells at the thighs, push the hips back with soft knees to a hamstring stretch, stand tall.","db rdl,dumbbell rdl"],
 ["incline-dumbbell-row","Incline Dumbbell Row","Back",["Back","Biceps"],"Dumbbell",C,[8,12],"Chest down on an incline bench, row both dumbbells to the hips, lower to a full stretch.","chest supported db row,prone db row"],
 ["cable-pull-through","Cable Pull-Through","Glutes",["Glutes","Hamstrings"],"Cable",C,[12,15],"Facing away from a low pulley, rope between the legs, hinge back and drive the hips through.","pull through"],
 ["dumbbell-split-squat","Dumbbell Split Squat","Quads",["Quads","Glutes"],"Dumbbell",C,[8,12],"Staggered stance with both feet down, drop the back knee straight down and drive up; log per side.","static lunge"],
 ["captains-chair-knee-raise","Captain's Chair Knee Raise","Core",["Core"],"Bodyweight",I,[10,15],"Back against the pad, forearms on the rests, lift the knees to the chest and lower slowly.","captains chair,vertical knee raise,knee raise"],
 ["low-to-high-cable-fly","Low-to-High Cable Fly","Chest",["Chest","Shoulders"],"Cable",I,[10,15],"From low pulleys, sweep the handles up and together to upper-chest height.","incline cable fly,low cable fly"],
 ["cable-reverse-fly","Cable Reverse Fly","Shoulders",["Shoulders","Back"],"Cable",I,[12,20],"Cross the cables at chest height and sweep the arms back and out for the rear delts.","cable rear delt fly"],
 ["single-arm-lat-pulldown","Single-Arm Cable Pulldown","Back",["Back","Biceps"],"Cable",C,[10,15],"Under a high pulley, pull one handle down to the side of the chest, then reach fully up.","one arm pulldown,single arm pulldown"],
 ["cable-woodchop","Cable Woodchop","Core",["Core"],"Cable",I,[10,15],"Rotate the handle diagonally across the body from high to low, turning through the hips; log per side.","woodchopper,wood chop"],
 ["rope-hammer-curl","Rope Hammer Curl","Biceps",["Biceps","Forearms"],"Cable",I,[10,15],"Curl a rope from the low pulley with a neutral grip, elbows pinned at your sides.","cable hammer curl"],
 ["dumbbell-skull-crusher","Dumbbell Skull Crusher","Triceps",["Triceps"],"Dumbbell",I,[10,15],"Lying on a bench, lower the dumbbells beside the head with elbows fixed, extend to lockout.","db skull crusher,lying db extension"],
 ["dead-bug","Dead Bug","Core",["Core"],"Bodyweight",I,[8,12],"On your back, low back pressed down, lower the opposite arm and leg and return; log reps per side.",""],
 ["dumbbell-shrug","Dumbbell Shrug","Shoulders",["Shoulders"],"Dumbbell",I,[10,15],"Dumbbells at your sides, lift the shoulders straight up toward the ears, pause, lower.","db shrug"],
 ["single-leg-rdl","Single-Leg Romanian Deadlift","Hamstrings",["Hamstrings","Glutes"],"Dumbbell",C,[8,12],"Hold a dumbbell, hinge on one leg as the other reaches back, return to standing; log per side.","single leg rdl,sl rdl"],
 // full-gym additions
 ["belt-squat","Belt Squat","Quads",["Quads","Glutes"],"Machine",C,[8,12],"Belt around the hips, squat to depth with an upright torso and drive up; no load on the spine.","belt squat machine"],
 ["chest-supported-t-bar-row","Chest-Supported T-Bar Row","Back",["Back","Biceps"],"Machine",C,[8,12],"Chest on the pad, row the handles to the ribs, squeeze, lower to a full stretch.","t-bar machine,t bar row machine"],
 ["trap-bar-deadlift","Trap Bar Deadlift","Back",["Back","Quads","Glutes","Hamstrings"],"Barbell",C,[4,8],"Stand inside the hex bar, brace, and push the floor away to stand tall.","hex bar deadlift,trap bar"]
];

// [region/head, movement pattern, tier]. tier 1 = foundational lift (can anchor a session and should be
// progressed consistently), 2 = secondary compound / key accessory, 3 = finisher / niche.
const META={
 'barbell-bench-press':['mid','hpush',1],'incline-barbell-press':['upper','hpush',1],'dumbbell-bench-press':['mid','hpush',1],'incline-dumbbell-press':['upper','hpush',1],'machine-chest-press':['mid','hpush',2],'dumbbell-fly':['mid','iso',3],'cable-crossover':['lower','iso',3],'pec-deck':['mid','iso',3],'push-up':['mid','hpush',2],'chest-dip':['lower','hpush',2],
 'deadlift':['lower','hinge',1],'pull-up':['lats','vpull',1],'chin-up':['lats','vpull',1],'lat-pulldown':['lats','vpull',1],'barbell-row':['mid','hpull',1],'dumbbell-row':['mid','hpull',2],'seated-cable-row':['mid','hpull',2],'t-bar-row':['mid','hpull',2],'straight-arm-pulldown':['lats','iso',3],'face-pull':['upper','hpull',3],
 'overhead-press':['front','vpush',1],'dumbbell-shoulder-press':['front','vpush',1],'arnold-press':['front','vpush',2],'lateral-raise':['side','iso',2],'front-raise':['front','iso',3],'rear-delt-fly':['rear','iso',2],'cable-lateral-raise':['side','iso',3],'upright-row':['side','vpull',3],'shrug':['traps','iso',3],
 'barbell-curl':['overall','iso',1],'dumbbell-curl':['overall','iso',1],'hammer-curl':['brachialis','iso',2],'preacher-curl':['short','iso',2],'incline-dumbbell-curl':['long','iso',2],'cable-curl':['overall','iso',3],
 'tricep-pushdown':['lateral','iso',2],'rope-pushdown':['lateral','iso',2],'overhead-tricep-extension':['long','iso',2],'skull-crusher':['long','iso',2],'close-grip-bench':['lateral','hpush',1],'tricep-dip':['lateral','hpush',1],'tricep-kickback':['lateral','iso',3],
 'back-squat':['overall','squat',1],'front-squat':['overall','squat',1],'leg-press':['overall','squat',1],'hack-squat':['overall','squat',2],'goblet-squat':['overall','squat',2],'bulgarian-split-squat':['overall','lunge',2],'walking-lunge':['overall','lunge',2],'leg-extension':['overall','iso',3],
 'romanian-deadlift':['overall','hinge',1],'lying-leg-curl':['overall','iso',2],'seated-leg-curl':['overall','iso',2],'stiff-leg-deadlift':['overall','hinge',1],'good-morning':['overall','hinge',2],
 'hip-thrust':['overall','hinge',1],'glute-bridge':['overall','iso',3],'cable-kickback':['overall','iso',3],'sumo-deadlift':['overall','hinge',1],
 'standing-calf-raise':['gastro','iso',1],'seated-calf-raise':['soleus','iso',2],
 'plank':['antiext','iso',2],'hanging-leg-raise':['flexion','iso',1],'cable-crunch':['flexion','iso',2],'russian-twist':['rotation','iso',3],'ab-wheel':['antiext','iso',1],'crunch':['flexion','iso',3],
 'nordic-curl':['overall','iso',2],'step-up':['overall','lunge',2],'chest-supported-row':['mid','hpull',2],'rack-pull':['lower','hinge',2],'landmine-press':['front','vpush',2],
 'wrist-curl':['flexor','iso',1],'reverse-wrist-curl':['extensor','iso',1],'reverse-curl':['extensor','iso',2],'farmers-carry':['grip','iso',1],'wrist-roller':['grip','iso',3],
 // v4 Phase D additions
 'machine-incline-press':['upper','hpush',2],'incline-dumbbell-fly':['upper','iso',3],'dumbbell-pullover':['lower','iso',3],
 'pendlay-row':['mid','hpull',2],'neutral-grip-pulldown':['lats','vpull',2],'single-arm-cable-row':['mid','hpull',2],'cable-pullover':['lats','iso',3],
 'machine-shoulder-press':['front','vpush',2],'reverse-pec-deck':['rear','iso',2],'leaning-cable-lateral':['side','iso',3],
 'ez-bar-curl':['overall','iso',2],'concentration-curl':['overall','iso',3],'bayesian-cable-curl':['long','iso',3],
 'cable-overhead-extension':['long','iso',2],'single-arm-pushdown':['lateral','iso',3],'machine-dip':['lateral','hpush',2],
 'sissy-squat':['overall','squat',3],'reverse-lunge':['overall','lunge',2],
 'back-extension':['overall','hinge',2],'single-leg-curl':['overall','iso',3],
 'hip-abduction':['medius','iso',2],'single-leg-hip-thrust':['overall','hinge',3],
 'leg-press-calf-raise':['gastro','iso',2],'single-leg-calf-raise':['gastro','iso',3],
 'pallof-press':['rotation','iso',2],'reverse-crunch':['flexion','iso',2],
 // commercial-gym machines
 'assisted-pull-up':['lats','vpull',2],'assisted-dip':['lateral','hpush',2],'machine-lateral-raise':['side','iso',2],'machine-bicep-curl':['overall','iso',2],'machine-tricep-extension':['lateral','iso',2],
 'hip-adduction':['overall','iso',3],'glute-kickback-machine':['overall','iso',2],'machine-hip-thrust':['overall','hinge',2],
 'ab-crunch-machine':['flexion','iso',2],'torso-rotation-machine':['rotation','iso',3],'machine-back-extension':['overall','hinge',2],'cable-wrist-curl':['flexor','iso',2],
 // time-held additions (v0.50.0)
 'dead-hang':['grip','iso',3],'wall-sit':['overall','iso',3],'side-plank':['rotation','iso',3],'hollow-hold':['antiext','iso',3],'suitcase-carry':['grip','iso',3],
 // v0.62.0 additions (tier 2 for the DB RDL on purpose — at tier 1 it would compete with the barbell RDL)
 'dumbbell-romanian-deadlift':['overall','hinge',2],'incline-dumbbell-row':['mid','hpull',2],'cable-pull-through':['overall','hinge',2],'dumbbell-split-squat':['overall','lunge',2],
 'captains-chair-knee-raise':['flexion','iso',2],'low-to-high-cable-fly':['upper','iso',3],'cable-reverse-fly':['rear','iso',3],'single-arm-lat-pulldown':['lats','vpull',3],
 'cable-woodchop':['rotation','iso',2],'rope-hammer-curl':['brachialis','iso',3],'dumbbell-skull-crusher':['long','iso',2],'dead-bug':['antiext','iso',3],'dumbbell-shrug':['traps','iso',3],'single-leg-rdl':['overall','hinge',3],
 'belt-squat':['overall','squat',2],'chest-supported-t-bar-row':['mid','hpull',2],'trap-bar-deadlift':['lower','hinge',2]
};
// Movements trained at a long muscle length (a strong hypertrophy driver) — the builder gives these a
// small preference so a plan tends to include a stretch-biased option per muscle. Existing lifts that
// already load the stretch are tagged here too.
const LONG_LENGTH=new Set(['incline-dumbbell-fly','dumbbell-pullover','cable-pullover','bayesian-cable-curl','incline-dumbbell-curl','cable-overhead-extension','overhead-tricep-extension','leaning-cable-lateral','sissy-squat','romanian-deadlift','stiff-leg-deadlift','seated-leg-curl','dumbbell-romanian-deadlift','single-leg-rdl']);
// Per-side accounting. A set's volume = weight × reps × how many times that weight moves:
//   holds — copies of the entered weight in motion at once (two dumbbells, two cable stacks) → ×2
//   sides — the entered reps are done once per side (one arm / one leg at a time)            → ×2
// UNILATERAL = done one side at a time by default: reps are PER SIDE (the column says so).
const UNILATERAL=new Set(['single-arm-cable-row','concentration-curl','single-arm-pushdown','reverse-lunge','single-leg-curl','single-leg-hip-thrust','single-leg-calf-raise','bulgarian-split-squat','walking-lunge','step-up','dumbbell-row','cable-kickback','side-plank','suitcase-carry','leaning-cable-lateral','single-leg-rdl','single-arm-lat-pulldown','dumbbell-split-squat','cable-woodchop','dead-bug']);
// Dumbbell lifts done with ONE dumbbell (held in both hands, or one hand only) — the entered weight
// moves once, not twice like a pair.
const ONE_DB=new Set(['goblet-squat','dumbbell-pullover','overhead-tricep-extension','dumbbell-row','concentration-curl','single-leg-calf-raise','suitcase-carry','single-leg-rdl']);
// Cable lifts that use two stacks at once (one handle per hand) — the entered weight is PER STACK.
const DUAL_STACK=new Set(['cable-crossover','low-to-high-cable-fly','cable-reverse-fly']);
// Assist machines where LESS weight is harder: progression REDUCES the load and a PR is the lowest
// assist, not the highest (#16). The engine flips the increment and the PR ranking for these ids.
const INVERTED_LOAD=new Set(['assisted-pull-up','assisted-dip']);
const isAssist=id=>INVERTED_LOAD.has(id);   // the ONE assist-machine check (review §8: it was hand-written ~10×)
// Time-held lifts: the "reps" field is SECONDS, not reps. So they carry no weight×reps volume and no
// 1RM estimate — a plank or a loaded carry is progressed by holding longer or adding load, and the
// engine shows load × seconds. They still count as SETS for balance/frequency/coach. (farmers-carry
// and plank already declare seconds in their target range and instructions; this makes the maths agree.)
const TIME_METRIC=new Set(['plank','farmers-carry','dead-hang','wall-sit','side-plank','hollow-hold','suitcase-carry']);

const EXERCISES=RAW.map(r=>{const m=META[r[0]]||['overall','iso',3];
  return {id:r[0],name:r[1],group:r[2],muscles:r[3],equip:r[4],type:r[5],rr:r[6],instr:r[7],alias:r[8],reg:m[0],pat:m[1],tier:m[2]||3};});
const EX={}; EXERCISES.forEach(e=>EX[e.id]=e);
const GROUPS=["Chest","Back","Shoulders","Biceps","Triceps","Forearms","Quads","Hamstrings","Glutes","Calves","Core"];
// One-tap muscle-group presets. A preset is JUST a named list of groups — tapping it selects those
// chips, and the builder still receives a plain groups[] (no new engine path). The first group leads
// the session (perfPriority focus). Pull omits Forearms so a typical pull day continues cleanly.
const PRESETS=[
 {label:'Full body',groups:['Quads','Chest','Back','Hamstrings','Shoulders']},
 {label:'Upper',    groups:['Chest','Back','Shoulders','Biceps','Triceps']},
 {label:'Lower',    groups:['Quads','Hamstrings','Glutes','Calves']},
 {label:'Push',     groups:['Chest','Shoulders','Triceps']},
 {label:'Pull',     groups:['Back','Biceps']},
 {label:'Arms',     groups:['Biceps','Triceps','Forearms']}
];

// Ideal region coverage per muscle group (what a well-rounded session hits)
const REGIONS={Chest:['upper','mid','lower'],Shoulders:['front','side','rear'],Back:['lats','mid','upper'],Biceps:['long','short','brachialis'],Triceps:['long','lateral'],Forearms:['flexor','extensor'],Quads:['overall'],Hamstrings:['overall'],Glutes:['overall','medius'],Calves:['gastro','soleus'],Core:['flexion','antiext','rotation']};
// Complementary movement patterns a muscle needs (hamstrings = a hinge AND a knee-flexion curl, etc.)
const IDEAL_PATS={Chest:['hpush','iso'],Back:['vpull','hpull'],Shoulders:['vpush','iso'],Biceps:['iso'],Triceps:['hpush','iso'],Forearms:['iso'],Quads:['squat','lunge','iso'],Hamstrings:['hinge','iso'],Glutes:['hinge','iso'],Calves:['iso'],Core:['iso']};
// Systemic demand of a pattern — drives session ordering (big lifts first)
const PAT_RANK={squat:6,hinge:6,vpush:4,hpush:4,vpull:4,hpull:4,lunge:3,iso:1};
const EQUIP_LOAD={Barbell:8,Machine:4,Dumbbell:5,Cable:2,Bodyweight:1,Other:1};

/* ── Equipment modality ──────────────────────────────────────────────────────────────────────────
   The same movement done with different equipment is a different thing to track: an overhead press
   is 25 lb/hand with dumbbells but 75 on a Smith machine, and progressive overload is only valid
   like-for-like. `mode` is an OPTIONAL tag on a logged exercise instance; when absent it's derived
   from the exercise's fixed `equip` (EQUIP_MODE), so all existing history reads correctly with no
   migration and the engine's default behavior is unchanged. Progression and PRs compare within
   (id, mode); the weight field labels itself per mode (perHand → "per dumbbell"); e1rm=false marks
   loads whose estimated 1RM isn't comparable to a free-weight 1RM (cable/machine stacks), so the PR
   board shows load, not a bogus 1RM. NOTE: equipment-normalized VOLUME (e.g. dumbbell ×2) is
   deliberately NOT applied here — doing so would retroactively change historical PR/volume numbers
   and is ambiguous for unilateral work; it's left for an explicit future opt-in. */
const MODES={
 barbell:{label:'Barbell',perHand:false,e1rm:true},
 dumbbell:{label:'Dumbbell',perHand:true,e1rm:true},
 smith:{label:'Smith machine',perHand:false,e1rm:true},
 machine:{label:'Machine',perHand:false,e1rm:false},
 cable:{label:'Cable',perHand:false,e1rm:false},
 bodyweight:{label:'Bodyweight',perHand:false,e1rm:true}
};
const MODE_ORDER=['barbell','dumbbell','smith','machine','cable','bodyweight'];
const EQUIP_MODE={Barbell:'barbell',Dumbbell:'dumbbell',Machine:'machine',Cable:'cable',Bodyweight:'bodyweight',Other:'machine'};
const LOWER_GROUPS=['Quads','Hamstrings','Glutes','Calves'];
// Fraction of bodyweight lifted on bodyweight moves (used when a bodyweight is set)
const BW_FACTOR={'pull-up':1,'chin-up':1,'chest-dip':1,'tricep-dip':1,'push-up':0.65};

const GROUP_ICON={
 Chest:'<path d="M12 7c-3-3-9-2-9 3 0 3 4 7 9 7s9-4 9-7c0-5-6-6-9-3z"/>',
 Back:'<path d="M12 3v18M6 7l6 3 6-3M6 13l6 3 6-3"/>',
 Shoulders:'<circle cx="6" cy="9" r="3"/><circle cx="18" cy="9" r="3"/><path d="M6 12v6M18 12v6"/>',
 Biceps:'<path d="M6 20c0-6 2-9 6-9s6 2 6 6c0 2-2 3-4 3M6 11V5l4 2"/>',
 Triceps:'<path d="M18 20c0-6-2-9-6-9s-6 2-6 6c0 2 2 3 4 3M18 11V5l-4 2"/>',
 Forearms:'<path d="M9 21V9c0-3 1.5-5 3-5s3 2 3 5v12M6 13h3M15 13h3"/>',
 Quads:'<path d="M8 3v8l-2 10M16 3v8l2 10M8 7h8"/>',
 Hamstrings:'<path d="M8 3v10l2 8M16 3v10l-2 8"/>',
 Glutes:'<path d="M12 4c-4 0-6 3-6 7s2 7 6 7 6-3 6-7-2-7-6-7zM12 4v14"/>',
 Calves:'<path d="M9 3c0 5 1 8 1 12l-1 6M15 3c0 5-1 8-1 12l1 6"/>',
 Core:'<rect x="8" y="4" width="8" height="16" rx="2"/><path d="M8 9h8M8 14h8M12 4v16"/>'
};
function exIcon(g){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+(GROUP_ICON[g]||GROUP_ICON.Core)+'</svg>';}

function regLabel(group,reg){
  const M={Chest:{upper:'upper chest',mid:'mid chest',lower:'lower chest'},Back:{lats:'lats (vertical pull)',mid:'mid-back',upper:'upper back / rear delts',lower:'lower back'},Shoulders:{front:'front delts',side:'side delts',rear:'rear delts',traps:'traps'},Biceps:{long:'biceps long head',short:'biceps short head',brachialis:'brachialis',overall:'biceps'},Triceps:{long:'triceps long head',lateral:'triceps lateral head'},Forearms:{flexor:'forearm flexors',extensor:'forearm extensors',grip:'grip strength'},Quads:{overall:'quads'},Hamstrings:{overall:'hamstrings'},Glutes:{overall:'glutes',medius:'glute medius (abductors)'},Calves:{gastro:'gastrocnemius (upper calf)',soleus:'soleus (lower calf)'},Core:{flexion:'ab flexion',antiext:'deep core',rotation:'rotational core'}};
  return (M[group]&&M[group][reg])||reg;
}
function patLabel(p){return {hpush:'horizontal press',vpush:'overhead press',hpull:'row',vpull:'pull-up / pulldown',hinge:'hip hinge',squat:'squat',lunge:'lunge',iso:'isolation'}[p]||p;}
function hashId(s){let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return h;}

IL.data={C,I,EXERCISES,EX,GROUPS,PRESETS,META,REGIONS,IDEAL_PATS,PAT_RANK,EQUIP_LOAD,MODES,MODE_ORDER,EQUIP_MODE,LONG_LENGTH,UNILATERAL,ONE_DB,DUAL_STACK,INVERTED_LOAD,isAssist,TIME_METRIC,LOWER_GROUPS,BW_FACTOR,GROUP_ICON,exIcon,regLabel,patLabel,hashId};
