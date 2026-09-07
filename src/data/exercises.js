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
 ["leg-extension","Leg Extension","Quads",["Quads"],"Machine",I,[12,15],"Extend the knees against the pad to straight, control down.",""],
 // Hamstrings
 ["romanian-deadlift","Romanian Deadlift","Hamstrings",["Hamstrings","Glutes"],"Barbell",C,[8,12],"Hinge at the hips with soft knees, feel the hamstring stretch, stand.","rdl"],
 ["lying-leg-curl","Lying Leg Curl","Hamstrings",["Hamstrings"],"Machine",I,[10,15],"Curl the pad toward the glutes, control the return.","leg curl"],
 ["seated-leg-curl","Seated Leg Curl","Hamstrings",["Hamstrings"],"Machine",I,[10,15],"Curl the pad down and under, squeeze the hamstrings.",""],
 ["stiff-leg-deadlift","Stiff-Leg Deadlift","Hamstrings",["Hamstrings","Glutes"],"Barbell",C,[8,12],"Keep legs mostly straight and hinge to load the hamstrings.",""],
 ["good-morning","Good Morning","Hamstrings",["Hamstrings","Back"],"Barbell",C,[8,12],"Bar on the back, hinge forward with a flat back, return upright.",""],
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
 ["crunch","Crunch","Core",["Core"],"Bodyweight",I,[15,25],"Curl the shoulders off the floor, squeeze the abs, lower slowly.",""]
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
 'plank':['antiext','iso',2],'hanging-leg-raise':['flexion','iso',1],'cable-crunch':['flexion','iso',2],'russian-twist':['rotation','iso',3],'ab-wheel':['antiext','iso',1],'crunch':['flexion','iso',3]
};

const EXERCISES=RAW.map(r=>{const m=META[r[0]]||['overall','iso',3];
  return {id:r[0],name:r[1],group:r[2],muscles:r[3],equip:r[4],type:r[5],rr:r[6],instr:r[7],alias:r[8],reg:m[0],pat:m[1],tier:m[2]||3};});
const EX={}; EXERCISES.forEach(e=>EX[e.id]=e);
const GROUPS=["Chest","Back","Shoulders","Biceps","Triceps","Quads","Hamstrings","Glutes","Calves","Core"];

// Ideal region coverage per muscle group (what a well-rounded session hits)
const REGIONS={Chest:['upper','mid','lower'],Shoulders:['front','side','rear'],Back:['lats','mid','upper'],Biceps:['long','short','brachialis'],Triceps:['long','lateral'],Quads:['overall'],Hamstrings:['overall'],Glutes:['overall'],Calves:['gastro','soleus'],Core:['flexion','antiext','rotation']};
// Complementary movement patterns a muscle needs (hamstrings = a hinge AND a knee-flexion curl, etc.)
const IDEAL_PATS={Chest:['hpush','iso'],Back:['vpull','hpull'],Shoulders:['vpush','iso'],Biceps:['iso'],Triceps:['hpush','iso'],Quads:['squat','lunge','iso'],Hamstrings:['hinge','iso'],Glutes:['hinge','iso'],Calves:['iso'],Core:['iso']};
// Systemic demand of a pattern — drives session ordering (big lifts first)
const PAT_RANK={squat:6,hinge:6,vpush:4,hpush:4,vpull:4,hpull:4,lunge:3,iso:1};
const EQUIP_LOAD={Barbell:8,Machine:4,Dumbbell:5,Cable:2,Bodyweight:1};
const PUSH_PATS=['hpush','vpush'], PULL_PATS=['hpull','vpull'], LOWER_GROUPS=['Quads','Hamstrings','Glutes','Calves'];
// Fraction of bodyweight lifted on bodyweight moves (used when a bodyweight is set)
const BW_FACTOR={'pull-up':1,'chin-up':1,'chest-dip':1,'tricep-dip':1,'push-up':0.65};

const GROUP_ICON={
 Chest:'<path d="M12 7c-3-3-9-2-9 3 0 3 4 7 9 7s9-4 9-7c0-5-6-6-9-3z"/>',
 Back:'<path d="M12 3v18M6 7l6 3 6-3M6 13l6 3 6-3"/>',
 Shoulders:'<circle cx="6" cy="9" r="3"/><circle cx="18" cy="9" r="3"/><path d="M6 12v6M18 12v6"/>',
 Biceps:'<path d="M6 20c0-6 2-9 6-9s6 2 6 6c0 2-2 3-4 3M6 11V5l4 2"/>',
 Triceps:'<path d="M18 20c0-6-2-9-6-9s-6 2-6 6c0 2 2 3 4 3M18 11V5l-4 2"/>',
 Quads:'<path d="M8 3v8l-2 10M16 3v8l2 10M8 7h8"/>',
 Hamstrings:'<path d="M8 3v10l2 8M16 3v10l-2 8"/>',
 Glutes:'<path d="M12 4c-4 0-6 3-6 7s2 7 6 7 6-3 6-7-2-7-6-7zM12 4v14"/>',
 Calves:'<path d="M9 3c0 5 1 8 1 12l-1 6M15 3c0 5-1 8-1 12l1 6"/>',
 Core:'<rect x="8" y="4" width="8" height="16" rx="2"/><path d="M8 9h8M8 14h8M12 4v16"/>'
};
function exIcon(g){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+(GROUP_ICON[g]||GROUP_ICON.Core)+'</svg>';}

function regLabel(group,reg){
  const M={Chest:{upper:'upper chest',mid:'mid chest',lower:'lower chest'},Back:{lats:'lats (vertical pull)',mid:'mid-back',upper:'upper back / rear delts',lower:'lower back'},Shoulders:{front:'front delts',side:'side delts',rear:'rear delts',traps:'traps'},Biceps:{long:'biceps long head',short:'biceps short head',brachialis:'brachialis',overall:'biceps'},Triceps:{long:'triceps long head',lateral:'triceps lateral head'},Quads:{overall:'quads'},Hamstrings:{overall:'hamstrings'},Glutes:{overall:'glutes'},Calves:{gastro:'gastrocnemius (upper calf)',soleus:'soleus (lower calf)'},Core:{flexion:'ab flexion',antiext:'deep core',rotation:'rotational core'}};
  return (M[group]&&M[group][reg])||reg;
}
function patLabel(p){return {hpush:'horizontal press',vpush:'overhead press',hpull:'row',vpull:'pull-up / pulldown',hinge:'hip hinge',squat:'squat',lunge:'lunge',iso:'isolation'}[p]||p;}
function exampleFor(group,reg){const e=EXERCISES.find(x=>x.group===group&&x.reg===reg&&x.type===C)||EXERCISES.find(x=>x.group===group&&x.reg===reg);return e?e.name:null;}
function hashId(s){let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return h;}

IL.data={C,I,EXERCISES,EX,GROUPS,META,REGIONS,IDEAL_PATS,PAT_RANK,EQUIP_LOAD,PUSH_PATS,PULL_PATS,LOWER_GROUPS,BW_FACTOR,GROUP_ICON,exIcon,regLabel,patLabel,exampleFor,hashId};
