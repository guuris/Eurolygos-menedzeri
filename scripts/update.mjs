import fs from "node:fs/promises";
const path="data/league.json";
const data=JSON.parse(await fs.readFile(path,"utf8"));
const schedulePath="data/official-schedule.json";

async function getMarket(){
  const res=await fetch("https://rc.krepsinis.net/manager/management/140?apiKey=3d76bfb2f3192fd90b9559922840de21",{headers:{"User-Agent":"EurolygosMenedzeris/1.0"}});
  if(!res.ok) throw new Error(`Krepsinis.net HTTP ${res.status}`);
  const html=await res.text();
  return {status:/Šiuo metu žaidėjų turgus atidarytas/i.test(html)?"open":/Šiuo metu žaidėjų turgus uždarytas/i.test(html)?"closed":"unknown",source:"Krepsinis.net Eurolygos menedžeris"};
}

async function getSchedule(){
  const parsed=JSON.parse(await fs.readFile(schedulePath,"utf8"));
  if(!Array.isArray(parsed)||parsed.length!==380) throw new Error(`Official schedule contains ${parsed.length}, expected 380`);
  const teamByCode=Object.fromEntries(data.teams.map(t=>[t.code,t]));
  const rounds=[];
  for(let i=0;i<38;i++){
    const raw=parsed.slice(i*10,i*10+10);
    if(raw.length!==10) throw new Error(`Round ${i+1} has ${raw.length} games`);
    const pairings=raw.map(g=>{
      const h=teamByCode[g.home], a=teamByCode[g.away];
      if(!h||!a) throw new Error(`Unknown team code: ${g.home} / ${g.away}`);
      return {homeTeam:h.team,homeManager:h.manager,awayTeam:a.team,awayManager:a.manager,date:g.date,time:g.time};
    });
    rounds.push({round:i+1,start:pairings[0].date,end:pairings.at(-1).date,pairings});
  }
  return rounds;
}

try{
  try{data.market=await getMarket();}catch(e){console.warn("Rinkos būsena nepasiekta:",e.message);}
  data.rounds=await getSchedule();
  data.source.schedule="EuroLeague oficialus 2026–27 kalendoriaus PDF • 38 turai × 10 rungtynių";
  data.source.lastUpdate=new Date().toISOString();
  await fs.writeFile(path,JSON.stringify(data,null,2)+"\n");
  console.log("Tvarkaraštis atnaujintas: 38 turai × 10 rungtynių.");
}catch(e){
  console.error("Tvarkaraščio atnaujinti nepavyko:",e.message);
  process.exitCode=1;
}