import fs from "node:fs/promises";
const path="data/league.json";
const data=JSON.parse(await fs.readFile(path,"utf8"));
const managerUrl="https://rc.krepsinis.net/manager/management/140?apiKey=3d76bfb2f3192fd90b9559922840de21";

async function getMarket(){
  const res=await fetch(managerUrl,{headers:{"User-Agent":"EurolygosMenedzeris/1.0"}});
  if(!res.ok) throw new Error(`Krepsinis.net HTTP ${res.status}`);
  const html=await res.text();
  return {status:/Šiuo metu žaidėjų turgus atidarytas/i.test(html)?"open":/Šiuo metu žaidėjų turgus uždarytas/i.test(html)?"closed":"unknown",source:"Krepsinis.net Eurolygos menedžeris"};
}
const map={HTA:"HAP",BAY:"BAY",DUB:"DUB",RMB:"RMA",CZV:"CZV",ZAL:"ZAL",PAO:"PAN",PBB:"PARI",BAR:"BAR",EFS:"EFE",KBA:"BAS",OLY:"OLY",ASV:"ASV",MTA:"MAC",BJK:"BJK",VBC:"VAL",FBT:"FEN",FEN:"FEN",VIR:"VIR",PAR:"PAR",EA7:"MIL"};
const teams=Object.fromEntries(data.teams.map(t=>[t.code,t]));
const code=x=>String(x?.club?.tvCode||x?.club?.code||x?.team?.tvCode||x?.team?.code||x?.tvCode||x?.code||"").trim();
const roundOf=g=>Number(g?.round?.roundNumber??g?.round?.number??g?.round?.round??g?.roundNumber??g?.round);
const dateOf=g=>g?.date||g?.startDate||g?.gameDate||g?.startTime||g?.startDateTime||"";

async function getSchedule(){
  const res=await fetch("https://api-live.euroleague.net/v2/competitions/E/seasons/E2026/games",{headers:{"User-Agent":"EurolygosMenedzeris/1.0"}});
  if(!res.ok) throw new Error(`EuroLeague API HTTP ${res.status}`);
  const payload=await res.json();
  const games=Array.isArray(payload.data)?payload.data:Array.isArray(payload.games)?payload.games:[];
  if(games.length<380) throw new Error(`EuroLeague API returned ${games.length} games, expected at least 380`);
  const rounds=new Map();
  for(const g of games){
    const r=roundOf(g), h=teams[map[code(g.local)]], a=teams[map[code(g.road)]];
    if(r<1||r>38||!h||!a) continue;
    const raw=String(dateOf(g));
    const dt=new Date(raw);
    const date=Number.isNaN(dt.getTime())?raw.slice(0,10):dt.toISOString().slice(0,10);
    const time=Number.isNaN(dt.getTime())?"—":new Intl.DateTimeFormat("lt-LT",{timeZone:"Europe/Vilnius",hour:"2-digit",minute:"2-digit",hour12:false}).format(dt);
    if(!rounds.has(r)) rounds.set(r,[]);
    rounds.get(r).push({homeTeam:h.team,homeManager:h.manager,awayTeam:a.team,awayManager:a.manager,date,time});
  }
  if(rounds.size!==38) throw new Error(`Parsed ${rounds.size} rounds, expected 38`);
  for(const [r,p] of rounds) if(p.length!==10) throw new Error(`Round ${r} has ${p.length} games, expected 10`);
  return [...rounds.entries()].sort((a,b)=>a[0]-b[0]).map(([round,pairings])=>({round,start:pairings[0].date,end:pairings.at(-1).date,pairings}));
}

try{
  try{data.market=await getMarket();}catch(e){console.warn("Rinkos būsena nepasiekta:",e.message);}
  data.rounds=await getSchedule();
  data.source.schedule="EuroLeague oficialus API • 38 turai × 10 rungtynių";
  data.source.lastUpdate=new Date().toISOString();
  await fs.writeFile(path,JSON.stringify(data,null,2)+"\n");
  console.log("Tvarkaraštis atnaujintas: 38 turai × 10 rungtynių.");
}catch(e){
  console.error("Tvarkaraščio atnaujinti nepavyko:",e.message);
  process.exitCode=1;
}