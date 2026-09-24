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
  const pdfUrl="https://ftpserver.euroleague.net/media/2026-27_EL_RS_CALENDAR_PRINTABLE.pdf";
  const pdfPath="/tmp/euroleague-calendar.pdf";
  const txtPath="/tmp/euroleague-calendar.txt";
  const res=await fetch(pdfUrl,{headers:{"User-Agent":"EurolygosMenedzeris/1.0"}});
  if(!res.ok) throw new Error(`EuroLeague PDF HTTP ${res.status}`);
  await fs.writeFile(pdfPath,Buffer.from(await res.arrayBuffer()));
  const {execFileSync}=await import("node:child_process");
  execFileSync("pdftotext",["-layout",pdfPath,txtPath]);
  const raw=await fs.readFile(txtPath,"utf8");
  const aliases=[["CRVENA ZVEZDA MERIDIANBET BELGRADE","CZV"],["ZALGIRIS KAUNAS","ZAL"],["DUBAI BASKETBALL","DUB"],["REAL MADRID","RMA"],["HAPOEL IBI TEL AVIV","HAP"],["FC BAYERN MUNICH","BAY"],["FC BARCELONA","BAR"],["ANADOLU EFES ISTANBUL","EFE"],["KOSNER BASKONIA VITORIA-GASTEIZ","BAS"],["OLYMPIACOS PIRAEUS","OLY"],["LDLC ASVEL VILLEURBANNE","ASV"],["MACCABI RAPYD TEL AVIV","MAC"],["PANATHINAIKOS AKTOR ATHENS","PAN"],["PARIS BASKETBALL","PARI"],["BESIKTAS ISTANBUL","BJK"],["VALENCIA BASKET","VAL"],["FENERBAHCE ISTANBUL","FEN"],["VIRTUS BOLOGNA","VIR"],["PARTIZAN MOZZART BET BELGRADE","PAR"],["ARMANI OLIMPIA MILAN","MIL"]].sort((a,b)=>b[0].length-a[0].length);
  const games=[];
  for(const line of raw.split(/\r?\n/).map(x=>x.trim())){
    const m=line.match(/^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (\d{1,2} [A-Za-z]+ \d{4}) (\d{2}:\d{2}) (\d{2}:\d{2}) (.+)$/);
    if(!m) continue;
    const date=m[1],time=m[2],matchup=m[4];
    let homeCode=null,homeName=null;
    for(const [name,code] of aliases){if(matchup.startsWith(name+" ")){homeName=name;homeCode=code;break;}}
    if(!homeCode) continue;
    const awayName=matchup.slice(homeName.length).trim();
    const away=aliases.find(x=>x[0]===awayName);
    const homeTeam=teamByCode[homeCode],awayTeam=away&&teamByCode[away[1]];
    if(!homeTeam||!awayTeam) continue;
    games.push({homeTeam:homeTeam.team,homeManager:homeTeam.manager,awayTeam:awayTeam.team,awayManager:awayTeam.manager,date:new Date(date).toISOString().slice(0,10),time});
  }
  if(games.length!==380) throw new Error(`Official PDF parsed ${games.length} games, expected 380`);
  return games.map((g,i)=>({round:Math.floor(i/10)+1,g}));
}
try{
  try{ data.market=await getMarket(); }catch(e){ console.error("Krepsinis.net rinkos būsena nepavyko:",e.message); }
  const games=await getSchedule();
  const rounds=new Map();
  for(const {round,g} of games){
    if(!rounds.has(round)) rounds.set(round,[]);
    rounds.get(round).push(g);
  }
  for(const [round,pairings] of rounds){if(pairings.length!==10) throw new Error(`Round ${round} has ${pairings.length} games, expected 10`);}

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
