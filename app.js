let data;
const $=s=>document.querySelector(s);

async function load(){
  try{data=await fetch("data/league.json?x="+Date.now()).then(r=>r.json())}
  catch(e){$("#status").innerHTML="<strong>Nepavyko įkelti lygos duomenų.</strong>";return}
  render("home"); startClock();
  $("#status").innerHTML="<strong>Lyga paruošta.</strong> <span>Taškus galima pateikti per Admin langą.</span>";
}
function round(){return data.rounds[0]}
function render(v){document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("active",b.dataset.view===v));$("#app").innerHTML=v==="home"?home():v==="standings"?standings():v==="schedule"?schedule():v==="results"?results():teams()}
function home(){return `<div class="grid"><section class="card"><div class="card-head"><div class="eyebrow">KITAS TURAS</div><h2>Rugsėjo 24–25 d.</h2></div>${round().pairings.map(game).join("")}</section>${standings()}</div>`}
function game(g){return `<div class="game"><div class="team">${g.homeTeam}<small>${g.homeManager}</small></div><div class="time">${g.time}<small>${g.date}</small></div><div class="team">${g.awayTeam}<small>${g.awayManager}</small></div></div>`}
function standings(){let rows=data.teams.map(t=>({...t,...(data.scores[t.manager]||{})})).sort((a,b)=>(b.pts||0)-(a.pts||0));return `<section class="card"><div class="card-head"><div class="eyebrow">BENDRA ĮSKAITA</div><h2>Turnyro lentelė</h2></div><div class="table-wrap"><table class="table"><thead><tr><th>#</th><th>Komanda</th><th>Vadybininkas</th><th>W</th><th>L</th><th>B</th><th>PTS</th></tr></thead><tbody>${rows.map((t,i)=>`<tr class="${i<6?"zone-playoff":i<10?"zone-playin":""}"><td>${i+1}</td><td><b>${t.team}</b></td><td>${t.manager}</td><td class="num">${t.w||0}</td><td class="num">${t.l||0}</td><td class="num">${t.b||0}</td><td class="num score">${t.pts||0}</td></tr>`).join("")}</tbody></table></div></section>`}
function schedule(){return `<section class="card"><div class="card-head"><div class="eyebrow">TVARKARAŠTIS</div><h2>Vadybininkų tarpusavio mačai</h2></div>${round().pairings.map((g,i)=>`<div class="result"><div><b>${i+1} mačas</b><br>${g.homeTeam} <span class="muted">(${g.homeManager})</span></div><b>VS</b><div>${g.awayTeam} <span class="muted">(${g.awayManager})</span></div></div>`).join("")}</section>`}
function results(){return `<section class="card"><div class="card-head"><div class="eyebrow">REZULTATAI</div><h2>1 turo rezultatai</h2></div>${round().pairings.map(g=>{let a=data.scores[g.homeManager]?.managerPoints,b=data.scores[g.awayManager]?.managerPoints;return `<div class="result"><div><b>${g.homeManager}</b><br><span class="muted">${g.homeTeam}</span></div><div class="pts">${a??"—"} : ${b??"—"}</div><div><b>${g.awayManager}</b><br><span class="muted">${g.awayTeam}</span></div></div>`}).join("")}</section>`}
function teams(){return `<section class="card"><div class="card-head"><div class="eyebrow">KOMANDOS</div><h2>20 vadybininkų</h2></div><div class="teamgrid">${data.teams.map(t=>`<div class="teamcard"><div class="logo">${t.code}</div><b>${t.team}</b><div class="muted">${t.manager}</div></div>`).join("")}</div></section>`}
function startClock(){let target=new Date(round().start+"T19:00:00+03:00");setInterval(()=>{let d=Math.max(0,target-new Date()),days=Math.floor(d/86400000),h=Math.floor(d/3600000)%24,m=Math.floor(d/60000)%60;$("#countdown").textContent=`${String(days).padStart(2,"0")} d. ${String(h).padStart(2,"0")} val. ${String(m).padStart(2,"0")} min.`},1000)}
function openAdmin(){$("#adminModal").hidden=false;$("#adminHelp").textContent="";$("#pointsRows").innerHTML=data.teams.map(t=>"<div class=\"point-row\"><label>"+t.manager+"<span>"+t.team+"</span></label><input class=\"manager-points\" data-manager=\""+t.manager+"\" type=\"number\" step=\"0.01\" placeholder=\"Taškai\"></div>").join("");$("#pointsInput").value="";$("#adminPassword").value=""}
function collectPointRows(){const out={};document.querySelectorAll(".manager-points").forEach(i=>{if(i.value.trim()!=="")out[i.dataset.manager]=Number(i.value)});return out}
function parsePoints(text){const out={};for(const raw of text.split(/\r?\n/)){const line=raw.trim();if(!line||line.startsWith("#"))continue;const m=line.match(/^(.+?)\s*[,;:\t]\s*(-?\d+(?:[.,]\d+)?)$/);if(m)out[m[1].trim()]=Number(m[2].replace(",","."))}return out}
function savePoints(){
  const points={...collectPointRows(),...parsePoints($("#pointsInput").value)};
  const managers=new Set(data.teams.map(t=>t.manager));
  const missing=data.teams.filter(t=>points[t.manager]===undefined).map(t=>t.manager);
  const unknown=Object.keys(points).filter(k=>!managers.has(k));
  if(missing.length){$("#adminHelp").textContent="Trūksta taškų: "+missing.join(", ");return}
  if(unknown.length){$("#adminHelp").textContent="Nerasti vadybininkai: "+unknown.join(", ");return}
  const lines=data.teams.map(t=>t.manager+", "+points[t.manager]).join("\n");
  const body="Įklijuoti/įvesti turo taškai.\n\n"+lines;
  const url="https://github.com/guuris/Eurolygos-menedzeri/issues/new?title="+encodeURIComponent("[TAŠKAI] "+round().round+" turas")+"&body="+encodeURIComponent(body);
  window.open(url,"_blank");
  $("#adminHelp").textContent="Atsidarė GitHub langas. Ten paspauskite „Submit new issue“. Tada taškai bus automatiškai įkelti į lentelę.";
}
document.addEventListener("click",e=>{if(e.target.matches("nav button"))render(e.target.dataset.view);if(e.target.closest("#adminBtn"))openAdmin();if(e.target.id==="closeAdmin")$("#adminModal").hidden=true;if(e.target.id==="applyPoints")savePoints()});
$("#pointsFile").addEventListener("change",e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>$("#pointsInput").value=r.result;r.readAsText(f)});
load();