import fs from "node:fs";

const issueBody=process.env.ISSUE_BODY||"";
const issueAuthor=process.env.ISSUE_AUTHOR||"";
if(issueAuthor!=="guuris") throw new Error("Neleistinas autorius.");

const data=JSON.parse(fs.readFileSync("data/league.json","utf8"));
const title=process.env.ISSUE_TITLE||"";
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
  fs.writeFileSync("data/league.json",JSON.stringify(data,null,2)+"\n");
  process.exit(0);
}

const points={};
for(const line of issueBody.split(/\r?\n/)){
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
fs.writeFileSync("data/league.json",JSON.stringify(data,null,2)+"\n");
