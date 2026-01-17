# Snabbguide - Jämförelsesystem för Styrande Skolbild

## 📊 Vad visas för varje typ av indikator?

### 🎓 Resultatindikatorer (Betyg & Måluppfyllelse)
**Exempel:** Åk 6 Engelska minst E, Åk 9 Alla ämnen godkända

**Visas:**
```
92% | Riket 88% (+4.0 procentenheter) | Liknande 85% (+7.0 procentenheter) | ↗ +3.2 procentenheter (3 år)
```

- ✅ Huvudvärde
- ✅ Jämförelse mot **Riket**
- ✅ Jämförelse mot **Liknande skolor/kommuner** (7 mest lika)
- ✅ **3-årstrend** med riktning

---

### 🏫 Förutsättningar (Resurser & Behörighet)
**Exempel:** Elever per lärare, Andel behöriga lärare

**Visas:**
```
13.5 st | Kommun 14.2 st (-0.7 procentenheter) | Riket 12.8 st (+0.7 procentenheter) | → stabilt (3 år)
```

- ✅ Huvudvärde
- ✅ Jämförelse mot **Kommun**
- ✅ Jämförelse mot **Riket**
- ✅ **3-årstrend**

---

### 🛡️ Trygghet & Studiero
**Exempel:** Åk 5 Trygghet, Åk 5 Studiero

**Visas:**
```
82% | Riket 85% (-3.0 procentenheter) | Kommun 80% (+2.0 procentenheter) | ↘ -2.1 procentenheter (3 år)
```

- ✅ Huvudvärde
- ✅ Jämförelse mot **Riket**
- ✅ Jämförelse mot **Kommun**
- ✅ **3-årstrend**

---

### 📈 SALSA / Värdeskapande (Förväntat vs Faktiskt)
**Exempel:** SALSA avvikelse, Meritvärde avvikelse

**Visas:**
```
Förväntat (SALSA) 88% | Faktiskt 85% | Liknande -2.3 procentenheter (kontext) | ↘ -1.5 procentenheter (3 år)
```

- ✅ **Förväntat värde** (SALSA-modell)
- ✅ **Faktiskt resultat**
- ✅ **Liknande kommuner** som kontext
- ✅ **3-årstrend**

---

## 🔤 Språkregler

### ✅ Använd alltid:
- **"procentenheter"** (INTE "p.p.")
- **"avvikelse"** (INTE "diff")
- **"utveckling"** eller **"förändring"** (INTE "trend" i löptext)

### 📊 Symboler för klarhet:
- **↗** Förbättring (stigande)
- **→** Stabilt (ingen större förändring)
- **↘** Försämring (fallande)
- **✅** Över snitt
- **●** På snitt
- **✕** Under snitt

---

## 🎯 Vilka KPIer har vilken regel?

### Resultatindikatorer (Riket + Liknande + Trend)
- N15482, N15485, N15488 - Åk 6 engelska, matematik, svenska minst E
- N15509, N15510 - Åk 6 betygspoäng
- N15539 - Åk 6 alla ämnen
- N15516 - Åk 6 svenska som andraspråk
- N15419 - Åk 9 alla ämnen godkända
- N15436 - Åk 9 behöriga till yrkesprogram
- N15505 - Åk 9 meritvärde
- N15503 - Åk 9 betygspoäng matematik
- U15429-U15434 - Åk 9 NP-jämförelser

### Förutsättningar (Kommun + Riket + Trend)
- N11805 - Antal elever förskoleklass
- N15807 - Antal elever åk 1-9
- N15034 - Elever per lärare
- N15813 - Andel behöriga lärare
- N15031 - Lärare med pedagogisk högskoleexamen

### Trygghet & Studiero (Riket + Kommun + Trend)
- N15613 - Åk 5 Trygghet
- N15603 - Åk 5 Studiero
- N15614 - Åk 5 Vuxnas agerande mot kränkningar

### SALSA (Förväntat vs Faktiskt + Liknande)
- U15413 - SALSA modellberäknad andel
- U15414 - Avvikelse SALSA (%)
- U15415 - SALSA modellberäknat meritvärde
- U15416 - Meritvärde avvikelse (SALSA)

---

## 🚀 Hur fungerar systemet?

### Automatisk process:
1. **Välj kommun** → Dropdown med alla 290 svenska kommuner
2. **Välj skolenhet** → Dropdown med skolenheter i vald kommun
3. **Systemet hämtar automatiskt:**
   - Data för vald skolenhet
   - Data för riket (kommunkod 0000)
   - Data för kommunen
   - Data för 7 liknande kommuner (beräknar gruppsnitt)
   - 3-5 års historik för trendberäkning
4. **Systemet visar:**
   - Alla KPIer med strukturerade jämförelser
   - Enligt regelverket per indikatortyp
   - Med tydliga symboler och klarspråk

### Datakällor:
- **Kolada API v3** (https://api.kolada.se/v3)
- **RKA-gruppering** för liknande kommuner (grundskola)
- **Cache** för snabbare laddning

---

## ⚙️ Teknisk info (för utvecklare)

### Nya filer:
- `scripts/skolenhetsdashboard/comparisons.js` - Jämförelsemotor
- `JÄMFÖRELSESYSTEM_DOKUMENTATION.md` - Fullständig dokumentation
- `IMPLEMENTERING_SAMMANFATTNING.md` - Implementeringsöversikt

### Uppdaterade filer:
- `scripts/skolenhetsdashboard/page.js` - Integration av jämförelser
- `skolenhetsdashboard.html` - CSS för jämförelsevisning

### API-endpoints:
```
Skolenhet: GET /v3/oudata/kpi/{kpiId}/ou/{ouId}
Kommun:    GET /v3/data/kpi/{kpiId}/municipality/{kommun}
Riket:     GET /v3/data/kpi/{kpiId}/municipality/0000
```

---

## 🐛 Felsökning

### Problem: Jämförelser visas inte
**Lösning:** Öppna Developer Tools (F12) → Console. Kontrollera om det finns API-fel.

### Problem: "p.p." visas fortfarande
**Lösning:** Ladda om sidan med Ctrl+Shift+R (hårdladdning för att rensa cache).

### Problem: Fel kommun i jämförelsen
**Lösning:** För närvarande hårdkodad för Sävsjö (0684) + liknande. Andra kommuner behöver läggas till i `fetchSimilarMunicipalities()`.

---

## 📝 Checklista för test

- [ ] Öppna `skolenhetsdashboard.html` i browser
- [ ] Välj kommun: Sävsjö (0684)
- [ ] Välj en skolenhet med data
- [ ] Kontrollera att alla KPIer visar jämförelser
- [ ] Verifiera att "procentenheter" används (ej "p.p.")
- [ ] Kontrollera att symboler visas (↗/→/↘)
- [ ] Testa med annan kommun (kan ge färre jämförelser)
- [ ] Kontrollera Developer Tools Console för fel

---

## 📞 Support

För frågor eller problem:
1. Se `JÄMFÖRELSESYSTEM_DOKUMENTATION.md` för detaljer
2. Kontrollera Developer Tools Console
3. Verifiera att Kolada API v3 är tillgänglig
4. Kontakta projektansvarig

---

**Version:** 1.0.0  
**Datum:** 2025-11-26  
**Status:** ✅ Implementerad och redo för testning
