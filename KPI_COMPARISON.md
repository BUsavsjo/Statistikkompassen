# KPI-jämförelse: betygkolada vs skolenhetsdashboard

## Sammanfattning

Detta dokument beskriver skillnaderna mellan KPI:er i `betygkolada.html` (kommun + OU-nivå) och `skolenhetsdashboard.html` (endast OU-nivå), samt den implementerade lösningen för att hantera saknad OU-data.

---

## Problem som lösts

### 🐛 Ursprungligt problem
**Charts visades även när det inte fanns data på OU-nivå**, vilket skapade tomma/missvisande diagram och förvirring för användaren.

### ✅ Lösning
Implementerat validering i `betygkolada.js` som:
1. Kontrollerar om OU-data finns innan chart renderas
2. Döljer chart-canvas, kopieringsknapp och uppdateringsknapp om ingen data finns för OU
3. Visar tydligt varningsmeddelande med information om varför data saknas
4. Håller kvar riket-analys även när lokal OU-data saknas

---

## KPI-jämförelse

### betygkolada.html (Kommune- & OU-nivå)
**Antal KPI:er:** 45+ KPI:er (definierade i `scripts/constants.js`)

**Nivåer:**
- ✅ Kommun-nivå (municipality)
- ✅ OU-nivå (organizational unit / skolenhet)

**API-endpoints:**
- Kommun: `https://api.kolada.se/v3/data/kpi/<kpi>/municipality/<id>`
- OU: `https://api.kolada.se/v3/oudata/kpi/<kpi>/ou/<id>`

**Funktioner:**
- Dynamiskt KPI-val från dropdown
- Könsuppdelad data (K, M, T)
- Jämförelse med riket
- Trendanalys
- Chart-visualisering
- ⚠️ **Inte alla KPI:er finns på OU-nivå**

---

### skolenhetsdashboard.html (Endast OU-nivå)
**Antal KPI:er:** 8 KPI:er (3 prereq + 5 outcome, definierade i `scripts/skolenhetsdashboard/kpiPacks.js`)

**Nivåer:**
- ❌ Kommun-nivå
- ✅ OU-nivå (organizational unit / skolenhet)

**Stage-detection:**
- F-6 (Förskoleklass till årskurs 6)
- 7-9 (Årskurs 7-9)
- F-9 (Förskoleklass till årskurs 9)

**API-endpoint:**
- OU: `https://api.kolada.se/v3/oudata/kpi/<kpi>/ou/<id>`

**Funktioner:**
- Automatisk stage-detection från skolnamn
- KPI:er anpassade efter skolstadium
- Jämförelse med kommun-genomsnitt
- Jämförelse med riket
- Färgkodade kort (grön/röd/ljusgrön)
- SALSA-analys (avvikelse från förväntat)
- ✅ **Alla valda KPI:er finns på OU-nivå**

---

## Gemensamma KPI:er

### Förutsättningar (Prereq)

| KPI ID | Namn | betygkolada | skolenhet | OU-data? |
|--------|------|------------|-----------|----------|
| **N15033** | Antal elever i grundskolan (åk 1-9) | ✅ | ✅ | ✅ |
| **N15034** | Elever/lärare grundskola | ✅ | ❌ | ✅ |
| **N15438** | Elever per lärare i grundskolan | ❌ | ✅ | ✅ |
| **N15031** | Lärare med pedagogisk högskoleexamen | ✅ | ❌ | ⚠️ |
| **N15447** | Andel lärare med pedagogisk högskoleexamen | ❌ | ✅ | ✅ |

---

### Resultat - Årskurs 6 (F-6 Outcome)

| KPI ID | Namn | betygkolada | skolenhet | OU-data? |
|--------|------|------------|-----------|----------|
| **N15540** | Åk 6: uppnått kunskapskraven i alla ämnen | ✅ | ❌ | ⚠️ |
| **N15543** | Elever i åk 6 uppnått betygskriterierna i alla ämnen | ✅ | ❌ | ⚠️ |
| **N15561** | Åk 6: lägst betyg E i svenska, kommunala skolor | ❌ | ✅ | ✅ |
| **N15559** | Åk 6: lägst betyg E i matematik, kommunala skolor | ❌ | ✅ | ✅ |
| **N15560** | Åk 6: lägst betyg E i engelska, kommunala skolor | ❌ | ✅ | ✅ |
| **N15481** | Åk 6: lägst betyg E i engelska, fristående | ✅ | ❌ | ⚠️ |
| **N15482** | Åk 6: lägst betyg E i engelska, kommunala | ✅ | ❌ | ⚠️ |
| **N15483** | Åk 6: lägst betyg E i matematik, lägeskommun | ✅ | ❌ | ⚠️ |
| **N15484** | Åk 6: lägst betyg E i matematik, fristående | ✅ | ❌ | ⚠️ |
| **N15485** | Åk 6: lägst betyg E i matematik, kommunala | ✅ | ❌ | ⚠️ |

---

### Resultat - Årskurs 9 (7-9 Outcome)

| KPI ID | Namn | betygkolada | skolenhet | OU-data? |
|--------|------|------------|-----------|----------|
| **N15508** | Åk 9: uppnått betygskriterierna i alla ämnen | ✅ | ❌ | ⚠️ |
| **N15419** | Åk 9: alla ämnen godkända (kommunala) | ✅ | ✅ | ✅ |
| **N15436** | Åk 9: behöriga till yrkesprogram | ✅ | ❌ | ⚠️ |
| **N15421** | Genomsnittligt meritvärde åk 9 | ❌ | ✅ | ✅ |
| **N15414** | Genomsnittlig betygspoäng i matematik åk 9 | ❌ | ✅ | ✅ |
| **N15503** | Åk 9: betygspoäng i matematik, genomsnitt | ✅ | ❌ | ⚠️ |
| **N15504** | Åk 9: meritvärde lägeskommun, genomsnitt | ✅ | ❌ | ⚠️ |
| **N15505** | Meritvärde åk 9 (kommunala skolor) | ✅ | ❌ | ⚠️ |
| **N15506** | Åk 9: meritvärde fristående skolor | ✅ | ❌ | ⚠️ |
| **N15502** | Åk 9: lägst betyg E i svenska, kommunala | ✅ | ❌ | ⚠️ |

---

### SALSA (7-9 Outcome)

SALSA = **S**kolans **A**vvikelse från förväntade resultat (givet elevförutsättningar)

| KPI ID | Namn | betygkolada | skolenhet | OU-data? |
|--------|------|------------|-----------|----------|
| **U15456** | Åk 9: alla ämnen godkända (modellberäknat) | ✅ | ❌ | ⚠️ |
| **U15414** | Åk 9: uppnått betygskriterierna, avvikelse från SALSA | ✅ | ❌ | ⚠️ |
| **U15415** | Åk 9: meritvärde, modellberäknat (SALSA) | ✅ | ❌ | ⚠️ |
| **U15416** | Åk 9: meritvärde, avvikelse från SALSA | ✅ | ❌ | ⚠️ |
| **U15423** | SALSA: Avvikelse behörighet yrkesprogram | ❌ | ✅ | ✅ |
| **U15424** | SALSA: Avvikelse genomsnittligt meritvärde | ❌ | ✅ | ✅ |

---

### Trygghet

| KPI ID | Namn | betygkolada | skolenhet | OU-data? |
|--------|------|------------|-----------|----------|
| **N15613** | Trygghet i skolan åk 5 | ✅ | ❌ | ⚠️ |
| **N15643** | Trygghet i skolan åk 8 | ✅ | ❌ | ⚠️ |

---

### Index & Kvalitet

| KPI ID | Namn | betygkolada | skolenhet | OU-data? |
|--------|------|------------|-----------|----------|
| **U15401** | Kvalitetsindex grundskola | ✅ | ❌ | ❌ |
| **U15900** | Effektivitetsindex kommunal grundskola F-9 | ✅ | ❌ | ❌ |
| **U15010** | Resursindex kommunal grundskola F-9 | ✅ | ❌ | ❌ |
| **U15200** | Medarbetarengagemang grundskola | ✅ | ❌ | ❌ |
| **U15402** | Elevenkätsindex åk 8 | ✅ | ❌ | ❌ |

---

### Kostnader

| KPI ID | Namn | betygkolada | skolenhet | OU-data? |
|--------|------|------------|-----------|----------|
| **U15011** | Nettokostnad per elev grundskolan | ✅ | ❌ | ❌ |
| **N15006** | Kostnad grundskola åk 1-9 hemkommun | ✅ | ❌ | ❌ |
| **N11032** | Kostnad per inskrivet barn kommunal förskola | ✅ | ❌ | ❌ |

---

### Nationella prov

| KPI ID | Namn | betygkolada | skolenhet | OU-data? |
|--------|------|------------|-----------|----------|
| **N15473** | Åk 3: klarat alla delar NP i matematik | ✅ | ❌ | ⚠️ |
| **N15472** | Åk 3: klarat alla delar NP i svenska/sva | ✅ | ❌ | ⚠️ |

---

### Studiero

| KPI ID | Namn | betygkolada | skolenhet | OU-data? |
|--------|------|------------|-----------|----------|
| **N15313** | Pedagogisk personal: studiero på lektioner | ✅ | ❌ | ⚠️ |
| **N15331** | Uppföljning av elevers upplevelse av studiero | ✅ | ❌ | ⚠️ |

---

### Legitimation

| KPI ID | Namn | betygkolada | skolenhet | OU-data? |
|--------|------|------------|-----------|----------|
| **N15814** | Andel lärare med lärarlegitimation och behörighet åk 1-9 | ✅ | ❌ | ⚠️ |

---

## Förklaring av symboler

- ✅ = KPI finns i systemet och har data
- ❌ = KPI finns INTE i systemet
- ⚠️ = KPI kan finnas i betygkolada MEN data kanske inte finns på OU-nivå

---

## Teknisk implementering

### Före (Problem)
```javascript
// Chart skapades alltid, även utan data
if (chart) chart.destroy();
chart = new Chart(document.getElementById('koladaChart'), config);
```

### Efter (Lösning)
```javascript
// Kontrollera om det är OU och om data saknas
if (!harLokalData && aktivSkolenhet) {
  // Dölj chart helt för OU utan data
  if (chartCanvas) chartCanvas.style.display = 'none';
  if (copyBtn) copyBtn.style.display = 'none';
  if (updateBtn) updateBtn.style.display = 'none';
  
  visaIngenDataAnalys(lokalNamn);
  uppdateraRiketAnalysis(rikeData.totalt, rikeData.ar);
  
  if (chart) {
    chart.destroy();
    chart = null;
  }
  return; // Avsluta tidigt
}

// Visa chart om data finns eller kommun-nivå
if (chartCanvas) chartCanvas.style.display = 'block';
if (copyBtn) copyBtn.style.display = 'block';
if (updateBtn) updateBtn.style.display = 'block';
```

### Förbättrat meddelande
```javascript
function uppdateraDatasetNotice(hasData) {
  if (!hasData && aktivSkolenhet) {
    notice.textContent = `⚠️ Ingen data tillgänglig för vald skolenhet (${aktivSkolenhetNamn}) och KPI ${aktivKPI}. Detta KPI finns troligen inte rapporterat på organisationsenhetsnivå.`;
    notice.classList.add('no-data'); // Röd varning
  }
}
```

### CSS-styling
```css
.dataset-notice.no-data {
  background: #fee2e2;
  border-color: #ef4444;
  color: #991b1b;
}

.dataset-notice.no-data::before {
  content: '⚠️ ';
  margin-right: 0.5rem;
}
```

---

## Rekommendationer

### För betygkolada.html
1. ✅ **Använd endast KPI:er som finns på OU-nivå** om du vill visa skolenhetsdata
2. ✅ **Validera data före rendering** (implementerat)
3. ⚠️ Överväg att lägga till metadata om vilka KPI:er som finns på OU-nivå

### För skolenhetsdashboard.html
1. ✅ **Fortsätt använda endast verifierade OU-KPI:er**
2. ✅ **Stage-detection fungerar bra**
3. ✅ **Jämförelselogik är robust**

---

## Testscenario

### Scenario 1: Kommun-nivå
1. Välj kommun från dropdown
2. Välj KPI (t.ex. N15508)
3. **Förväntat:** Chart visas med data, även om viss data saknas

### Scenario 2: OU-nivå MED data
1. Välj kommun
2. Välj skolenhet med data (t.ex. grundskola)
3. Välj KPI som finns på OU-nivå (t.ex. N15419)
4. **Förväntat:** Chart visas med OU-data

### Scenario 3: OU-nivå UTAN data
1. Välj kommun
2. Välj skolenhet
3. Välj KPI som INTE finns på OU-nivå (t.ex. U15401)
4. **Förväntat:** 
   - ⚠️ Rött varningsmeddelande visas
   - 🚫 Chart döljs
   - 🚫 Kopieringsknapp döljs
   - 📊 Riket-analys visas fortfarande

---

**Uppdaterad:** 2025-12-19  
**Version:** 1.0  
**Status:** Implementerad och testad
