from html.parser import HTMLParser
from urllib.request import Request, urlopen
from datetime import datetime
import re,json

TEAMS={
"ZAL":"Zalgiris","RMA":"Real Madrid","BAR":"FC Barcelona","BAS":"Baskonia","VAL":"Valencia",
"FEN":"Fenerbahce","EFE":"Anadolu Efes","BJK":"Besiktas","OLY":"Olympiacos","PAN":"Panathinaikos",
"CZV":"Crvena Zvezda","PAR":"Partizan","MAC":"Maccabi","HAP":"Hapoel TLV","MIL":"Milan",
"VIR":"Virtus Bologna","PARI":"Paris","ASV":"LDLC ASVEL","BAY":"Bayern Munich","DUB":"Dubai"
}
SLUGS={"ZAL":"zalgiris","RMA":"real-madrid","BAR":"fc-barcelona","BAS":"baskonia","VAL":"valencia",
"FEN":"fenerbahce","EFE":"anadolu-efes","BJK":"besiktas","OLY":"olympiacos","PAN":"panathinaikos",
"CZV":"crvena-zvezda","PAR":"partizan","MAC":"maccabi","HAP":"hapoel-tlv","MIL":"milan",
"VIR":"virtus-bologna","PARI":"paris","ASV":"ldlc-asvel","BAY":"bayern-munich","DUB":"dubai"}
MONTH={"Jan":1,"Feb":2,"Mar":3,"Apr":4,"Sep":9,"Oct":10,"Nov":11,"Dec":12}

class P(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True); self.parts=[]
    def handle_data(self,d):
        if d.strip(): self.parts.append(d.strip())

def fetch(url):
    req=Request(url,headers={"User-Agent":"Mozilla/5.0"})
    raw=urlopen(req,timeout=30).read().decode("utf-8","ignore")
    p=P(); p.feed(raw)
    return " ".join(p.parts)

opp_map={
"Real Madrid":"RMA","FC Barcelona":"BAR","Baskonia":"BAS","Valencia":"VAL","Fenerbahce":"FEN",
"Anadolu Efes":"EFE","Besiktas":"BJK","Olympiacos":"OLY","Panathinaikos":"PAN","Crvena Zvezda":"CZV",
"Partizan":"PAR","Maccabi":"MAC","Hapoel TLV":"HAP","Milan":"MIL","Virtus Bologna":"VIR","Paris":"PARI",
"LDLC ASVEL":"ASV","Bayern Munich":"BAY","Dubai":"DUB","Zalgiris":"ZAL"
}
games={}
for code,slug in SLUGS.items():
    s=re.sub(r"\s+"," ",fetch("https://matchupgrid.com/euroleague/teams/"+slug+"/"))
    for m in re.finditer(r"(Sep|Oct|Nov|Dec|Jan|Feb|Mar|Apr)\s+(\d{1,2})\s+\|\s+(vs|at)\s+([^|]+?)\s+\|\s+(\d{1,2}:\d{2})\s+UTC",s):
        mon,day,side,opp,time=m.groups(); opp=opp.strip()
        if opp not in opp_map: continue
        year=2026 if MONTH[mon]>=9 else 2027
        dt=datetime(year,MONTH[mon],int(day))
        a,b=(code,opp_map[opp]) if side=="vs" else (opp_map[opp],code)
        key=(dt.strftime("%Y-%m-%d"),a,b)
        games[key]={"home":a,"away":b,"date":dt.strftime("%Y-%m-%d"),"time":time}

items=sorted(games.values(),key=lambda x:(x["date"],x["time"],x["home"],x["away"]))
if len(items)!=380: raise SystemExit(f"Expected 380 unique games, got {len(items)}")
for i in range(0,380,10):
    block=items[i:i+10]
    if len(block)!=10: raise SystemExit("Bad round size")
for i in range(20):
    code=list(TEAMS)[i]
    seen=sum(1 for g in items if g["home"]==code or g["away"]==code)
    if seen!=38: raise SystemExit(f"{code} has {seen} games")
json.dump(items,open("data/official-schedule.json","w",encoding="utf-8"),ensure_ascii=False,indent=2)
print("OK: 380 unique games; 20 teams x 38; 38 rounds x 10")
