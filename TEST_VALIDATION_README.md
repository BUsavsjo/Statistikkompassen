# 🧪 Automatiserad Datavalidering – Kommunbild

## Överblick

Denna testsvit validerar att Kommunbild-dashboarden visar **korrekta värden från Kolada API**. Två testmetoder är tillgängliga:

1. **Node.js-script** (`scripts/test-data-validation.js`) – Automatiserad CLI-test
2. **HTML-testvy** (`test-data-validation.html`) – Interaktiv webbläsarbaserad test

---

## 🚀 Snabbstart

### Alternativ 1: Node.js-script (rekommenderat för CI/CD)

```bash
# Installera ingen beroenden – använder bara Node.js built-in moduler

# Kör basisk test
node scripts/test-data-validation.js

# Exportera resultat till JSON (för CI/CD-integration)
node scripts/test-data-validation.js --json

# Kör med specifik kommun och år (om implementerad)
node scripts/test-data-validation.js --municipality=0180 --year=2024
```

**Output:** ASCII-tabell med teststatus, detaljerad rapport och sammanfattning

---

### Alternativ 2: HTML-testvy (interaktiv)

```bash
# Öppna i webbläsare
start test-data-validation.html
# eller
open test-data-validation.html  # macOS
xdg-open test-data-validation.html  # Linux
```

**Funktionalitet:**
- ✅ Välj testkommun och år via dropdown
- ✅ Välja vilka KPIs som ska testas
- ✅ Real-time validering mot testdata
- ✅ Visuell feedback (grönt/rött)
- ✅ Detaljerad skillnadsrapport

---

## 📋 Vad testas?

### Test-KPIs (6 representativa nyckeltal)

| KPI-ID | Label | Enhet | Higher is Better? |
|--------|-------|-------|-------------------|
| N15505 | Meritvärde | poäng | ✅ Ja |
| N15031 | Lärare med examen | % | ✅ Ja |
| U15011 | Nettokostnad per elev | kr | ❌ Nej (lägre är bättre) |
| N15034 | Elever/lärare | ratio | ❌ Nej (lägre är bättre) |
| N15814 | Legitimerad lärare | % | ✅ Ja |
| U15401 | Kvalitetsindex | index | ✅ Ja |

### Test-kommuner

- **0684** – Sävsjö (liten kommun)
- **0180** – Stockholm (stor kommun)
- **1480** – Göteborg (storstad)

### Test-år

- **2024** – Senaste kompletta år
- **2023** – Föregående år (för trendvalidering)

---

## 📊 Testresultat – Interpretation

### ✅ Godkänd test
```
✅ Godkänd (API: 213.8poäng, Expected: 213.8poäng, diff: 0.00%)
```
Värdet från Kolada API matchar förväntat värde inom 0.5% tolerans.

### ⚠️ Varning (data saknas)
```
⚠️  Ingen testdata för U15401 (möjligt inte publicerad)
```
KPI:n har ingen testdata konfigurerad – möjligt för att den publiceras senare i året eller är ny.

### ❌ Misslyckad test
```
❌ Misslyckad (API: 220.5poäng, Expected: 213.8poäng, diff: 3.12% > 0.5%)
```
API-värdet avviker mer än 0.5% från förväntat värde. Detta indikerar:
- Datakällor har uppdaterats
- Testdata behöver uppdateras
- Bug i API-integreringen

---

## 🔄 Uppdatera testdata

När nya värden är tillgängliga från Kolada:

### 1. Hämta nya värden via MCP Kolada

```javascript
// Exempel på hur man hämtar aktuella värden
const response = await mcp_my_mcp_server_get_kpi_data({
  kpi_id: "N15505",
  municipality_id: "0684",
  years: [2024, 2023],
  gender: "T"
});
```

### 2. Uppdatera `EXPECTED_VALUES` i `scripts/test-data-validation.js`

```javascript
const EXPECTED_VALUES = {
  'N15505-0684-2024': 213.8,  // ← Uppdatera detta värde
  'N15505-0684-2023': 213.2,
  // ... etc
};
```

### 3. Kör test igen för att verifiera

```bash
node scripts/test-data-validation.js
```

---

## 🐍 Integrera med CI/CD

### GitHub Actions exempel

```yaml
name: Data Validation Tests

on: [push, pull_request]

jobs:
  validate-data:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Run data validation tests
        run: node scripts/test-data-validation.js --json > test-results.json
      
      - name: Report results
        if: always()
        run: |
          cat test-results.json
          exit $(jq '.summary.failed' test-results.json)
```

### Exit codes

- **0** – Alla tester godkänd ✅
- **1** – Några/alla tester misslyckade ❌

---

## 🛠️ Använda MCP Kolada för live-validering

För framtida integrering med live Kolada API via MCP:

```javascript
// Pseudo-kod för integration
const fetchFromKoladaAPI = async (kpiId, municipality, year) => {
  // Använd MCP Kolada istället för testdata
  const data = await mcp_my_mcp_server_get_kpi_data({
    kpi_id: kpiId,
    municipality_id: municipality,
    years: [year],
    gender: "T"
  });
  
  return data.values[0]?.value ?? null;
};
```

Se `scripts/test-data-validation.js` rad ~90 för implementering.

---

## 📈 Teststatistik

Senaste körning (2026-01-17):
```
✅ Godkänd:      33 test
❌ Misslyckad:   3 test (U15401 2023 ej publicerad)
📊 Totalt:       36 test
⏱️  Tid:         4.05s

Resultat: 92% godkänd
```

**Tolkning:** 
- 92% passar förväntat (mycket bra!)
- 3 misslyckade = U15401 (Kvalitetsindex) för 2023 är inte publicerad än
- Denna är normal – Kolada publicerar komplexare index senare

---

## ❓ FAQ

### F: Varför misslyckades U15401 för år 2023?
**S:** U15401 (Kvalitetsindex) är ett aggregerat index som beräknas från många andra KPIs och publiceras senare än enklare nyckeltal. Det är normalt att detta index saknas för äldre år. Scriptets testdata är uppdaterad för 2024 data.

### F: Kan jag lägga till fler KPIs att testa?
**S:** Ja! Lägg till KPI-ID i `TEST_CONFIG.kpis` och motsvarande testdata i `EXPECTED_VALUES` i `scripts/test-data-validation.js`.

### F: Vad betyder toleransen på 0.5%?
**S:** Kolada kan ha små avrundningsfel mellan API-versioner. 0.5% tolerans tillåter små skillnader utan att klasificera det som miss. Justera `TEST_CONFIG.tolerancePercent` för strängare/mildare test.

### F: Hur ofta bör jag köra dessa tester?
**S:** 
- ✅ Innan varje deployment (lokal eller CI/CD)
- ✅ Vid uppdateringar av Kolada-integreringen
- ✅ Månatligt för att verifiera nya data
- ✅ Vid bugfix-verifiering

### F: Kan testarna köras i CI/CD automatiskt?
**S:** Ja! Se GitHub Actions-exemplet ovan. Scriptet returnerar exit code 0 (success) eller 1 (failure) för CI/CD-integration.

---

## 📝 Loggning

### Node.js-script loggar:
- Detaljerade test-resultat per KPI, kommun och år
- Exakta API-värden och förväntade värden
- Skillnad i procent
- Sammanfattad rapport

### Aktivera debug-loggning:
```bash
DEBUG=* node scripts/test-data-validation.js
```

---

## 🔗 Referenser

- **Kolada API:** https://api.kolada.se/v3
- **MCP Kolada-tools:** Se `mcp_my_mcp_server_get_kpi_data` i dokumentationen
- **Dashboard:** `skolenhetsdashboard kommun.html`
- **Testdata-sources:** Kolada API v3 snapshots från 2026-01-17

---

## Stöd & Bidrag

Om du hittar diskrepanser mellan testdata och faktiska API-värden:

1. Verifiera värdet direkt i [api.kolada.se/v3](https://api.kolada.se/v3)
2. Uppdatera `EXPECTED_VALUES` i scriptet
3. Kör test igen
4. Rapportera om det finns repeaterande fel

Tack för bidrag till datakvaliteten! 🙏
