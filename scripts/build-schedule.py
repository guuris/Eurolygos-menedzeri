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
        super().__init__(convert_charrefs=True); self.rows=[]; self.row=[]; self.cell=[]; self.in_cell=False
    def handle_starttag(self,tag,attrs):
        if tag=="tr": self.row=[]
        if tag in ("td","th"): self.cell=[]; self.in_cell=True
    def handle_endtag(self,tag):
        if tag in ("td","th") and self.in_cell:
            self.row.append(" ".join(self.cell).strip()); self.in_cell=False
        if tag=="tr" and self.row: self.rows.append(self.row)
    def handle_data(self,d):
        if self.in_cell and d.strip(): self.cell.append(d.strip())

def fetch_rows(url):
    req=Request(url,headers={"User-Agent":"Mozilla/5.0"})
    raw=urlopen(req,timeout=30).read().decode("utf-8","ignore")
    p=P(); p.feed(raw)
    return p.rows

opp_map={
"Real Madrid":"RMA","FC Barcelona":"BAR","Baskonia":"BAS","Valencia":"VAL","Fenerbahce":"FEN",
"Anadolu Efes":"EFE","Besiktas":"BJK","Olympiacos":"OLY","Panathinaikos":"PAN","Crvena Zvezda":"CZV",
"Partizan":"PAR","Maccabi":"MAC","Hapoel TLV":"HAP","Milan":"MIL","Virtus Bologna":"VIR","Paris":"PARI",
"LDLC ASVEL":"ASV","Bayern Munich":"BAY","Dubai":"DUB","Zalgiris":"ZAL"
}
games={}
for code,slug in SLUGS.items():
    rows=fetch_rows("https://matchupgrid.com/euroleague/teams/"+slug+"/")
    for row in rows:
        if len(row)!=3: continue
        date,opp_time,time=row
        dm=re.match(r"(Sep|Oct|Nov|Dec|Jan|Feb|Mar|Apr)\s+(\d{1,2})",date)
        om=re.match(r"(vs|at)\s+(.+)",opp_time)
        if not dm or not om: continue
        mon,day=dm.groups(); side,opp=om.groups(); opp=opp.strip()
        if opp not in opp_map: continue
        year=2026 if MONTH[mon]>=9 else 2027
        dt=datetime(year,MONTH[mon],int(day))
        a,b=(code,opp_map[opp]) if side=="vs" else (opp_map[opp],code)
        key=(dt.strftime("%Y-%m-%d"),a,b)
        games[key]={"home":a,"away":b,"date":dt.strftime("%Y-%m-%d"),"time":time.replace(" UTC","")}

