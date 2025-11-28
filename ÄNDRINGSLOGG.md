# Ändringslogg - Jämförelsesystem Implementation

## Datum: 2025-11-26

---

## Nya filer skapade

### 1. `scripts/skolenhetsdashboard/comparisons.js` (500 rader)
**Syfte:** Komplett jämförelsemotor med Kolada API v3 integration

**Nyckelfunktioner:**
- `getComparisonRule(kpiId)` - Identifierar vilken jämförelseregel som gäller
- `fetchKoladaData(kpiId, entityId, entityType, years)` - Hämtar data från API
- `fetchSimilarMunicipalities(municipalityCode)` - Hämtar liknande kommuner
- `calculateGroupAverage(kpiId, municipalityCodes, year)` - Beräknar gruppsnitt
- `calculateTrend(values)` - Beräknar trendriktning
- `fetchComparisonData(...)` - Huvudfunktion för jämförelsedata
- `formatComparisonText(comparisonData, unit)` - Formaterar för UI
- `createKPIComparison(...)` - Skapar komplett KPI-objekt
- `clearCache()` - Rensar API-cache

**Cache-strategi:** Map-baserad cache för alla API-anrop

---

### 2. `JÄMFÖRELSESYSTEM_DOKUMENTATION.md` (350 rader)
**Syfte:** Omfattande teknisk dokumentation

**Innehåll:**
- Detaljerade jämförelseregler per indikatortyp
- Teknisk arkitektur och implementation
- API-endpoints och användning
- CSS-styling guide
- Framtida förbättringar
- Felsökningsguide
- Testexempel

---

### 3. `IMPLEMENTERING_SAMMANFATTNING.md` (200 rader)
**Syfte:** Övergripande sammanfattning av implementationen

**Innehåll:**
- Vad som har gjorts
- Nyckelfunktioner
- Exempel-output
- Kända begränsningar
- Testningsinstruktioner
- Användningsexempel

---

### 4. `SNABBGUIDE.md` (150 rader)
**Syfte:** Snabb referens för användare och utvecklare

**Innehåll:**
- Visuell guide för varje indikatortyp
- Språkregler och symboler
- KPI-mappning till regler
- Checklista för testning
- Felsökningsstips

---

## Uppdaterade filer

### 1. `scripts/skolenhetsdashboard/page.js`

#### Ändring 1: Import av comparison-modul (rad ~3)
```javascript
// FÖRE:
import { ALLA_KOMMUNER } from '../kommuner.js';
import { SKOLENHET_SEARCH_API, SKOLENHET_DATA_BASE } from '../constants.js';
import { hamtaKoladaData } from '../chartHelpers.js';

// EFTER:
import { ALLA_KOMMUNER } from '../kommuner.js';
import { SKOLENHET_SEARCH_API, SKOLENHET_DATA_BASE } from '../constants.js';
import { hamtaKoladaData } from '../chartHelpers.js';
import { createKPIComparison, formatComparisonText, getComparisonRule, clearCache } from './comparisons.js';
```

**Syfte:** Tillgängliggör jämförelsefunktioner

---

#### Ändring 2: Ersätt "p.p." med "procentenheter" i SALSA_KPIS (rad ~35)
```javascript
// FÖRE:
const SALSA_KPIS = [
  { id: 'U15413', label: 'Åk 9: SALSA modellberäknad andel alla ämnen', unit: '%' },
  { id: 'U15414', label: 'Åk 9: Avvikelse SALSA (%)', unit: 'p.p.' },
  // ...
];

// EFTER:
const SALSA_KPIS = [
  { id: 'U15413', label: 'Åk 9: SALSA modellberäknad andel alla ämnen', unit: '%' },
  { id: 'U15414', label: 'Åk 9: Avvikelse SALSA (%)', unit: 'procentenheter' },
  // ...
];
```

**Syfte:** Använd klarspråk istället för teknisk förkortning

---

#### Ändring 3: Uppdatera createKPICard() (rad ~52)
```javascript
// FÖRE (förenklat):
function createKPICard(kpi) {
  const card = document.createElement('div');
  // ... skapa label och value ...
  
  const trend = document.createElement('div');
  trend.className = `kpi-trend trend-${kpi.trendDirection}`;
  trend.textContent = kpi.trendText;
  
  card.append(label, value, trend, analysis);
  return card;
}

// EFTER (förenklat - se fil för fullständig kod):
function createKPICard(kpi) {
  const card = document.createElement('div');
  // ... skapa label och value ...
  
  const comparisonDiv = document.createElement('div');
  comparisonDiv.className = 'kpi-comparison';
  
  if (kpi.comparisonData && kpi.comparisonData.available) {
    const comp = kpi.comparisonData;
    const rule = comp.rule_bucket;
    
    // Formatera jämförelser baserat på regel
    if (rule === 'resultat') {
      // Riket + Liknande + Trend
    } else if (rule === 'forutsattningar') {
      // Kommun + Riket + Trend
    } else if (rule === 'trygghet') {
      // Riket + Kommun + Trend
    } else if (rule === 'salsa') {
      // Förväntat vs faktiskt
    }
    
    comparisonDiv.textContent = formattedComparison;
  }
  
  card.append(label, value, comparisonDiv, analysis);
  return card;
}
```

**Syfte:** Visa strukturerade jämförelser enligt regelverket

**Omfattning:** ~90 nya rader kod

---

#### Ändring 4: Ersätt "p.p." i genereraInsikter() (rad ~289-299)
```javascript
// FÖRE:
if (bestKPI.diff > 2) {
  styrka = `<strong>${bestKPI.label}</strong> ligger ${bestKPI.diff.toFixed(1)} p.p. över gruppsnitt.`;
}
// ...
if (worstKPI.diff < -2) {
  risk = `<strong>${worstKPI.label}</strong> ligger ${Math.abs(worstKPI.diff).toFixed(1)} p.p. under gruppsnitt.`;
}

// EFTER:
if (bestKPI.diff > 2) {
  styrka = `<strong>${bestKPI.label}</strong> ligger ${bestKPI.diff.toFixed(1)} procentenheter över gruppsnitt.`;
}
// ...
if (worstKPI.diff < -2) {
  risk = `<strong>${worstKPI.label}</strong> ligger ${Math.abs(worstKPI.diff).toFixed(1)} procentenheter under gruppsnitt.`;
}
```

**Syfte:** Konsekvent språk i insikter

**Antal ändringar:** 4 förekomster

---

#### Ändring 5: Ersätt "p.p." i beraknaTrendtext() (rad ~532)
```javascript
// FÖRE:
const unitSuffix = unit === '%' ? 'p.p.' : unit || '';

// EFTER:
const unitSuffix = unit === '%' ? 'procentenheter' : unit || '';
```

**Syfte:** Ersätt sista förekomsten av "p.p."

---

#### Ändring 6: Uppdatera hamtaKpiCardData() (rad ~636)
```javascript
// FÖRE:
async function hamtaKpiCardData(ouId, def) {
  const cacheKey = `${ouId}:${def.id}`;
  if (kpiCache.has(cacheKey)) return kpiCache.get(cacheKey);

  const fetchPromise = (async () => {
    try {
      const data = await hamtaKoladaData(ouId, def.id, SKOLENHET_DATA_BASE);
      // ... beräkna trend ...
      return { 
        label: def.label, 
        value: trend.latest, 
        // ...
        trendData: { dir: trend.dir, latest: trend.latest, diff1: trend.diff1, diff3: trend.diff3 } 
      };
    } catch (error) {
      // ...
    }
  })();
  
  kpiCache.set(cacheKey, fetchPromise);
  return fetchPromise;
}

// EFTER:
async function hamtaKpiCardData(ouId, def, municipalityCode = '0684') {
  const cacheKey = `${ouId}:${def.id}`;
  if (kpiCache.has(cacheKey)) return kpiCache.get(cacheKey);

  const fetchPromise = (async () => {
    try {
      const data = await hamtaKoladaData(ouId, def.id, SKOLENHET_DATA_BASE);
      // ... beräkna trend ...
      
      // NYTT: Hämta jämförelsedata
      let comparisonData = null;
      try {
        comparisonData = await createKPIComparison(
          def.id, 
          def.label, 
          def.unit, 
          ouId, 
          municipalityCode, 
          'ou'
        );
      } catch (error) {
        console.warn(`Could not fetch comparison data for ${def.id}:`, error);
      }
      
      return { 
        label: def.label, 
        value: trend.latest, 
        // ...
        trendData: { dir: trend.dir, latest: trend.latest, diff1: trend.diff1, diff3: trend.diff3 },
        comparisonData: comparisonData  // NYTT
      };
    } catch (error) {
      // ...
    }
  })();
  
  kpiCache.set(cacheKey, fetchPromise);
  return fetchPromise;
}
```

**Syfte:** Hämta jämförelsedata från comparison system

**Omfattning:** ~15 nya rader kod

---

#### Ändring 7: Uppdatera renderSection() (rad ~785)
```javascript
// FÖRE:
async function renderSection(sectionId, defs, ouId, kpiData) {
  // ...
  const cardPromises = defs.map(async (def) => {
    const card = await hamtaKpiCardData(ouId, def);
    // ...
  });
  // ...
}

// EFTER:
async function renderSection(sectionId, defs, ouId, kpiData, municipalityCode = '0684') {
  // ...
  const cardPromises = defs.map(async (def) => {
    const card = await hamtaKpiCardData(ouId, def, municipalityCode);
    // ...
  });
  // ...
}
```

**Syfte:** Skicka vidare municipalityCode för jämförelser

---

#### Ändring 8: Uppdatera renderSections() (rad ~832)
```javascript
// FÖRE:
async function renderSections(ouId) {
  const kpiData = {};
  
  // Mockad gruppgenomsnitt
  const groupAvgs = { /* ... */ };
  
  // Hämta alla KPI-data först
  await Promise.all([
    renderSection('baselineKPIs', BASELINE_KPIS, ouId, kpiData),
    renderSection('salsaKPIs', SALSA_KPIS, ouId, kpiData),
    // ...
  ]);
  // ...
}

// EFTER:
async function renderSections(ouId, municipalityCode = null) {
  const kpiData = {};
  
  // Hämta kommunkod från dropdown om inte angiven
  if (!municipalityCode) {
    const kommunSelect = document.getElementById('kommunSelect');
    municipalityCode = kommunSelect?.value || '0684';
  }
  
  // Mockad gruppgenomsnitt
  const groupAvgs = { /* ... */ };
  
  // Rensa comparison cache när kommun/enhet ändras
  clearCache();
  
  // Hämta alla KPI-data först
  await Promise.all([
    renderSection('baselineKPIs', BASELINE_KPIS, ouId, kpiData, municipalityCode),
    renderSection('salsaKPIs', SALSA_KPIS, ouId, kpiData, municipalityCode),
    // ...
  ]);
  // ...
}
```

**Syfte:** Hämta och skicka med municipalityCode, rensa cache vid byte

**Omfattning:** ~10 nya rader kod

---

### 2. `skolenhetsdashboard.html`

#### Ändring 1: CSS för kpi-comparison (rad ~480)
```css
/* FÖRE: Ingen kpi-comparison klass */

/* EFTER: */
.kpi-comparison {
  font-size: 0.9rem;
  color: #475569;
  line-height: 1.6;
  padding: 0.75rem;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 6px;
  margin-bottom: 0.75rem;
  border-left: 3px solid #667eea;
}

.kpi-comparison::before {
  content: '📊 ';
  margin-right: 0.5rem;
}
```

**Syfte:** Stilsätt jämförelsevisning med gradient-bakgrund och border

**Omfattning:** 13 rader CSS

---

## Sammanfattning av ändringar

### Nya filer: 4 st
1. `comparisons.js` - Jämförelsemotor (500 rader)
2. `JÄMFÖRELSESYSTEM_DOKUMENTATION.md` - Teknisk dokumentation (350 rader)
3. `IMPLEMENTERING_SAMMANFATTNING.md` - Implementationsöversikt (200 rader)
4. `SNABBGUIDE.md` - Användarguide (150 rader)

**Totalt nya rader kod/dokumentation:** ~1200 rader

### Uppdaterade filer: 2 st
1. `page.js` - 8 ändringar, ~120 nya rader kod
2. `skolenhetsdashboard.html` - 1 ändring, 13 rader CSS

**Totalt nya rader i befintliga filer:** ~133 rader

### Språkförbättringar: 6 st
Alla förekomster av "p.p." ersatta med "procentenheter":
1. SALSA_KPIS definition (rad ~35)
2. genereraInsikter - Styrka text (rad ~289)
3. genereraInsikter - Styrka trend (rad ~291)
4. genereraInsikter - Risk text (rad ~297)
5. genereraInsikter - Risk trend (rad ~299)
6. beraknaTrendtext - unitSuffix (rad ~532)

---

## Teststatus

### ✅ Syntax-kontroll
- Inga syntaxfel i `comparisons.js`
- Inga syntaxfel i `page.js`
- CSS validerad i `skolenhetsdashboard.html`

### ⏳ Funktionstest (kräver körning i browser)
- Import av modul
- API-anrop till Kolada v3
- Jämförelsevisning i UI
- Cache-funktionalitet
- Språkförbättringar synliga

---

## Nästa steg

1. **Testning i browser:**
   - Öppna `skolenhetsdashboard.html`
   - Välj kommun och skolenhet
   - Verifiera jämförelser

2. **Dynamisk liknande kommuner:**
   - Implementera hämtning från Kolada metadata
   - Ersätt hårdkodad mapping

3. **Stadium-detektion:**
   - Identifiera F-6, 7-9, eller F-9
   - Välj rätt jämförelsegrupp

4. **Backend-proxy (produktion):**
   - Redis-cache för API-svar
   - Reducera belastning på Kolada

---

**Omfattning:** Stor implementation med ny modul och omfattande dokumentation  
**Komplexitet:** Medel-hög (API-integration, dynamisk regelhantering, cache)  
**Teststatus:** Syntax OK, funktionstest återstår  
**Dokumentation:** Omfattande (3 guider + kodkommentarer)
