from html.parser import HTMLParser
from urllib.request import Request, urlopen
import re, html, json
from datetime import datetime

URL="https://www.gigantes.com/euroliga/calendario-euroliga-2026-27-partidos-horarios-jornadas/"
TEAM_MAP={
"DUBAI BASKETBALL":"DUB","REAL MADRID":"RMA","HAPOEL IBI TEL AVIV":"HAP","FC BAYERN MUNICH":"BAY",
"CRVENA ZVEZDA MERIDIANBET BELGRADE":"CZV","ZALGIRIS KAUNAS":"ZAL","PANATHINAIKOS AKTOR ATHENS":"PAN",
"PARIS BASKETBALL":"PARI","FC BARCELONA":"BAR","ANADOLU EFES ISTANBUL":"EFE",
"KOSNER BASKONIA VITORIA-GASTEIZ":"BAS","OLYMPIACOS PIRAEUS":"OLY","LDLC ASVEL VILLEURBANNE":"ASV",
"MACCABI RAPYD TEL AVIV":"MAC","BESIKTAS ISTANBUL":"BJK","VALENCIA BASKET":"VAL",
"FENERBAHCE ISTANBUL":"FEN","VIRTUS BOLOGNA":"VIR","PARTIZAN MOZZART BET BELGRADE":"PAR",
"ARMANI OLIMPIA MILAN":"MIL"
}
MONTH={"enero":1,"febrero":2,"marzo":3,"abril":4,"mayo":5,"junio":6,"julio":7,"agosto":8,"septiembre":9,"octubre":10,"noviembre":11,"diciembre":12}

class P(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True); self.parts=[]
    def handle_data(self,d):
        if d.strip(): self.parts.append(d.strip())

req=Request(URL,headers={"User-Agent":"Mozilla/5.0"})
text=urlopen(req,timeout=30).read().decode("utf-8","ignore")
p=P(); p.feed(text)
s=" ".join(p.parts)
s=re.sub(r"\s+"," ",html.unescape(s))

games=[]
weekdays=r"(?:Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo)"
for m in re.finditer(r"Jornada\s+(\d+)(.*?)(?=Jornada\s+\d+|$)",s,re.I):
    rnd=int(m.group(1)); block=m.group(2)
    if not 1<=rnd<=38: continue
    parts=re.split(r"(?="+weekdays+r"\s+\d{1,2} de [a-záéíóú]+ de (?:2026|2027),\s*\d{1,2}:\d{2} h:)",block,re.I)
    for part in parts:
        dm=re.search(weekdays+r"\s+(\d{1,2}) de ([a-záéíóú]+) de (2026|2027),\s*(\d{1,2}:\d{2}) h:\s*",part,re.I)
        if not dm: continue
        rest=part[dm.end():]
        found=[]
        for name,code in TEAM_MAP.items():
            pos=rest.find(name)
            if pos>=0: found.append((pos,name,code))
        found.sort()
        if len(found)<2: continue
        _,home,hc=found[0]; _,away,ac=found[1]
        dt=datetime(int(dm.group(3)),MONTH[dm.group(2).lower()],int(dm.group(1)))
        games.append({"round":rnd,"home":hc,"away":ac,"date":dt.strftime("%Y-%m-%d"),"time":dm.group(4)})

if len(games)!=380 or {r:sum(x["round"]==r for x in games) for r in range(1,39)}!={r:10 for r in range(1,39)}:
    counts={r:sum(x["round"]==r for x in games) for r in range(1,39)}
    raise SystemExit(f"Parsed {len(games)} games; counts={counts}")

json.dump(games,open("data/official-schedule.json","w",encoding="utf-8"),ensure_ascii=False,indent=2)
print("OK: 380 games, 38 rounds x 10")
