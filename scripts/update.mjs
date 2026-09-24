import fs from "node:fs/promises";

const path="data/league.json";
const data=JSON.parse(await fs.readFile(path,"utf8"));

const apiUrl="https://api-live.euroleague.net/v2/competitions/E/seasons/E2026/games";
const teamByCode=Object.fromEntries(data.teams.map(t=>[t.code,t]));
const oldByKey=new Map();

for(const r of data.rounds||[]){
  for(const g of r.pairings||[]){
    oldByKey.set(`${r.round}|${g.homeManager}|${g.awayManager}`,g);
  }
}

async function getSchedule(){
  const res=await fetch(apiUrl,{headers:{"User-Agent":"EurolygosMenedzeris/1.0"}});
  if(!res.ok) throw new Error(`EuroLeague API HTTP ${res.status}`);
  const payload=await res.json();
  return payload.data||payload;
}

try{
  const games=await getSchedule();
  const rounds=new Map();

  for(const g of games){
    if(g.phaseType?.code && g.phaseType.code!=="RS") continue;

    const homeCode=g.local?.club?.tvCode;
    const awayCode=g.road?.club?.tvCode;
    const home=teamByCode[homeCode];
    const away=teamByCode[awayCode];
    if(!home||!away||!g.round||!g.date) continue;

    if(!rounds.has(g.round)) rounds.set(g.round,[]);
    const old=oldByKey.get(`${g.round}|${home.manager}|${away.manager}`);

    rounds.get(g.round).push({
      homeTeam:home.team,
      homeManager:home.manager,
      awayTeam:away.team,
      awayManager:away.manager,
      time:old?.time||"—",
      date:g.date
    });
  }

  const schedule=[...rounds.entries()]
    .sort((a,b)=>a[0]-b[0])
    .map(([round,pairings])=>({
      round,
      start:pairings.map(g=>g.date).sort()[0],
      end:pairings.map(g=>g.date).sort().at(-1),
      pairings
    }));

  if(schedule.length){
    data.rounds=schedule;
    data.source.schedule="EuroLeague API • automatinis atnaujinimas";
  }

  data.source.lastUpdate=new Date().toISOString();
  await fs.writeFile(path,JSON.stringify(data,null,2)+"\n");
  console.log(`Atnaujinti ${schedule.length} turai iš EuroLeague API.`);
}catch(error){
  console.error("EuroLeague API nepavyko:",error.message);
  const url=process.env.DATA_URL;
  if(url){
    const res=await fetch(url,{headers:{"User-Agent":"EurolygosMenedzeris/1.0"}});
    if(res.ok){
      const payload=await res.json();
      if(payload.rounds) data.rounds=payload.rounds;
      if(payload.managerScores) for(const [manager,score] of Object.entries(payload.managerScores)) data.scores[manager]={...(data.scores[manager]||{}),managerPoints:score};
    }
  }
  data.source.lastUpdate=new Date().toISOString();
  await fs.writeFile(path,JSON.stringify(data,null,2)+"\n");
}
