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
for m in re.finditer(r"Jornada\s+(\d+)(.*?)(?=Jornada\s+\d+|$)",s,re.I):
    rnd=int(m.group(1)); block=m.group(2)
    if not 1<=rnd<=38: continue
    rx=re.compile(r"(\d{1,2}) de ([a-záéíóú]+) de (2026|2027),\s*(\d{1,2}:\d{2}) h:\s*(.*?)\s+[–-]\s+(.*?)(?=\s+(?:Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo)\s+\d{1,2} de [a-záéíóú]+ de (?:2026|2027),\s*\d{1,2}:\d{2} h:|\s*$)",re.I)
    for g in rx.finditer(block):
        day,mon,year,t,home,away=g.groups()
        home=home.strip(); away=away.strip()
        if home not in TEAM_MAP or away not in TEAM_MAP: continue
        dt=datetime(int(year),MONTH[mon.lower()],int(day))
        games.append({"round":rnd,"home":TEAM_MAP[home],"away":TEAM_MAP[away],"date":dt.strftime("%Y-%m-%d"),"time":t})

if len(games)!=380 or {r:sum(x["round"]==r for x in games) for r in range(1,39)}!={r:10 for r in range(1,39)}:
    counts={r:sum(x["round"]==r for x in games) for r in range(1,39)}
    raise SystemExit(f"Parsed {len(games)} games; counts={counts}")

json.dump(games,open("data/official-schedule.json","w",encoding="utf-8"),ensure_ascii=False,indent=2)
print("OK: 380 games, 38 rounds x 10")
