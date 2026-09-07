// Sample data for the shareable demo build: ~5 weeks of a realistic push / pull / legs rotation
// with progressive loading, warm-up sets, bodyweight moves and saved routines. Dates are relative
// to "now" so the calendar, streak and analysis always look alive.
var IL=globalThis.IL||(globalThis.IL={});

function make(now){
  const {EX}=IL.data;const DAY=86400000;
  const at=(daysAgo,hour)=>{const t=new Date(now-daysAgo*DAY);t.setHours(hour||17,25,0,0);return t.getTime();};
  let n=0;
  const S=(daysAgo,exs,hour)=>({id:'demo-'+(++n),schema:1,date:at(daysAgo,hour),updatedAt:at(daysAgo,hour),completed:true,
    exercises:exs.map(([id,sets])=>({id,name:EX[id].name,sets:sets.map(s=>({w:s[0],r:s[1],done:true,warm:!!s[2]}))}))});
  // k = weeks ago (0 = this week). Loads climb as k falls.
  const up=(base,step,k)=>base+step*(4-k);
  const push=k=>[
    ['barbell-bench-press',[[95,8,1],[up(135,5,k),8],[up(135,5,k),8],[up(135,5,k),k===0?8:7]]],
    ['incline-dumbbell-press',[[up(50,2.5,k),10],[up(50,2.5,k),10],[up(50,2.5,k),9]]],
    ['overhead-press',[[65,6,1],[up(85,2.5,k),6],[up(85,2.5,k),6],[up(85,2.5,k),5]]],
    ['lateral-raise',[[20,15],[20,14],[20,12]]],
    ['chest-dip',[[0,10],[0,9],[0,8]]],
    ['tricep-pushdown',[[up(50,2.5,k),12],[up(50,2.5,k),12],[up(50,2.5,k),11]]]
  ];
  const pull=k=>[
    ['deadlift',[[135,5,1],[185,3,1],[up(225,10,k),5],[up(225,10,k),5],[up(225,10,k),4]]],
    ['pull-up',[[0,10-Math.floor(k/2)],[0,9-Math.floor(k/2)],[0,8-Math.floor(k/2)]]],
    ['barbell-row',[[up(115,5,k),8],[up(115,5,k),8],[up(115,5,k),8]]],
    ['lat-pulldown',[[up(120,5,k),10],[up(120,5,k),10],[up(120,5,k),9]]],
    ['barbell-curl',[[up(60,2.5,k),10],[up(60,2.5,k),10],[up(60,2.5,k),8]]],
    ['hammer-curl',[[30,12],[30,12],[30,10]]]
  ];
  const legs=k=>[
    ['back-squat',[[135,5,1],[up(185,10,k),5],[up(185,10,k),5],[up(185,10,k),5],[up(185,10,k),k===0?5:4]]],
    ['romanian-deadlift',[[up(155,10,k),8],[up(155,10,k),8],[up(155,10,k),8]]],
    ['leg-press',[[up(270,20,k),12],[up(270,20,k),12],[up(270,20,k),10]]],
    ['lying-leg-curl',[[up(80,5,k),12],[up(80,5,k),12],[up(80,5,k),10]]],
    ['leg-extension',[[90,15],[90,15]]],
    ['standing-calf-raise',[[135,15],[135,15],[135,12]]]
  ];
  const sessions=[];
  for(let k=0;k<5;k++){
    sessions.push(S(2+7*k,push(k),18));
    sessions.push(S(4+7*k,pull(k),17));
    sessions.push(S(6+7*k,legs(k),7));
  }
  // a couple of extra "arms & core" days so the calendar isn't perfectly regular
  sessions.push(S(9,[['incline-dumbbell-curl',[[25,12],[25,12],[25,10]]],['skull-crusher',[[55,10],[55,10],[55,9]]],['hanging-leg-raise',[[0,12],[0,12],[0,10]]],['plank',[[0,60],[0,45]]]],12));
  sessions.push(S(23,[['dumbbell-curl',[[30,12],[30,12],[30,10]]],['rope-pushdown',[[45,15],[45,15],[45,12]]],['ab-wheel',[[0,10],[0,10],[0,8]]]],12));
  sessions.sort((a,b)=>b.date-a.date);
  const routines=[
    {id:'demo-r1',name:'Push A',exIds:push(0).map(x=>x[0]),updatedAt:at(2)},
    {id:'demo-r2',name:'Pull A',exIds:pull(0).map(x=>x[0]),updatedAt:at(4)},
    {id:'demo-r3',name:'Legs A',exIds:legs(0).map(x=>x[0]),updatedAt:at(6)}
  ];
  return {sessions,routines,settings:{unit:'lb',bodyweight:180}};
}

IL.seed={make};
if(typeof module!=='undefined')module.exports=IL.seed;
