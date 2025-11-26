# Jämförelsesystem för Styrande Skolbild - Dokumentation

## Översikt

Detta system implementerar strukturerade jämförelseregler per indikatortyp enligt specifikation för en "styrande skolbild". Systemet hämtar data automatiskt från Kolada API v3 och visar jämförelser konsekvent för alla indikatorer.

## Jämförelseregler per Indikatortyp

### 1. Resultatindikatorer (Betyg, Måluppfyllelse)
**KPIer:** N15482, N15485, N15488, N15509, N15510, N15539, N15516, N15419, N15436, N15505, N15503, U15429-U15434

**Visas:**
- ✅ **Riket** + avvikelse i procentenheter
- ✅ **Liknande skolor/kommuner** (7 mest lika) + avvikelse i procentenheter
- ✅ **Trend** (3 år) med riktningsindikator (↗/→/↘)
- 📌 **Kommun-snitt** som sekundärt värde (klickbart/expanderbart - ej implementerat ännu)

**Exempel:**
```
92% | Riket 88% (+4.0 procentenheter) | Liknande 85% (+7.0 procentenheter) | ↗ +3.2 procentenheter (3 år)
```

### 2. Förutsättningar (Behörighet, Resurser, Elevtal)
**KPIer:** N11805, N15807, N15034, N15813, N15031

**Visas:**
- ✅ **Kommun** + avvikelse i procentenheter
- ✅ **Riket** + avvikelse i procentenheter  
- ✅ **Trend** (3 år)

**Exempel:**
```
13.5 st | Kommun 14.2 st (-0.7 procentenheter) | Riket 12.8 st (+0.7 procentenheter) | → stabilt (3 år)
```

### 3. Trygghet & Studiero
**KPIer:** N15613, N15603, N15614

**Visas:**
- ✅ **Riket** + avvikelse i procentenheter
- ✅ **Kommun** + avvikelse i procentenheter
- ✅ **Trend** (3 år)

**Exempel:**
```
82% | Riket 85% (-3.0 procentenheter) | Kommun 80% (+2.0 procentenheter) | ↘ -2.1 procentenheter (3 år)
```

### 4. SALSA / Värdeskapande (Förväntat vs Faktiskt)
**KPIer:** U15413, U15414, U15415, U15416

**Visas:**
- ✅ **Förväntat (SALSA)** - modellberäknat värde
- ✅ **Faktiskt** - verkligt resultat
- ✅ **Liknande kommuner** som kontext
- ✅ **Trend** (3 år)

**Exempel för U15414:**
```
Förväntat (SALSA) 88% | Faktiskt 85% | Liknande -2.3% (kontext) | ↘ -1.5 procentenheter (3 år)
```

## Teknisk Implementation

### Arkitektur

```
skolenhetsdashboard/
├── page.js                 # Huvudlogik, UI-rendering
├── comparisons.js         # Jämförelsesystemet (NYTT)
└── [HTML/CSS]             # UI-komponenter
```

### Nyckelfunktioner i comparisons.js

#### 1. `getComparisonRule(kpiId)`
Bestämmer vilken jämförelseregel som gäller för en KPI.

**Returnerar:** `'resultat'`, `'forutsattningar'`, `'trygghet'`, eller `'salsa'`

#### 2. `fetchComparisonData(kpiId, entityId, municipalityCode, entityType)`
Hämtar fullständiga jämförelsedata från Kolada API v3.

**Parametrar:**
- `kpiId` - KPI-ID (ex: 'N15482')
- `entityId` - Enhet-ID eller kommunkod
- `municipalityCode` - Kommunkod för gruppjämförelser
- `entityType` - `'ou'` (skolenhet) eller `'municipality'` (kommun)

**Returnerar:**
```javascript
{
  kpi_id: "N15482",
  years: [2021, 2022, 2023, 2024],
  values: {
    main: [82, 84, 85, 87],
    riket: [85, 86, 87, 88],
    liknande: [83],  // Endast senaste året
    kommun_secondary: [80, 82, 83, 85]  // För resultatindikatorer
  },
  deltas: {
    main_vs_riket: -1.0,
    main_vs_liknande: 4.0
  },
  trend: {
    direction: "up",
    change: 5.0
  },
  rule_bucket: "resultat",
  available: true
}
```

#### 3. `createKPIComparison(kpiId, name, unit, entityId, municipalityCode, entityType)`
Skapar komplett KPI-objekt med jämförelser för UI.

#### 4. `formatComparisonText(comparisonData, unit)`
Formaterar jämförelsedata till användarvänlig text enligt regler.

#### 5. `fetchSimilarMunicipalities(municipalityCode)`
Hämtar lista över 7 mest lika kommuner från RKA-gruppering.

**OBS:** Använder för närvarande hårdkodad mapping. I produktion ska detta hämtas från Kolada metadata eller RKA API.

```javascript
const similarGroups = {
  '0684': ['0680', '0685', '0686', '0682', '0665', '0687', '0764'], // Sävsjö + liknande
  // Lägg till fler kommuner...
};
```

### Integration i page.js

#### Uppdaterad `hamtaKpiCardData()`
Hämtar nu både basdata och comparison data:

```javascript
async function hamtaKpiCardData(ouId, def, municipalityCode = '0684') {
  // ... hämta basdata med hamtaKoladaData ...
  
  // Hämta jämförelsedata
  const comparisonData = await createKPIComparison(
    def.id, 
    def.label, 
    def.unit, 
    ouId, 
    municipalityCode, 
    'ou'
  );
  
  return {
    label: def.label,
    value: trend.latest,
    unit: def.unit,
    comparisonData: comparisonData  // NYTT
  };
}
```

#### Uppdaterad `createKPICard()`
Visar jämförelser enligt regelverket:

```javascript
function createKPICard(kpi) {
  // ... skapa kort ...
  
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
      // Förväntat vs faktiskt + Liknande
    }
    
    comparisonDiv.textContent = formattedComparison;
  }
  
  card.append(label, value, comparisonDiv, analysis);
  return card;
}
```

## Kolada API v3 Endpoints

### Metadata - Sök KPI
```
GET https://api.kolada.se/v3/kpi?title=<sökterm>
GET https://api.kolada.se/v3/kpi/<kpi_id>
```

### Data - Kommun
```
GET https://api.kolada.se/v3/data/kpi/<kpi_id>/municipality/<kommun_kod>
```

### Data - Skolenhet (OU)
```
GET https://api.kolada.se/v3/oudata/kpi/<kpi_id>/ou/<ou_id>
```

### Data - Riket (nationellt)
```
GET https://api.kolada.se/v3/data/kpi/<kpi_id>/municipality/0000
```

**OBS:** Rikets kod är `0000` i Kolada.

### Liknande kommuner
Kolada exponerar metadata om kommungrupper:
```
GET https://api.kolada.se/v3/municipality_groups
```

RKA:s "Liknande kommuner" finns som en specifik grupp baserad på:
- Befolkningsstorlek
- Ekonomisk struktur  
- Demografi
- Geografiskt läge

**För grundskola:** Används den grupp som bygger på skolrelaterade faktorer.

## Språkregler i UI

### Ersätt tekniska termer
- ❌ `p.p.` → ✅ `procentenheter`
- ❌ `diff` → ✅ `avvikelse`
- ❌ `trend` → ✅ `utveckling` eller `förändring`

### Visa nivå + jämförelse + trend i samma rad
```
92% (Riket 88%, Liknande 85%) → stabilt
```

### Använd symboler för klarhet
- ↗ Förbättring
- → Stabilt
- ↘ Försämring
- ✅ Över snitt
- ● På snitt
- ✕ Under snitt

## CSS-styling

### Ny klass: `.kpi-comparison`
```css
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

## Cache-hantering

Systemet cachar API-anrop för prestanda:

```javascript
const CACHE = new Map();

// Nyckel: `${kpiId}_${entityId}_${entityType}_${years}`
// Värde: { years: [...], values: [...] }
```

**Rensa cache vid:**
- Byte av kommun
- Byte av skolenhet
- Manuell uppdatering

```javascript
clearCache();  // Exporterad från comparisons.js
```

## Framtida förbättringar

### 1. Dynamisk hämtning av liknande kommuner
**Nuvarande:** Hårdkodad mapping
**Mål:** Hämta från Kolada metadata API

```javascript
async function fetchSimilarMunicipalities(municipalityCode) {
  const response = await fetch('https://api.kolada.se/v3/municipality_groups');
  const groups = await response.json();
  
  // Hitta RKA-grupp för grundskola
  const rkaGroup = groups.values.find(g => 
    g.id.includes('RKA') && g.title.includes('Grundskola')
  );
  
  // Returnera kommuner i samma grupp
  return rkaGroup.members.filter(m => m.id !== municipalityCode).slice(0, 7);
}
```

### 2. Stadium-detektion (F-6, 7-9, F-9)
Använd skolenhetens metadata för att välja rätt jämförelsegrupp:

```javascript
async function detectSchoolStadium(ouId) {
  const response = await fetch(`https://api.kolada.se/v3/ou/${ouId}`);
  const data = await response.json();
  
  // Analysera metadata för att avgöra stadium
  const title = data.title.toLowerCase();
  if (title.includes('f-6') || title.includes('förskoleklass')) return 'f6';
  if (title.includes('7-9') || title.includes('högstadiet')) return '79';
  if (title.includes('f-9')) return 'f9';
  
  return 'f9'; // Fallback
}
```

### 3. Expanderbar kommun-snittvisning
För resultatindikatorer: Lägg till klickbar/expanderbar sektion för kommun-snitt.

```html
<div class="kpi-comparison">
  <div class="comparison-primary">
    Riket 88% | Liknande 85%
  </div>
  <details class="comparison-secondary">
    <summary>Visa kommun-snitt</summary>
    <div>Kommun 83% (-4.0 procentenheter)</div>
  </details>
</div>
```

### 4. Historiska trendgrafer
Visa 3-årstrend som linjediagram inline i kortet:

```javascript
// Använd Chart.js eller D3.js för små sparkline-grafer
function createTrendSparkline(years, values) {
  // Mini-graf visar visuell trend
}
```

### 5. Export till PDF
Implementera PDF-export av hela dashboarden för rektorer:

```javascript
import jsPDF from 'jspdf';

function exportToPDF() {
  const doc = new jsPDF();
  // Lägg till alla KPI-kort med jämförelser
  doc.save('skolbild.pdf');
}
```

## Felsökning

### Problem: Comparison data visas inte
**Orsak:** API-anrop kan misslyckas eller returnera tom data.
**Lösning:** Kontrollera nätverksflik i DevTools. Verifiera att KPI finns i Kolada för aktuell enhet.

### Problem: Fel kommunkod för liknande kommuner
**Orsak:** Hårdkodad mapping saknar aktuell kommun.
**Lösning:** Lägg till kommun i `fetchSimilarMunicipalities()` eller implementera dynamisk hämtning.

### Problem: CORS-fel vid API-anrop
**Orsak:** Kolada API v3 kräver korrekt CORS-konfiguration.
**Lösning:** Kolada stödjer CORS, men kontrollera att `mode: 'cors'` och `headers: { Accept: 'application/json' }` är satta.

### Problem: För många API-anrop
**Orsak:** Varje KPI hämtar flera datapunkter (riket, liknande, trend).
**Lösning:** Cache implementerad. För produktionsmiljö: överväg backend-proxy som cachar i Redis.

## Testning

### Manuell testning
1. Välj kommun: Sävsjö (0684)
2. Välj skolenhet: Vilken som helst med data
3. Verifiera att varje KPI visar:
   - Huvudvärde
   - Jämförelser enligt regel (Riket/Kommun/Liknande)
   - Trend med riktning (↗/→/↘)
   - Enheter som "procentenheter" (ej "p.p.")

### Enhetstester (framtida)
```javascript
import { getComparisonRule, formatComparisonText } from './comparisons.js';

describe('Comparison System', () => {
  test('getComparisonRule identifies resultat KPI', () => {
    expect(getComparisonRule('N15482')).toBe('resultat');
  });
  
  test('formatComparisonText formats correctly', () => {
    const data = {
      available: true,
      values: { main: [85], riket: [88], liknande: [83] },
      deltas: { main_vs_riket: -3, main_vs_liknande: 2 },
      trend: { direction: 'up', change: 2.5 },
      rule_bucket: 'resultat'
    };
    
    const text = formatComparisonText(data, '%');
    expect(text).toContain('Riket 88%');
    expect(text).toContain('Liknande 83%');
    expect(text).toContain('procentenheter');
  });
});
```

## Kontakt & Support

**Utvecklare:** GitHub Copilot  
**Version:** 1.0.0  
**Datum:** 2025-11-26  
**Licens:** Intern användning

För frågor om systemet, kontakta projektansvarig eller se Kolada API-dokumentation på https://api.kolada.se/v3
