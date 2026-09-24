import fs from "node:fs";

const issueBody=process.env.ISSUE_BODY||"";
const issueAuthor=process.env.ISSUE_AUTHOR||"";
if(issueAuthor!=="guuris") throw new Error("Neleistinas autorius.");

const data=JSON.parse(fs.readFileSync("data/league.json","utf8"));
async function refreshOfficialSchedule(data){
  const res=await fetch("https://api-live.euroleague.net/v2/competitions/E/seasons/E2026/games",{headers:{"User-Agent":"EurolygosMenedzeris/1.0"}});
  if(!res.ok) throw new Error(`EuroLeague API HTTP ${res.status}`);
  const payload=await res.json();
  const games=Array.isArray(payload.data)?payload.data:[];
  if(games.length!==380) throw new Error(`EuroLeague API returned ${games.length} games, expected 380`);
  const map={HTA:"HAP",BAY:"BAY",DUB:"DUB",RMB:"RMA",CZV:"CZV",ZAL:"ZAL",PAO:"PAN",PBB:"PARI",BAR:"BAR",EFS:"EFE",KBA:"BAS",OLY:"OLY",ASV:"ASV",MTA:"MAC",BJK:"BJK",VBC:"VAL",FEN:"FEN",VIR:"VIR",PAR:"PAR",EA7:"MIL"};
  const getCode=x=>x?.club?.tvCode||x?.club?.code||x?.team?.tvCode||x?.team?.code||x?.tvCode||x?.code;
  const getRound=g=>Number(g?.round?.roundNumber??g?.round?.number??g?.round?.round??g?.roundNumber??g?.round);
  const getDate=g=>g?.date||g?.startDate||g?.gameDate||"";
  const rounds=new Map();
  for(const g of games){
    const round=getRound(g), hc=map[getCode(g.local)], ac=map[getCode(g.road)];
    const home=data.teams.find(t=>t.code===hc), away=data.teams.find(t=>t.code===ac);
    if(!Number.isFinite(round)||round<1||round>38||!home||!away) continue;
    const dt=new Date(getDate(g));
    const date=Number.isNaN(dt.getTime())?String(getDate(g)).slice(0,10):dt.toISOString().slice(0,10);
    const time=Number.isNaN(dt.getTime())?"—":new Intl.DateTimeFormat("lt-LT",{timeZone:"Europe/Vilnius",hour:"2-digit",minute:"2-digit",hour12:false}).format(dt);
    if(!rounds.has(round)) rounds.set(round,[]);
    rounds.get(round).push({homeTeam:home.team,homeManager:home.manager,awayTeam:away.team,awayManager:away.manager,date,time});
  }
  if(rounds.size!==38) throw new Error(`EuroLeague API returned only ${rounds.size} rounds`);
  for(const [r,p] of rounds) if(p.length!==10) throw new Error(`Round ${r} has ${p.length} games, expected 10`);
  data.rounds=[...rounds.entries()].sort((a,b)=>a[0]-b[0]).map(([round,pairings])=>({round,start:pairings[0].date,end:pairings[pairings.length-1].date,pairings}));
  data.source.schedule="EuroLeague official API • 38 turai × 10 rungtynių";
  data.source.lastUpdate=new Date().toISOString();
}

const title=process.env.ISSUE_TITLE||"";
if(title.startsWith("[TAŠKAI]") && /ATNAUJINTI TVARKARAŠTĮ/i.test(issueBody)){
  const {execFileSync}=await import("node:child_process");
  execFileSync("python",["scripts/build-schedule.py"],{stdio:"inherit"});
  await refreshOfficialSchedule(data);
  fs.writeFileSync("data/league.json",JSON.stringify(data,null,2)+"\
");
  process.exit(0);
}

const currentRound=String(data.rounds[0].round);

if(title.startsWith("[ANULIUOTI]")){
  data.roundPoints=data.roundPoints||{};
  delete data.roundPoints[currentRound];
  data.scores={};
  for(const t of data.teams) data.scores[t.manager]={round:data.rounds[0].round,managerPoints:null,w:0,l:0,b:0,pm:0,pts:0};
  for(const r of data.rounds){
    const rp=data.roundPoints[String(r.round)];
    if(!rp) continue;
    for(const g of r.pairings){
      const a=Number(rp[g.homeManager]),b=Number(rp[g.awayManager]);
      if(!Number.isFinite(a)||!Number.isFinite(b)) continue;
      if(a>b){data.scores[g.homeManager].w++;data.scores[g.awayManager].l++;data.scores[g.homeManager].pts+=3}
      else if(b>a){data.scores[g.awayManager].w++;data.scores[g.homeManager].l++;data.scores[g.awayManager].pts+=3}
      else{data.scores[g.homeManager].w++;data.scores[g.awayManager].l++;data.scores[g.homeManager].pts+=3}
    }
  }
  data.source.managerScores="GitHub • administratoriaus įvesti taškai";
  fs.writeFileSync("data/league.json",JSON.stringify(data,null,2)+"\\n");
  process.exit(0);
}

const points={};
for(const line of issueBody.split(/\\r?\\n/)){
  const m=line.trim().match(/^(.+?)\s*,\s*(-?\d+(?:[.,]\d+)?)$/);
  if(m) points[m[1].trim()]=Number(m[2].replace(",","."));
}
const managers=new Set(data.teams.map(t=>t.manager));
const missing=data.teams.filter(t=>points[t.manager]===undefined).map(t=>t.manager);
const unknown=Object.keys(points).filter(k=>!managers.has(k));
if(missing.length) throw new Error("Trūksta: "+missing.join(", "));
if(unknown.length) throw new Error("Nerasti: "+unknown.join(", "));

data.roundPoints=data.roundPoints||{};
data.roundPoints[String(data.rounds[0].round)]=points;

const totals={};
for(const t of data.teams) totals[t.manager]={round:data.rounds[0].round,managerPoints:null,w:0,l:0,b:0,pm:0,pts:0};

for(const r of data.rounds){
  const rp=data.roundPoints[String(r.round)];
  if(!rp) continue;
  for(const t of data.teams) if(rp[t.manager]!==undefined) totals[t.manager].managerPoints=Number(rp[t.manager]);
  for(const g of r.pairings){
    const a=Number(rp[g.homeManager]), b=Number(rp[g.awayManager]);
    if(!Number.isFinite(a)||!Number.isFinite(b)) continue;
    if(a>b){totals[g.homeManager].w++;totals[g.awayManager].l++;totals[g.homeManager].pts+=3}
    else if(b>a){totals[g.awayManager].w++;totals[g.homeManager].l++;totals[g.awayManager].pts+=3}
    else{totals[g.homeManager].w++;totals[g.awayManager].l++;totals[g.homeManager].pts+=3}
  }
  const known=data.teams.map(t=>Number(rp[t.manager])).filter(Number.isFinite);
  if(known.length){
    const max=Math.max(...known);
    for(const t of data.teams) if(Number(rp[t.manager])===max) totals[t.manager].pts+=Number(data.bonusPoints||0);
  }
}
data.scores=totals;
data.source.managerScores="GitHub • administratoriaus įvesti taškai";
fs.writeFileSync("data/league.json",JSON.stringify(data,null,2)+"\\n");
