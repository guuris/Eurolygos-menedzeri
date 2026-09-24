import fs from "node:fs/promises";

const path="data/league.json";
const data=JSON.parse(await fs.readFile(path,"utf8"));

const apiUrl="https://api-live.euroleague.net/v2/competitions/E/seasons/E2026/games";
const managerUrl="https://rc.krepsinis.net/manager/management/140?apiKey=3d76bfb2f3192fd90b9559922840de21";

async function getMarket(){
  const res=await fetch(managerUrl,{headers:{"User-Agent":"EurolygosMenedzeris/1.0"}});
  if(!res.ok) throw new Error(`Krepsinis.net HTTP ${res.status}`);
  const html=await res.text();
  const open=html.match(/Šiuo metu žaidėjų turgus atidarytas/i);
  const closed=html.match(/Šiuo metu žaidėjų turgus uždarytas/i);
  const close=html.match(/Jis užsidarys\s*-\s*([0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2})/i);
  const next=html.match(/Jis atsidarys\s*-\s*([0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2})/i);
  return {status:open?"open":closed?"closed":"unknown",closesAt:close?.[1]||null,opensAt:next?.[1]||null,source:"Krepsinis.net Eurolygos menedžeris"};
}
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
  const games=Array.isArray(payload.data)?payload.data:[];
  if(games.length<380) throw new Error(`EuroLeague API returned ${games.length} games, expected at least 380`);
  return games
    .filter(g=>!g.phaseType?.code || g.phaseType.code==="RS")
    .map(g=>({g,round:Number(g.round?.round||g.round?.number||g.round)}))
    .filter(x=>Number.isFinite(x.round)&&x.round>=1&&x.round<=38)
    .sort((a,b)=>a.round-b.round || String(a.g.date||"").localeCompare(String(b.g.date||"")));
}
try{
  try{ data.market=await getMarket(); }catch(e){ console.error("Krepsinis.net rinkos būsena nepavyko:",e.message); }
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
    .map(([round,pairings])=>({round,start:pairings[0].date,end:pairings.at(-1).date,pairings}));

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
}  const games=await getSchedule();
  const rounds=new Map();
  const apiToOur={RMB:"RMA",FBB:"FEN",HTA:"HAP",FCB:"BAY",KBA:"BAS",PBB:"PARI",PAO:"PAN",EFS:"EFE",MTA:"MAC",VBC:"VAL",EA7:"MIL",PAR:"PAR",VIR:"VIR",ASV:"ASV",BJK:"BJK",CZV:"CZV",ZAL:"ZAL",DUB:"DUB",BAR:"BAR",OLY:"OLY"};
  for(const {g,round} of games){
    const homeCode=apiToOur[g.local?.club?.tvCode];
    const awayCode=apiToOur[g.road?.club?.tvCode];
    const home=teamByCode[homeCode], away=teamByCode[awayCode];
    if(!home||!away) continue;
    if(!rounds.has(round)) rounds.set(round,[]);
    const old=oldByKey.get(`${round}|${home.manager}|${away.manager}`);
    const dt=g.date||g.startDate||"";
    rounds.get(round).push({
      homeTeam:home.team,homeManager:home.manager,awayTeam:away.team,awayManager:away.manager,
      time:old?.time||"—",date:String(dt).slice(0,10)
    });
  }
  for(const [round,pairings] of rounds) if(pairings.length!==10) throw new Error(`Round ${round} has ${pairings.length} games, expected 10`);

  const schedule=[...rounds.entries()]
    .sort((a,b)=>a[0]-b[0])
    .map(([round,pairings])=>({round,start:pairings[0].date,end:pairings.at(-1).date,pairings}));

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
