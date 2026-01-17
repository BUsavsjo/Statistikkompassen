# 📊 Statistikkompassen

En interaktiv webbplattform för analys och visualisering av statistik för Sävsjö kommun.

## 🎯 Om Statistikkompassen

Statistikkompassen är en modern, användarvänlig plattform som samlar och presenterar statistik om utbildning och elevprestationer för Sävsjö kommun. Plattformen möjliggör enkla jämförelser med riket och liknande kommuner för att identifiera trender och utvecklingsområden.

## 📈 Funktioner

### 🔗 Huvudmoduler

1. **Korrelation**
   - Analysera sambanden mellan olika variabler
   - Utforska hur faktorer påverkar varandra

2. **Frånvaro**
   - Granska frånvaro mönster över tid
   - Identifiera trender och utveckling

3. **Betyg**
   - Undersök betygsfördelning
   - Analysera prestationsstatistik för elever

4. **Betyg Kolada** ⭐
   - Elever i åk 9 som uppnått betygskriterierna i alla ämnen
   - Jämför Sävsjö kommun med:
     - 🇸🇪 Riksgenomsnittet
     - 📍 Liknande kommuner (Värnamo, Växjö, Alvesta)
   - År-för-år analys med trendvisning
   - Sortering efter kön (kvinnor/män)

### 🎨 Design & Teknik

- **Frontend**: HTML5, CSS3, JavaScript (ES6 modules)
- **Visualisering**: Chart.js för interaktiva grafer
- **Data**: Kolada API v3 för officiell statistik
- **Design**: Moderna, responsiva boxar med gradient bakgrund
- **Färgschema**: Blå, vit och gul
- **Deployment**: GitHub Actions → GitHub Pages (automatisk vid push till main)

## 🚀 Nya Funktioner: Outcome-Based Labels & Data Validation

### ✅ Outcome-Based Comparison Labels
**Vad är det?** Smarta jämförelseetiketter som automatiskt justerar sitt ord baserat på om högre eller lägre värden är bättre.

**Exempel:**
- För **kostnadsmetrikerna** (lägre är bättre): "Sämre än riket" visas i röd färg när kostnaden är HÖGRE
- För **kvalitetsmetrikerna** (högre är bättre): "Bättre än riket" visas i grön färg när värdet är HÖGRE

**Implementering:** Använder `higherIsBetter` flaggan i KPI-definitioner + `comparisonLabel()` funktionen i page.js

### ✅ Automatiserad Test Suite
**Vad är det?** Två testverktyg för att validera att dashboard-värdena stämmer överens med Kolada API.

**Node.js CLI Test** (`scripts/test-data-validation.js`):
- Kör 36 test-cases automatiskt (6 KPIs × 3 kommuner × 2 år)
- Validerar mot förväntade värden med 0.5% tolerans
- Genererar detaljerad rapport med pass/fail status
- Exit codes för CI/CD integration

**Exempel körning:**
```bash
node scripts/test-data-validation.js
```

**Interaktiv HTML Test View** (`test-data-validation.html`):
- Browser-baserat test-gränssnitt med visuella indikatorer
- Realtidsvalidation med grön/röd feedback
- Välj kommun, år och KPI-set fritt
- Responsive design för alla skärmstorlekar

**Öppna i webbläsare:**
```bash
open test-data-validation.html
# eller direkt: double-click filen
```

### ✅ Test Documentation
Se [TEST_VALIDATION_README.md](TEST_VALIDATION_README.md) för:
- Detaljerad guide för att köra och tolka tester
- Information om test-data och uppdateringsschema
- GitHub Actions CI/CD exempel
- FAQ med vanliga fel och lösningar
- Framtida roadmap för MCP Kolada live-validation

Se även [TEST_ARCHITECTURE.md](TEST_ARCHITECTURE.md) för:
- Teknisk arkitektur för test-systemet
- API-integrationspunkter
- Datahantering och uppdateringsprocesser
- Framtida förbättringar och fasplanering

## 🚀 Funktioner i Betyg Kolada

### Interaktiv Graf
- Visuell representation av data över tid
- Streckad linje för riksgenomsnittet
- Tydlig legend med färgkodning

### Filteralternativ
- ✅ **Visa alla** - Både könen och riket
- 👩 **Kvinnor** - Endast kvinnors prestation
- 👨 **Män** - Endast mäns prestation
- 📊 **Totalt** - Sammanställd statistik + riket

### Kommun-väljare
- Byt mellan Sävsjö och liknande kommuner
- Automatisk uppdatering av data och analys

### Analys-box
Två analysrutor under grafen som automatiskt visar:
- 📍 **Sävsjö kommun** - Årlig förändring med:
  - Trend-indikator (⬆️ upp, ⬇️ ner, ➡️ oförändrad)
  - Exakt procentenheters förändring
  - Årtalen för jämförelse

- 🇸🇪 **Riket** - Motsvarande analys för riksgenomsnittet

## 📱 Responsiv Design

Plattformen är helt responsiv och fungerar perfekt på:
- 💻 Desktop
- 📱 Tablet
- 📲 Smartphone

## 🔗 Datasöl

**Kolada API**: `https://api.kolada.se/`

Datan hämtas från Sveriges officiella statistikdatabas för kommuner:
- Nyckeltal N15508: Behörighet till gymnasiet (Elever i åk 9 som uppnått betygskriterierna i alla ämnen)

## 📍 Liknande Kommuner

Jämförelsekommuner är valda baserat på geografisk närhet och storlek:
- **Värnamo kommun**
- **Växjö kommun**
- **Alvesta kommun**
y
## 🎯 Mål

Statistikkompassen syftar till att:
1. Göra statistik tillgänglig och lätt att förstå
2. Möjliggöra snabba jämförelser mellan kommuner
3. Identifiera trender i elevprestationer
4. Stödja datadrivna beslut inom utbildning
5. Skapa insikt om könsskillnader i prestationer

## 👨‍💻 Utveckling

Plattformen är under aktiv utveckling. Nya moduler och funktioner läggs till löpande.

### 🚀 Deployment

Statistikkompassen använder **GitHub Actions** för automatisk deployment till GitHub Pages:

1. **Automatisk deployment**: Varje push till `main`-branchen triggar automatisk uppdatering
2. **Live URL**: [https://busavsjo.github.io/Statistikkompassen/](https://busavsjo.github.io/Statistikkompassen/)
3. **Workflow**: Se [.github/workflows/deploy.yml](.github/workflows/deploy.yml)

#### Första gången (engångssetup):
1. Gå till repo → **Settings** → **Pages**
2. Under "Source" välj: **GitHub Actions**
3. Spara inställningarna

#### Därefter:
```bash
# Gör ändringar på din feature branch
git checkout -b min-feature
# ... gör ändringar ...
git commit -am "Beskrivning av ändring"
git push origin min-feature

# Merge till main (via PR eller direkt)
git checkout main
git merge min-feature
git push origin main

# GitHub Actions deployer automatiskt till Pages! 🎉
```

### Planerade Förbättringar
- [ ] Fler statistik-moduler
- [ ] Exportmöjligheter (PDF, CSV)
- [ ] Mer avancerad analys
- [ ] Historisk data-jämförelse
- [ ] Notifikationer vid trendförändring

## 📝 Licens

MIT License - se [LICENSE](LICENSE) för detaljer.

Statistikkompassen © 2026 Höglandsförbundet

---

**Senast uppdaterad**: Januari 17, 2026
