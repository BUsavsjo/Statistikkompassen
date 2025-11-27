import { ALLA_KOMMUNER } from '../kommuner.js';
import { SKOLENHET_SEARCH_API, SKOLENHET_DATA_BASE } from '../constants.js';
import { hamtaKoladaData } from '../chartHelpers.js';
import { createKPIComparison, formatComparisonText, getComparisonRule, clearCache, detectSchoolType } from './comparisons.js';

const BASELINE_KPIS = [
  { id: 'N11805', label: 'Antal elever i förskoleklass', unit: 'st', scaleDependent: true },
  { id: 'N15807', label: 'Antal elever åk 1–9', unit: 'st', scaleDependent: true },
  { id: 'N15034', label: 'Elever per lärare (heltidstjänst), kommunal grundskola åk 1–9', unit: 'st' },
  { id: 'N15813', label: 'Andel legitimerade/behöriga lärare åk 1–9', unit: '%' },
  { id: 'N15031', label: 'Lärare med pedagogisk högskoleexamen i kommunal grundskola åk 1–9', unit: '%' }
];

const OUTCOME_KPIS = [
  // Åk 6 helhetsmått
  { id: 'N15539', label: 'Åk 6: Elever i alla ämnen som uppnått kunskapskraven, %', unit: '%', stage: 'f6' },
  // Åk 6 kärnämnen
  { id: 'N15482', label: 'Åk 6: Engelska minst E', unit: '%', stage: 'f6' },
  { id: 'N15485', label: 'Åk 6: Matematik minst E', unit: '%', stage: 'f6' },
  { id: 'N15488', label: 'Åk 6: Svenska minst E', unit: '%', stage: 'f6' },
  { id: 'N15509', label: 'Åk 6: Betygspoäng i matematik', unit: 'poäng', stage: 'f6' },
  { id: 'N15510', label: 'Åk 6: Betygspoäng i svenska', unit: 'poäng', stage: 'f6' },
  { id: 'N15516', label: 'Åk 6: Svenska som andraspråk minst E', unit: '%', stage: 'f6' },
  // Åk 9 helhetsmått
  { id: 'N15418', label: 'Åk 9: Elever i alla ämnen som uppnått kunskapskraven, %', unit: '%', stage: '79' },
  { id: 'N15503', label: 'Åk 9: Meritvärde (17 ämnen)', unit: 'poäng', stage: '79' },
  { id: 'N15504', label: 'Åk 9: Behöriga till yrkesprogram', unit: '%', stage: '79' },
  // Åk 9 kärnämnen (gamla KPIer behålls för bakåtkompatibilitet)
  { id: 'N15419', label: 'Åk 9: Alla ämnen godkända', unit: '%', stage: '79' },
  { id: 'N15436', label: 'Åk 9: Behöriga till yrkesprogram', unit: '%', stage: '79' },
  { id: 'N15505', label: 'Åk 9: Meritvärde (17 ämnen)', unit: 'poäng', stage: '79' },
  { id: 'N15482', label: 'Åk 9: Engelska minst E', unit: '%', stage: '79' },
  { id: 'N15485', label: 'Åk 9: Matematik minst E', unit: '%', stage: '79' },
  { id: 'N15488', label: 'Åk 9: Svenska minst E', unit: '%', stage: '79' },
  { id: 'N15516', label: 'Åk 9: Svenska som andraspråk minst E', unit: '%', stage: '79' },
  { id: 'N15523', label: 'Åk 9: Betygspoäng i matematik', unit: 'poäng', stage: '79' },
  // NP-gap
  { id: 'U15429', label: 'Åk 9: Högre slutbetyg än NP i matematik', unit: '%', stage: '79' },
  { id: 'U15430', label: 'Åk 9: Lägre slutbetyg än NP i matematik', unit: '%', stage: '79' },
  { id: 'U15431', label: 'Åk 9: Högre slutbetyg än NP i engelska', unit: '%', stage: '79' },
  { id: 'U15432', label: 'Åk 9: Lägre slutbetyg än NP i engelska', unit: '%', stage: '79' },
  { id: 'U15433', label: 'Åk 9: Högre slutbetyg än NP i svenska', unit: '%', stage: '79' },
  { id: 'U15434', label: 'Åk 9: Lägre slutbetyg än NP i svenska', unit: '%', stage: '79' }
];

const SALSA_KPIS = [
  { id: 'U15413', label: 'Åk 9: SALSA-modell förväntat (alla ämnen)', unit: '%' },
  { id: 'U15414', label: 'Åk 9: Avvikelse faktisk vs SALSA-modell (%)', unit: 'procentenheter' },
  { id: 'U15415', label: 'Åk 9: SALSA-modell förväntat meritvärde', unit: 'poäng' },
  { id: 'U15416', label: 'Åk 9: Avvikelse faktisk vs SALSA-modell (meritvärde)', unit: 'poäng' }
];

const TRYG_KPIS = [
  { id: 'N15613', label: 'Åk 5: Trygghet', unit: '%' },
  { id: 'N15603', label: 'Åk 5: Studiero', unit: '%' },
  { id: 'N15614', label: 'Åk 5: Vuxnas agerande mot kränkningar', unit: '%' }
];

const filterState = { hideF6: false, hide79: false };
const skolenhetCache = new Map();
const kpiCache = new Map();

/**
 * Väljer rätt baseline för en KPI baserat på jämförelseregel
 * UPPDATERAD: Prioriterar kommungenomsnitt inom samma skolform
 * @param {object} def - KPI-definition
 * @param {object} comp - Comparison data från createKPIComparison
 * @returns {number|null} - Valt baseline-värde
 */
function pickBaseline(def, comp) {
  if (!comp || !comp.available) return null;
  
  // Om kommungruppen är för liten, returnera null (neutral status)
  if (comp.groupInsufficient) {
    return null;
  }
  
  // PRIMÄR JÄMFÖRELSE: Kommungenomsnitt inom samma skolform
  if (comp.values.kommun_schooltype && comp.values.kommun_schooltype.length > 0) {
    return comp.values.kommun_schooltype[0];
  }
  
  // Fallback: riket som referens (om kommundata saknas helt)
  if (comp.values.riket_reference && comp.values.riket_reference.length > 0) {
    return comp.values.riket_reference[comp.values.riket_reference.length - 1];
  }
  
  return null;
}

/**
 * Formaterar differens enhetsmedvetet
 * @param {number} diff - Differensvärde
 * @param {string} unit - Enhet (%, st, poäng)
 * @returns {string} Formaterad diff med korrekt enhet
 */
function formatDiff(diff, unit) {
  const sign = diff >= 0 ? '+' : '';
  const value = diff.toFixed(1);
  
  if (unit === '%') {
    return `${sign}${value} procentenheter`;
  } else if (unit === 'st') {
    return `${sign}${value} elever`;
  } else if (unit === 'poäng') {
    return `${sign}${value} poäng`;
  } else {
    return `${sign}${value} ${unit || ''}`;
  }
}

/**
 * Skapar KPI-kort med strukturerade jämförelser enligt regelverket
 * @param {object} kpi - KPI-data med värde, trend och eventuell comparisonData
 * @returns {HTMLElement} - KPI-kortelement
 */
function createKPICard(kpi) {
  const card = document.createElement('div');
  card.className = 'kpi-item';
  
  // KPIer som ska ha neutral färg (ingen automatisk grön/röd)
  const isNPGap = kpi.id && (kpi.id.startsWith('U1542') || kpi.id.startsWith('U1543'));
  const isBaselineCount = kpi.id && (kpi.id === 'N11805' || kpi.id === 'N15807'); // Elevantal
  const isSALSA = kpi.id && kpi.id.startsWith('U154') && ['U15413', 'U15414', 'U15415', 'U15416'].includes(kpi.id);
  
  // Bestäm färgindikator baserat på trend-status (förbättring, försämring, stabil)
  // SKIP för NP-gap, elevantal och SALSA
  let colorClass = '';
  if (!isNPGap && !isBaselineCount && !isSALSA && kpi.trendData) {
    const dir = kpi.trendData.dir;
    if (dir === 'improving') {
      colorClass = 'status-green'; // Förbättring
    } else if (dir === 'declining') {
      colorClass = 'status-red'; // Försämring
    } else {
      colorClass = 'status-lightgreen'; // Stabil eller okänt
    }
  }
  
  if (colorClass) {
    card.classList.add(colorClass);
  }
  
  // Om det är ett NP-gap kort, använd neutral styling
  if (isNPGap) {
    card.classList.add('np-gap-individual');
  }
  
  // Om det är elevantal eller SALSA, använd neutral styling
  if (isBaselineCount || isSALSA) {
    card.classList.add('neutral-kpi');
  }

  const label = document.createElement('div');
  label.className = 'kpi-label';
  label.textContent = kpi.label;

  const value = document.createElement('div');
  value.className = 'kpi-value';
  
  // Visa huvudvärde
  const mainValue = `${kpi.value ?? '—'} ${kpi.unit || ''}`.trim();
  value.textContent = mainValue;

  // Jämförelsesektion (om comparisonData finns)
  const comparisonDiv = document.createElement('div');
  comparisonDiv.className = 'kpi-comparison';
  
  if (kpi.comparisonData && kpi.comparisonData.available) {
    const comp = kpi.comparisonData;
    const rule = comp.rule_bucket;
    const isScaleDependent = kpi.scaleDependent || false;
    
    // Formatera jämförelser baserat på ny logik
    const compLines = [];
    
    // Kontrollera om gruppen är för liten
    if (comp.groupInsufficient) {
      compLines.push(`⚠ För få enheter (${comp.municipalityGroupSize || 0}) i kommunen med samma skolform för jämförelse`);
      
      // Visa riket som referens
      if (comp.deltas.main_vs_riket_reference !== undefined) {
        const riketVal = comp.values.riket_reference[comp.values.riket_reference.length - 1];
        const diff = comp.deltas.main_vs_riket_reference;
        compLines.push(`Riket (referens) ${riketVal.toFixed(1)}${kpi.unit} (${formatDiff(diff, kpi.unit)})`);
      }
    } else {
      // PRIMÄR JÄMFÖRELSE: Kommungenomsnitt inom samma skolform
      if (comp.deltas.main_vs_kommun_schooltype !== undefined) {
        const kommunVal = comp.values.kommun_schooltype[0];
        const diff = comp.deltas.main_vs_kommun_schooltype;
        const schoolTypeLabel = comp.schoolType ? ` (${comp.schoolType})` : '';
        compLines.push(`Kommun${schoolTypeLabel} ${kommunVal.toFixed(1)}${kpi.unit} (${formatDiff(diff, kpi.unit)})`);
      }
      
      // SEKUNDÄR REFERENS: Riket (grå, endast visning)
      if (comp.deltas.main_vs_riket_reference !== undefined) {
        const riketVal = comp.values.riket_reference[comp.values.riket_reference.length - 1];
        const diff = comp.deltas.main_vs_riket_reference;
        compLines.push(`<span style="color: #94a3b8;">Riket (ref) ${riketVal.toFixed(1)}${kpi.unit} (${formatDiff(diff, kpi.unit)})</span>`);
      }
    }
    
    // Lägg till trend med enhetsmedveten formatering
    if (comp.trend && comp.trend.direction !== 'flat') {
      const trendIcon = comp.trend.direction === 'up' ? '↗' : '↘';
      compLines.push(`${trendIcon} ${formatDiff(comp.trend.change, kpi.unit)} (3 år)`);
    } else {
      compLines.push('→ stabilt (3 år)');
    }
    
    comparisonDiv.innerHTML = compLines.join(' | ');
  } else {
    // Fallback till gammal trendtext om ingen comparisonData
    comparisonDiv.textContent = kpi.trendText || 'Ingen jämförelsedata';
  }

  const analysis = document.createElement('div');
  analysis.className = 'kpi-analysis';
  analysis.textContent = kpi.analysis || '';

  card.append(label, value, comparisonDiv, analysis);
  return card;
}

function setLoading(sectionId, loading = true) {
  const el = document.getElementById(sectionId);
  if (!el) return;
  if (loading) {
    el.innerHTML = `
      <div class="loading-message">Laddar data...</div>
      <div class="progress-container">
        <div class="progress-bar" style="width: 0%" data-section="${sectionId}"></div>
        <div class="progress-text">0%</div>
      </div>
    `;
  } else {
    el.innerHTML = '';
  }
}

function updateProgress(sectionId, current, total) {
  const el = document.getElementById(sectionId);
  if (!el) return;
  const progressBar = el.querySelector(`[data-section="${sectionId}"]`);
  const progressText = el.querySelector('.progress-text');
  if (progressBar && progressText) {
    const percent = Math.round((current / total) * 100);
    progressBar.style.width = `${percent}%`;
    progressText.textContent = `${percent}%`;
  }
}

async function hamtaSkolenheterForKommun(kommunId) {
  if (skolenhetCache.has(kommunId)) return skolenhetCache.get(kommunId);

  const fetchPromise = (async () => {
    let url = `${SKOLENHET_SEARCH_API}?municipality=${kommunId}&per_page=500`;
    const enheter = [];
    while (url) {
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) break;
      const data = await response.json();
      const resultat = data.results || data.values || [];
      resultat.forEach(enhet => {
        enheter.push({ id: enhet.id, title: enhet.title, type: (enhet.type || enhet.type_name || '').toLowerCase() });
      });
      url = data.next_page || data.next || null;
    }
    enheter.sort((a, b) => a.title.localeCompare(b.title, 'sv'));
    return enheter;
  })();

  skolenhetCache.set(kommunId, fetchPromise);
  return fetchPromise;
}

function kpiDefsOutcome() {
  return OUTCOME_KPIS;
}

// ===== ANALYSMOTOR: Klassificering och beräkningar =====

/**
 * Analyserar NP-gap (slutbetyg vs nationella prov)
 * @param {object} hogreData - KPI för högre slutbetyg än NP
 * @param {object} lagreData - KPI för lägre slutbetyg än NP
 * @param {string} amne - Ämnesnamn (matematik/engelska/svenska)
 * @returns {object} NP-gap analys med risknivå, riktning, badges
 */
function analyseraNPGap(hogreData, lagreData, amne) {
  // Kontrollera om data finns
  if (!hogreData?.latest || !lagreData?.latest) {
    return {
      nettoGap: null,
      riskNiva: 'okänd',
      riktning: 'Saknar data',
      badge: 'neutral',
      trendText: 'Ingen data',
      kohortVarning: false,
      hogreAndel: null,
      lagreAndel: null,
      analysText: 'Data saknas för NP-gap analys.'
    };
  }

  const hogreAndel = hogreData.latest;
  const lagreAndel = lagreData.latest;
  const nettoGap = hogreAndel - lagreAndel;
  
  // Beräkna 3-års trendförändring för netto-gap
  const hogreTrend3y = hogreData.diff3 || 0;
  const lagreTrend3y = lagreData.diff3 || 0;
  const nettoGapTrend3y = hogreTrend3y - lagreTrend3y;
  
  // Basrisknivå baserat på absolut netto-gap
  const absGap = Math.abs(nettoGap);
  let riskNiva = 'kalibrerat'; // <5 p.p
  if (absGap >= 15) {
    riskNiva = 'hög risk';
  } else if (absGap >= 10) {
    riskNiva = 'uppmärksamhet';
  } else if (absGap >= 5) {
    riskNiva = 'bevaka';
  }
  
  // Justera risknivå baserat på trend
  if (Math.abs(nettoGapTrend3y) >= 3) {
    if (nettoGapTrend3y >= 3) {
      // Gap ökar - höj risk
      if (riskNiva === 'kalibrerat') riskNiva = 'bevaka';
      else if (riskNiva === 'bevaka') riskNiva = 'uppmärksamhet';
      else if (riskNiva === 'uppmärksamhet') riskNiva = 'hög risk';
    } else if (nettoGapTrend3y <= -3) {
      // Gap minskar - sänk risk
      if (riskNiva === 'hög risk') riskNiva = 'uppmärksamhet';
      else if (riskNiva === 'uppmärksamhet') riskNiva = 'bevaka';
      else if (riskNiva === 'bevaka') riskNiva = 'kalibrerat';
    }
  }
  
  // Klassificera riktning
  let riktning = 'Kalibrerat';
  let badge = 'neutral';
  if (nettoGap > 5) {
    riktning = 'Lutar mot inflation';
    badge = 'inflation';
  } else if (nettoGap < -5) {
    riktning = 'Lutar mot deflation';
    badge = 'deflation';
  }
  
  // Trendtext
  let trendText = 'Stabilt';
  if (nettoGapTrend3y >= 3) {
    trendText = 'Gapet ökar';
  } else if (nettoGapTrend3y <= -3) {
    trendText = 'Gapet minskar';
  }
  
  // Kohortvarning (mockad för nu - kan läggas till när n finns)
  const kohortVarning = false; // Sätt till true om n < 15
  
  // Generera analys och åtgärdstext
  let analysText = '';
  if (riktning === 'Lutar mot inflation') {
    analysText = `<strong>${amne}:</strong> Slutbetyg systematiskt högre än NP-resultat. Kan indikera behov av <em>gemensam kalibrering, provmatchning och bedömningssamtal</em>.`;
  } else if (riktning === 'Lutar mot deflation') {
    analysText = `<strong>${amne}:</strong> Slutbetyg systematiskt lägre än NP-resultat. Undersök om eleverna får tillräckligt <em>underlag för bedömning, uppföljning och uthållighet över tid</em>.`;
  } else {
    analysText = `<strong>${amne}:</strong> Bedömning väl kalibrerad med NP-resultat.`;
  }
  
  return {
    nettoGap,
    riskNiva,
    riktning,
    badge,
    trendText,
    kohortVarning,
    hogreAndel,
    lagreAndel,
    analysText
  };
}

/**
 * Skapar NP-gap kort med special rendering (neutral färg + badges)
 * @param {object} hogreKPI - KPI för högre slutbetyg än NP
 * @param {object} lagreKPI - KPI för lägre slutbetyg än NP
 * @param {string} amne - Ämnesnamn
 * @returns {HTMLElement} NP-gap kort
 */
function createNPGapCard(hogreKPI, lagreKPI, amne) {
  const npAnalys = analyseraNPGap(hogreKPI.trendData, lagreKPI.trendData, amne);
  
  const card = document.createElement('div');
  card.className = 'kpi-item np-gap-card'; // Neutral basfärg via CSS
  
  // Risk-based coloring (gul för uppmärksamhet/hög risk)
  if (npAnalys.riskNiva === 'hög risk' || npAnalys.riskNiva === 'uppmärksamhet') {
    card.classList.add('np-attention');
  }
  
  const label = document.createElement('div');
  label.className = 'kpi-label';
  label.textContent = `${amne}: NP-gap analys`;
  
  // Visa båda andelar + netto-gap
  const value = document.createElement('div');
  value.className = 'kpi-value np-gap-value';
  if (npAnalys.hogreAndel != null && npAnalys.lagreAndel != null) {
    value.innerHTML = `
      <div class="np-components">
        <span class="np-hogre">↑ ${npAnalys.hogreAndel.toFixed(1)}%</span>
        <span class="np-lagre">↓ ${npAnalys.lagreAndel.toFixed(1)}%</span>
      </div>
      <div class="np-netto">Netto: ${npAnalys.nettoGap > 0 ? '+' : ''}${npAnalys.nettoGap.toFixed(1)} p.p</div>
    `;
  } else {
    value.textContent = '— Saknar data';
  }
  
  // Badges och riskindikatorer
  const badgesDiv = document.createElement('div');
  badgesDiv.className = 'np-badges';
  
  // Riktningsbadge
  const riktningBadge = document.createElement('span');
  riktningBadge.className = `np-badge badge-${npAnalys.badge}`;
  riktningBadge.textContent = npAnalys.riktning;
  badgesDiv.appendChild(riktningBadge);
  
  // Risklampa
  const riskBadge = document.createElement('span');
  riskBadge.className = `np-risk risk-${npAnalys.riskNiva.replace(' ', '-')}`;
  riskBadge.textContent = npAnalys.riskNiva.charAt(0).toUpperCase() + npAnalys.riskNiva.slice(1);
  badgesDiv.appendChild(riskBadge);
  
  // Trendtext
  const trendBadge = document.createElement('span');
  trendBadge.className = 'np-trend';
  trendBadge.textContent = npAnalys.trendText;
  badgesDiv.appendChild(trendBadge);
  
  // Kohortvarning
  if (npAnalys.kohortVarning) {
    const varning = document.createElement('span');
    varning.className = 'np-warning';
    varning.textContent = '⚠ Liten kohort - tolka försiktigt';
    badgesDiv.appendChild(varning);
  }
  
  // Analys/åtgärdstext
  const analysis = document.createElement('div');
  analysis.className = 'kpi-analysis';
  analysis.innerHTML = npAnalys.analysText;
  
  card.appendChild(label);
  card.appendChild(value);
  card.appendChild(badgesDiv);
  card.appendChild(analysis);
  
  return card;
}

/**
 * Klassificerar en KPI baserat på nivå och trend
 * @param {object} kpi - KPI-data från hamtaKpiCardData
 * @param {number|null} groupAvg - Gruppgenomsnitt (från Kolada eller mockad)
 * @returns {object} { nivaStatus, trendStatus, diff, trend3y }
 */
function klassificeraKPI(kpi, groupAvg = null) {
  const current = kpi?.latest;
  const trend3y = kpi?.diff3;
  
  // Hantera saknad data
  if (current == null) {
    return { nivaStatus: 'missing', trendStatus: 'missing', diff: 0, trend3y: 0 };
  }
  
  // Beräkna diff mot gruppgenomsnitt
  let diff = 0;
  if (groupAvg != null) {
    diff = current - groupAvg;
  }
  
  // Klassificera nivåstatus (baserat på diff mot gruppsnitt)
  // Grönt: diff >= +2, Gult: -2 till +2, Rött: <= -2
  let nivaStatus = 'yellow';
  if (diff >= 2) {
    nivaStatus = 'green';
  } else if (diff <= -2) {
    nivaStatus = 'red';
  }
  
  // Klassificera trendstatus (baserat på 3-årsförändring)
  // Upp: >= +3, Stabil: -3 till +3, Ner: <= -3
  let trendStatus = 'stabil';
  if (trend3y != null) {
    if (trend3y >= 3) {
      trendStatus = 'upp';
    } else if (trend3y <= -3) {
      trendStatus = 'ner';
    }
  }
  
  return { nivaStatus, trendStatus, diff, trend3y: trend3y || 0 };
}

/**
 * Beräknar sektionsstatus (trafikljus) för en grupp av KPIer
 * @param {array} kpiList - Lista med KPI-definitioner
 * @param {object} kpiData - Objekt med KPI-data { kpiId: trendData }
 * @param {object} groupAvgs - Gruppgenomsnitt för varje KPI { kpiId: avgValue }
 * @returns {object} { status: 'red'|'yellow'|'green', summary: 'text' }
 */
function beraknaSektionStatus(kpiList, kpiData, groupAvgs = {}) {
  let greenCount = 0, yellowCount = 0, redCount = 0;
  let decliningCount = 0;
  
  kpiList.forEach(kpiDef => {
    const data = kpiData[kpiDef.id];
    if (!data || data.latest == null) return; // Skippa saknad data
    
    const groupAvg = groupAvgs[kpiDef.id] || null;
    const klassif = klassificeraKPI(data, groupAvg);
    
    if (klassif.nivaStatus === 'green') greenCount++;
    else if (klassif.nivaStatus === 'yellow') yellowCount++;
    else if (klassif.nivaStatus === 'red') redCount++;
    
    if (klassif.trendStatus === 'ner') decliningCount++;
  });
  
  // Trafikljuslogik:
  // Rött: >=2 röda KPIer ELLER 1 röd + nedåtgående trend
  // Grönt: Majoritet gröna OCH inga röda
  // Gult: Allt annat
  let status = 'yellow';
  let summary = 'Blandat läge';
  let statusWord = 'UPPMÄRKSAMHET';
  let statusExplanation = 'Gult = Följ utvecklingen';
  let icon = '🟡';
  let actionText = 'Följ upp regelbundet';
  
  const totalCount = greenCount + yellowCount + redCount;
  
  if (redCount >= 2 || (redCount >= 1 && decliningCount >= 1)) {
    status = 'red';
    summary = `${redCount} av ${totalCount} indikatorer under snitt`;
    statusWord = 'ÅTGÄRDSBEHOV';
    statusExplanation = 'Rött = Kräver åtgärd nu';
    icon = '⛔';
    actionText = 'Prioritera åtgärder omgående';
  } else if (greenCount > (yellowCount + redCount) && redCount === 0) {
    status = 'green';
    summary = `${greenCount} av ${totalCount} indikatorer över snitt`;
    statusWord = 'STABILITET';
    statusExplanation = 'Grönt = Fortsätt arbetet';
    icon = '✅';
    actionText = 'Behåll nuvarande arbetssätt';
  } else {
    summary = `${greenCount} över, ${yellowCount} på, ${redCount} under snitt`;
  }
  
  // Beräkna trend
  let trendIcon = '→';
  let trendText = 'Stabil';
  if (decliningCount > greenCount) {
    trendIcon = '↘';
    trendText = 'Försämras';
  } else if (greenCount > decliningCount && decliningCount === 0) {
    trendIcon = '↗';
    trendText = 'Förbättras';
  }
  
  return { status, summary, statusWord, statusExplanation, icon, actionText, trendIcon, trendText };
}

/**
 * Genererar insikter: Styrka, Risk, Hävstång
 * @param {object} kpiData - Objekt med all KPI-data
 * @param {object} groupAvgs - Gruppgenomsnitt
 * @returns {object} { styrka, risk, havstang }
 */
function genereraInsikter(kpiData, groupAvgs = {}) {
  // Hitta bästa och sämsta KPIer baserat på diff och trend
  let bestKPI = { id: null, diff: -Infinity, label: '', unit: '' };
  let worstKPI = { id: null, diff: Infinity, label: '', unit: '' };
  let bestTrendKPI = { id: null, trend3y: -Infinity, label: '', unit: '' };
  let worstTrendKPI = { id: null, trend3y: Infinity, label: '', unit: '' };
  
  const allKPIs = [...BASELINE_KPIS, ...OUTCOME_KPIS, ...SALSA_KPIS, ...TRYG_KPIS];
  
  allKPIs.forEach(kpiDef => {
    const data = kpiData[kpiDef.id];
    if (!data || data.latest == null) return;
    
    const groupAvg = groupAvgs[kpiDef.id] || null;
    const klassif = klassificeraKPI(data, groupAvg);
    
    if (klassif.diff > bestKPI.diff) {
      bestKPI = { id: kpiDef.id, diff: klassif.diff, label: kpiDef.label, unit: data.unit || kpiDef.unit };
    }
    if (klassif.diff < worstKPI.diff) {
      worstKPI = { id: kpiDef.id, diff: klassif.diff, label: kpiDef.label, unit: data.unit || kpiDef.unit };
    }
    if (klassif.trend3y > bestTrendKPI.trend3y) {
      bestTrendKPI = { id: kpiDef.id, trend3y: klassif.trend3y, label: kpiDef.label, unit: data.unit || kpiDef.unit };
    }
    if (klassif.trend3y < worstTrendKPI.trend3y) {
      worstTrendKPI = { id: kpiDef.id, trend3y: klassif.trend3y, label: kpiDef.label, unit: data.unit || kpiDef.unit };
    }
  });
  
  // Styrka: Den indikator med bäst diff eller trend (enhetsanpassad)
  let styrka = 'Ingen tydlig styrka identifierad.';
  if (bestKPI.diff > 2) {
    styrka = `<strong>${bestKPI.label}</strong> ligger ${formatDiff(bestKPI.diff, bestKPI.unit)} över gruppsnitt.`;
  } else if (bestTrendKPI.trend3y > 3) {
    styrka = `<strong>${bestTrendKPI.label}</strong> har förbättrats med ${formatDiff(bestTrendKPI.trend3y, bestTrendKPI.unit)} på 3 år.`;
  }
  
  // Risk: Den indikator med sämst diff eller trend (enhetsanpassad)
  let risk = 'Ingen tydlig risk identifierad.';
  if (worstKPI.diff < -2) {
    risk = `<strong>${worstKPI.label}</strong> ligger ${formatDiff(Math.abs(worstKPI.diff), worstKPI.unit)} under gruppsnitt.`;
  } else if (worstTrendKPI.trend3y < -3) {
    risk = `<strong>${worstTrendKPI.label}</strong> har försämrats med ${formatDiff(Math.abs(worstTrendKPI.trend3y), worstTrendKPI.unit)} på 3 år.`;
  }
  
  // Hävstång: Smart rekommendation baserad på data
  let havstang = 'Fortsätt arbeta med nuvarande prioriteringar.';
  
  // Kontrollera studiero och trygghet
  const studiero = kpiData['N15603'];
  const trygghet = kpiData['N15613'];
  if (studiero?.latest && studiero.latest < 80) {
    havstang = 'Fokusera på <strong>studiero och tydliga strukturer</strong> – lågåterkommande grund för lärande.';
  } else if (trygghet?.latest && trygghet.latest < 80) {
    havstang = 'Prioritera <strong>trygghetsskapande åtgärder</strong> – förutsättning för resultat.';
  }
  // Kontrollera kärnämnen
  else if (worstKPI.id === 'N15482' || worstKPI.id === 'N15485' || worstKPI.id === 'N15488') {
    havstang = `Stärk undervisningen i <strong>${worstKPI.label.toLowerCase()}</strong> med formativ bedömning.`;
  }
  // Kontrollera lärarbehörighet
  else if (kpiData['N15813']?.latest && kpiData['N15813'].latest < 70) {
    havstang = 'Säkra <strong>kompetensförsörjning</strong> – behöriga lärare avgörande för kvalitet.';
  }
  // Kontrollera SALSA-avvikelse
  else if (worstKPI.id?.startsWith('U154')) {
    havstang = 'Analysera undervisningsstruktur – <strong>SALSA visar outnyttjad potential</strong>.';
  }
  
  return { styrka, risk, havstang };
}

/**
 * Beräknar gruppstatus för kärnämnesgrupp
 * @param {Array} cards - Lista med kort i gruppen
 * @param {Object} realAvgs - Gruppgenomsnitt
 * @returns {Object} - { status, badge, label }
 */
function beraknaGruppStatus(cards, realAvgs) {
  let hasRed = false;
  let hasYellow = false;
  let hasGreen = false;
  let hasDecline = false;
  
  cards.forEach(({ card, def }) => {
    const groupAvg = realAvgs[def.id] || null;
    const klassif = klassificeraKPI(card.trendData, groupAvg);
    
    if (klassif.nivaStatus === 'red' || klassif.trendStatus === 'ner') {
      hasRed = true;
      if (klassif.trendStatus === 'ner') hasDecline = true;
    } else if (klassif.nivaStatus === 'yellow') {
      hasYellow = true;
    } else if (klassif.nivaStatus === 'green') {
      hasGreen = true;
    }
  });
  
  let status = 'green';
  let badge = 'Över kommunens snitt';
  let label = '✅';
  
  if (hasRed) {
    status = 'red';
    badge = hasDecline ? 'Under snitt och försämras' : 'Under kommunens snitt';
    label = '⛔';
  } else if (hasYellow) {
    status = 'yellow';
    badge = 'I nivå med kommunens snitt';
    label = '🟡';
  }
  
  return { status, badge, label };
}

/**
 * Sorterar kort efter uppmärksamhetsnivå (röd/ner först, gul i mitten, grön/upp sist)
 * @param {Array} cards - Lista med kort
 * @param {Object} realAvgs - Gruppgenomsnitt
 * @returns {Array} - Sorterad lista
 */
function sorteraEfterUppmarksamhet(cards, realAvgs) {
  return cards.sort((a, b) => {
    const klassifA = klassificeraKPI(a.card.trendData, realAvgs[a.def.id]);
    const klassifB = klassificeraKPI(b.card.trendData, realAvgs[b.def.id]);
    
    // Prioritet: röd/ner > gul > grön/upp
    const scoreA = (klassifA.nivaStatus === 'red' || klassifA.trendStatus === 'ner') ? 3 
                 : klassifA.nivaStatus === 'yellow' ? 2 : 1;
    const scoreB = (klassifB.nivaStatus === 'red' || klassifB.trendStatus === 'ner') ? 3 
                 : klassifB.nivaStatus === 'yellow' ? 2 : 1;
    
    return scoreB - scoreA;
  });
}

/**
 * Skapar en grupp-header för kärnämne
 * @param {string} amne - Ämnesnamn
 * @param {Object} status - Status från beraknaGruppStatus
 * @returns {HTMLElement}
 */
function skapaGruppHeader(amne, status) {
  const header = document.createElement('div');
  header.className = `subject-group-header ${status.status}`;
  header.innerHTML = `
    <div class="subject-title">
      <span class="subject-icon">${status.label}</span>
      <h3>${amne}</h3>
    </div>
    <div class="subject-badge ${status.status}">${status.badge}</div>
  `;
  return header;
}

/**
 * Renderar grupperade resultatkort med kärnämnesstruktur
 * @param {string} sectionId - ID för sektion
 * @param {Array} results - Alla kortresultat
 * @param {Object} kpiData - KPI-data objekt
 * @param {Object} realAvgs - Gruppgenomsnitt
 * @param {string} schoolType - Skolform ('F-6', '7-9', 'F-9')
 */
function renderGroupedOutcomeKPIs(sectionId, results, kpiData, realAvgs, schoolType) {
  const sectionEl = document.getElementById(sectionId);
  if (!sectionEl) {
    console.error(`Element with id '${sectionId}' not found`);
    return;
  }
  
  console.log('DEBUG renderGroupedOutcomeKPIs called:', {
    resultsCount: results?.length,
    resultIds: results?.map(r => r.def?.id),
    schoolType
  });
  
  if (!results || results.length === 0) {
    console.error('renderGroupedOutcomeKPIs: No results provided!');
    sectionEl.innerHTML = '<p style="padding: 20px; color: red;">Inga resultatdata tillgängliga</p>';
    return;
  }
  
  sectionEl.innerHTML = '';
  
  // Definiera gruppstruktur
  const groups = {
    'summary_f6': {
      title: 'Samlad signal åk 6',
      kpis: ['N15539'],
      stage: 'f6',
      isSummary: true
    },
    'summary_79': {
      title: 'Samlad signal åk 9',
      kpis: ['N15418', 'N15503', 'N15504'],
      stage: '79',
      isSummary: true
    },
    'svenska_f6': {
      title: 'Svenska åk 6',
      kpis: ['N15488', 'N15516', 'N15510'],
      npGap: { hogre: 'U15433', lagre: 'U15434', amne: 'Svenska' },
      stage: 'f6'
    },
    'matematik_f6': {
      title: 'Matematik åk 6',
      kpis: ['N15485', 'N15509'],
      npGap: { hogre: 'U15429', lagre: 'U15430', amne: 'Matematik' },
      stage: 'f6'
    },
    'engelska_f6': {
      title: 'Engelska åk 6',
      kpis: ['N15482'],
      npGap: { hogre: 'U15431', lagre: 'U15432', amne: 'Engelska' },
      stage: 'f6'
    },
    'svenska_79': {
      title: 'Svenska åk 9',
      kpis: ['N15488', 'N15516'],
      npGap: { hogre: 'U15433', lagre: 'U15434', amne: 'Svenska' },
      stage: '79'
    },
    'matematik_79': {
      title: 'Matematik åk 9',
      kpis: ['N15485', 'N15523'],
      npGap: { hogre: 'U15429', lagre: 'U15430', amne: 'Matematik' },
      stage: '79'
    },
    'engelska_79': {
      title: 'Engelska åk 9',
      kpis: ['N15482'],
      npGap: { hogre: 'U15431', lagre: 'U15432', amne: 'Engelska' },
      stage: '79'
    }
  };
  
  const frag = document.createDocumentFragment();
  
  // Iterera genom alla grupper och dölj tomma
  Object.entries(groups).forEach(([groupKey, group]) => {
    // Hitta kort som hör till gruppen
    const groupCards = results.filter(({ def }) => group.kpis.includes(def.id));
    
    console.log(`DEBUG Group ${groupKey} processing:`, {
      groupTitle: group.title,
      groupKPIs: group.kpis,
      foundCards: groupCards.map(c => c.def.id),
      allAvailableCards: results.map(r => r.def.id)
    });
    
    // Dölj grupper utan kort (data saknas)
    if (groupCards.length === 0) return;
    
    // Sortera kort efter uppmärksamhet
    const sortedCards = sorteraEfterUppmarksamhet(groupCards, realAvgs);
    
    // Beräkna gruppstatus (skippa för summary-grupper)
    let groupStatus = null;
    if (!group.isSummary) {
      groupStatus = beraknaGruppStatus(sortedCards, realAvgs);
    }
    
    // Skapa grupp-header
    if (groupStatus) {
      frag.appendChild(skapaGruppHeader(group.title, groupStatus));
    } else {
      // Summary-grupper får enkel header
      const summaryHeader = document.createElement('div');
      summaryHeader.className = 'subject-group-header summary';
      summaryHeader.innerHTML = `<h3>${group.title}</h3>`;
      frag.appendChild(summaryHeader);
    }
    
    // Skapa grupp-container
    const groupContainer = document.createElement('div');
    groupContainer.className = 'subject-group-cards';
    
    // Lägg till kort
    sortedCards.forEach(({ card, def }) => {
      groupContainer.appendChild(createKPICard(card));
      kpiData[def.id] = {
        ...card.trendData,
        rule_bucket: card.comparisonData?.rule_bucket || null,
        unit: def.unit,
        scaleDependent: def.scaleDependent || false
      };
    });
    
    // Lägg till NP-gap kalibrering om det finns
    if (group.npGap) {
      const hogreCard = results.find(r => r.def.id === group.npGap.hogre);
      const lagreCard = results.find(r => r.def.id === group.npGap.lagre);
      
      if (hogreCard && lagreCard) {
        // Skapa kalibrerings-header
        const calibHeader = document.createElement('div');
        calibHeader.className = 'calibration-header';
        calibHeader.innerHTML = `<h4>📊 Kalibrering (NP-gap)</h4>`;
        groupContainer.appendChild(calibHeader);
        
        groupContainer.appendChild(createNPGapCard(hogreCard.card, lagreCard.card, group.npGap.amne));
        
        kpiData[group.npGap.hogre] = { ...hogreCard.card.trendData, unit: '%' };
        kpiData[group.npGap.lagre] = { ...lagreCard.card.trendData, unit: '%' };
      }
    }
    
    frag.appendChild(groupContainer);
  });
  
  sectionEl.appendChild(frag);
}

/**
 * Genererar narrativ text (3-6 meningar) baserat på regelmallar
 * @param {object} kpiData - All KPI-data
 * @param {object} groupAvgs - Gruppgenomsnitt
 * @returns {string} Narrativ text
 */
// Helper: Analysera F-6 resultat med N15539 som huvudsignal
function analyseraF6Resultat(kpiData, groupAvgs) {
  const meningar = [];
  const allaAmnenF6 = kpiData['N15539'];
  const sveF6 = kpiData['N15488'];
  const matF6 = kpiData['N15485'];
  const engF6 = kpiData['N15482'];
  const svaF6 = kpiData['N15516'];
  const matPoangF6 = kpiData['N15509'];
  const svePoangF6 = kpiData['N15510'];
  const studiero = kpiData['N15603'];
  const trygghet = kpiData['N15613'];
  
  if (allaAmnenF6?.latest != null) {
    const allaF6Klassif = klassificeraKPI(allaAmnenF6, groupAvgs['N15539']);
    
    // Huvudsignal baserad på N15539
    if (allaF6Klassif.nivaStatus === 'red' || allaF6Klassif.trendStatus === 'ner') {
      if (allaF6Klassif.nivaStatus === 'red' && allaF6Klassif.trendStatus === 'ner') {
        meningar.push(`Den samlade måluppfyllelsen i årskurs 6 ligger under gruppsnitt och försämras över tid.`);
      } else if (allaF6Klassif.nivaStatus === 'red') {
        meningar.push(`Den samlade måluppfyllelsen i årskurs 6 ligger under gruppsnitt.`);
      } else {
        meningar.push(`Den samlade måluppfyllelsen i årskurs 6 försämras.`);
      }
      
      // Systemiskt vs ämnesspecifikt
      const amnesKlassif = [
        { kpi: sveF6, label: 'svenska', id: 'N15488' },
        { kpi: matF6, label: 'matematik', id: 'N15485' },
        { kpi: engF6, label: 'engelska', id: 'N15482' },
        { kpi: svaF6, label: 'svenska som andraspråk', id: 'N15516' }
      ].map(item => ({
        ...item,
        klassif: klassificeraKPI(item.kpi, groupAvgs[item.id])
      })).filter(item => item.kpi?.latest != null);
      
      const amnesRed = amnesKlassif.filter(item => 
        item.klassif.nivaStatus === 'red' || item.klassif.trendStatus === 'ner'
      );
      
      if (amnesRed.length >= 2) {
        meningar.push(`Brett tapp över flera kärnämnen (${amnesRed.map(i => i.label).join(', ')}) – detta är en systemisk utmaning som kräver skolövergripande åtgärder.`);
      } else if (amnesRed.length === 1) {
        meningar.push(`Helhetsmåttet pressas främst av ${amnesRed[0].label} – en ämnesspecifik flaskhals som behöver riktade insatser.`);
      }
      
      // Koppla till trygghet/studiero
      if (studiero?.latest != null) {
        const studKlassif = klassificeraKPI(studiero, groupAvgs['N15603']);
        if (studKlassif.nivaStatus === 'red' || studKlassif.trendStatus === 'ner') {
          meningar.push(`Låg studiero (${studiero.latest.toFixed(0)}%) är en förklaring – förbättrad arbetsro och klassrumsledarskap är avgörande hävstångar.`);
        }
      }
      
      if (trygghet?.latest != null && (!studiero?.latest || studiero.latest >= 75)) {
        const tryggKlassif = klassificeraKPI(trygghet, groupAvgs['N15613']);
        if (tryggKlassif.nivaStatus === 'red' || tryggKlassif.trendStatus === 'ner') {
          meningar.push(`Låg trygghet (${trygghet.latest.toFixed(0)}%) påverkar lärmiljön – klimat- och relationsarbete behöver prioriteras.`);
        }
      }
      
    } else if (allaF6Klassif.nivaStatus === 'green' && (allaF6Klassif.trendStatus === 'upp' || allaF6Klassif.trendStatus === 'stabil')) {
      if (allaF6Klassif.trendStatus === 'upp') {
        meningar.push(`Den samlade måluppfyllelsen i årskurs 6 är god och förbättras över tid.`);
      } else {
        meningar.push(`Den samlade måluppfyllelsen i årskurs 6 är god och stabil.`);
      }
    }
    
    // Progressionssignal med betygspoäng
    if ((allaF6Klassif.trendStatus === 'stabil' || allaF6Klassif.trendStatus === 'upp') && 
        (matPoangF6?.latest != null || svePoangF6?.latest != null)) {
      const matPoangKlassif = klassificeraKPI(matPoangF6, groupAvgs['N15509']);
      const svePoangKlassif = klassificeraKPI(svePoangF6, groupAvgs['N15510']);
      
      if (matPoangKlassif.trendStatus === 'ner' || svePoangKlassif.trendStatus === 'ner') {
        meningar.push(`Fler elever klarar E-nivån, men färre når högre betyg – fokus behöver läggas på progression mot C och A.`);
      }
    }
  } else {
    // Fallback: ämnesbaserad analys om N15539 saknas
    const f6Klassif = [
      { kpi: sveF6, label: 'svenska', id: 'N15488' },
      { kpi: matF6, label: 'matematik', id: 'N15485' },
      { kpi: engF6, label: 'engelska', id: 'N15482' }
    ].map(item => ({
      ...item,
      klassif: klassificeraKPI(item.kpi, groupAvgs[item.id])
    })).filter(item => item.kpi?.latest != null);
    
    const f6Red = f6Klassif.filter(item => item.klassif.nivaStatus === 'red');
    const f6Green = f6Klassif.filter(item => item.klassif.nivaStatus === 'green');
    
    if (f6Red.length >= 2) {
      meningar.push(`I årskurs 6 ligger flera kärnämnen (${f6Red.map(i => i.label).join(', ')}) under gruppsnitt, vilket kräver fokuserade stödinsatser.`);
    } else if (f6Green.length >= 2) {
      meningar.push(`Årskurs 6 visar starka resultat i ${f6Green.map(i => i.label).join(' och ')} jämfört med liknande skolor.`);
    } else if (f6Red.length === 1) {
      meningar.push(`I årskurs 6 behöver ${f6Red[0].label} särskild uppmärksamhet då resultaten ligger under gruppsnitt.`);
    }
  }
  
  return meningar;
}

function genereraNarrativText(kpiData, groupAvgs = {}) {
  const meningar = [];
  
  // 1. Förutsättningar (elevantal, elever per lärare, behörighet)
  const elevantal = kpiData['N15807'];
  const eleverPerLarare = kpiData['N15034'];
  const behorighetLarare = kpiData['N15813'];
  
  if (elevantal?.latest && elevantal.latest < 50) {
    meningar.push(`Skolan har en liten elevkull (${Math.round(elevantal.latest)} elever), vilket kan ge varierande resultat mellan år.`);
  } else if (eleverPerLarare?.latest && eleverPerLarare.latest > 15) {
    meningar.push(`Med ${eleverPerLarare.latest.toFixed(1)} elever per lärare finns ett resurstryck som kan påverka undervisningskvaliteten.`);
  } else if (behorighetLarare?.latest && behorighetLarare.latest < 70) {
    meningar.push(`Andelen behöriga lärare (${behorighetLarare.latest.toFixed(0)}%) ligger under rekommenderat läge, vilket kräver kompetensförsörjning.`);
  }
  
  // 2. Resultat F-6 (använder N15539 som huvudsignal)
  meningar.push(...analyseraF6Resultat(kpiData, groupAvgs));
  
  // 3. Resultat åk 7-9 (betyg alla ämnen, meritvärde)
  const allaAmnen = kpiData['N15419'];
  const meritvarde = kpiData['N15505'];
  
  if (allaAmnen?.latest != null && meritvarde?.latest != null) {
    const allaKlassif = klassificeraKPI(allaAmnen, groupAvgs['N15419']);
    const meritKlassif = klassificeraKPI(meritvarde, groupAvgs['N15505']);
    
    if (allaKlassif.trendStatus === 'ner' || meritKlassif.trendStatus === 'ner') {
      meningar.push(`Årskurs 9 visar en nedåtgående trend i slutbetyg, vilket signalerar behov av förstärkta insatser under högstadiet.`);
    } else if (allaKlassif.nivaStatus === 'green' && meritKlassif.nivaStatus === 'green') {
      meningar.push(`Årskurs 9 presterar över gruppsnitt både i andel godkända och meritvärde.`);
    } else if (allaKlassif.nivaStatus === 'red' || meritKlassif.nivaStatus === 'red') {
      meningar.push(`Resultaten i årskurs 9 ligger under gruppsnitt, med behov av stärkt kärnämnesdidaktik.`);
    }
  }
  
  // 4. SALSA (resultat givet förutsättningar)
  const salsaKPIs = SALSA_KPIS.map(def => ({
    id: def.id,
    data: kpiData[def.id],
    klassif: klassificeraKPI(kpiData[def.id], groupAvgs[def.id])
  })).filter(item => item.data?.latest != null);
  
  const salsaNegative = salsaKPIs.filter(item => item.klassif.diff < -2);
  const salsaPositive = salsaKPIS.filter(item => item.klassif.diff > 2);
  
  if (salsaNegative.length >= 2) {
    meningar.push(`SALSA visar att skolan presterar under förväntan givet elevförutsättningarna, vilket indikerar outnyttjad potential i undervisningsstrukturen.`);
  } else if (salsaPositive.length >= 2) {
    meningar.push(`SALSA visar att skolan presterar över förväntan, vilket tyder på effektiva undervisningsmetoder.`);
  }
  
  // 5. Trygghet/studiero
  const trygghet = kpiData['N15613'];
  const studiero = kpiData['N15603'];
  
  if (studiero?.latest && studiero.latest < 75) {
    meningar.push(`Studieron i årskurs 5 (${studiero.latest.toFixed(0)}%) kräver förstärkta strukturer för arbetsro.`);
  } else if (trygghet?.latest && trygghet.latest < 75) {
    meningar.push(`Tryggheten i årskurs 5 (${trygghet.latest.toFixed(0)}%) behöver förbättras för att säkra elevernas lärmiljö.`);
  } else if (studiero?.latest && studiero.latest >= 85 && trygghet?.latest && trygghet.latest >= 85) {
    meningar.push(`Skolan har goda förutsättningar med hög trygghet och studiero i årskurs 5.`);
  }
  
  // 6. Prioritering (avslutande mening)
  const insikter = genereraInsikter(kpiData, groupAvgs);
  if (insikter.havstang.includes('studiero')) {
    meningar.push(`Rekommendationen är att prioritera studiero och tydliga strukturer som grund för fortsatt förbättring.`);
  } else if (insikter.havstang.includes('trygghet')) {
    meningar.push(`Skolan bör prioritera trygghetsskapande åtgärder för att stärka lärmiljön.`);
  } else if (insikter.havstang.includes('kärnämnen') || insikter.havstang.toLowerCase().includes('svensk') || insikter.havstang.toLowerCase().includes('matematik') || insikter.havstang.toLowerCase().includes('engelsk')) {
    meningar.push(`Fokus bör ligga på att stärka undervisningen i kärnämnen med formativ bedömning och tidiga stödinsatser.`);
  } else {
    meningar.push(`Fortsätt arbetet med nuvarande prioriteringar och följ utvecklingen över tid.`);
  }
  
  // Begränsa till 3-6 meningar
  const begransadeMeningar = meningar.slice(0, 6);
  if (begransadeMeningar.length < 3) {
    begransadeMeningar.push('Databilden är begränsad, komplettera med kvalitativ analys.');
  }
  
  return begransadeMeningar.join(' ');
}

function beraknaTrendtext(unit, values) {
  const serie = (values || []).filter(v => v != null);
  if (serie.length === 0) return { dir: 'stable', arrow: '→', text: 'Ingen data', analysis: 'Data saknas.', latest: null, diff1: null, diff3: null };
  const latest = serie[serie.length - 1];
  const prev = serie[serie.length - 2] ?? null;
  const idxMinus3 = serie.length - 4; const prev3 = idxMinus3 >= 0 ? serie[idxMinus3] : null;
  const unitSuffix = unit === '%' ? 'procentenheter' : unit || '';
  let dir = 'stable', arrow = '→', text = 'Stabil';
  let diff1 = null, diff3 = null;
  
  // Bestäm riktning baserat på längsta tillgängliga trend
  if (prev3 !== null) {
    diff3 = latest - prev3;
    if (diff3 > 0.5) { dir = 'improving'; arrow = '↗'; }
    else if (diff3 < -0.5) { dir = 'declining'; arrow = '↘'; }
    const sign = diff3 > 0 ? '+' : '';
    text = `${sign}${diff3.toFixed(1)} ${unitSuffix} på 3 år`;
  } else if (prev !== null) {
    diff1 = latest - prev;
    if (diff1 > 0.05) { dir = 'improving'; arrow = '↗'; }
    else if (diff1 < -0.05) { dir = 'declining'; arrow = '↘'; }
    const sign = diff1 > 0 ? '+' : '';
    text = `${sign}${diff1.toFixed(1)} ${unitSuffix} på 1 år`;
  } else {
    text = 'Ingen trenddata';
  }
  
  const analysis = dir === 'improving' ? 'Förbättring över tid.' : dir === 'declining' ? 'Försämring över tid.' : 'Stabil nivå.';
  return { dir, arrow, text, analysis, latest, diff1, diff3 };
}

/**
 * Hämtar KPI-kortdata med strukturerade jämförelser från Kolada API v3
 * @param {string} ouId - Skolenhetens ID
 * @param {object} def - KPI-definition
 * @param {string} municipalityCode - Kommunkod för jämförelser (default '0684' Sävsjö)
 * @returns {Promise<Object>} - KPI-kortdata med comparisonData
 */
async function hamtaKpiCardData(ouId, def, municipalityCode = '0684') {
  const cacheKey = `${ouId}:${def.id}`;
  if (kpiCache.has(cacheKey)) return kpiCache.get(cacheKey);

  const fetchPromise = (async () => {
    try {
      // Hämta basdata
      const data = await hamtaKoladaData(ouId, def.id, SKOLENHET_DATA_BASE);
      const hasAny = (data?.totalt || []).some(v => v != null);
      
      if (!hasAny) {
        return { 
          id: def.id,
          label: def.label, 
          value: '—', 
          unit: def.unit, 
          scaleDependent: def.scaleDependent || false,
          trendDirection: 'stable', 
          trendArrow: '→', 
          trendText: 'Ingen data', 
          analysis: 'Data saknas för denna indikator.', 
          trendData: { dir: null, latest: null, diff1: null, diff3: null },
          comparisonData: null
        };
      }
      
      const trend = beraknaTrendtext(def.unit, data.totalt);
      
      // Hämta jämförelsedata från comparison system
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
        id: def.id,
        label: def.label, 
        value: trend.latest != null ? (def.unit === '%' ? Number(trend.latest).toFixed(1) : trend.latest) : '—', 
        unit: def.unit, 
        scaleDependent: def.scaleDependent || false,
        trendDirection: trend.dir, 
        trendArrow: trend.arrow, 
        trendText: trend.text, 
        analysis: trend.analysis, 
        trendData: { dir: trend.dir, latest: trend.latest, diff1: trend.diff1, diff3: trend.diff3 },
        comparisonData: comparisonData
      };
    } catch (error) {
      console.error('Kunde inte hämta KPI', def.id, error);
      return { 
        id: def.id,
        label: def.label, 
        value: '—', 
        unit: def.unit, 
        scaleDependent: def.scaleDependent || false,
        trendDirection: 'stable', 
        trendArrow: '→', 
        trendText: 'Fel vid hämtning', 
        analysis: 'Kunde inte ladda data just nu.', 
        trendData: { dir: null, latest: null, diff1: null, diff3: null },
        comparisonData: null
      };
    }
  })();

  kpiCache.set(cacheKey, fetchPromise);
  return fetchPromise;
}

function genereraAutomatiskAnalys(kpiData) {
  const insights = [];
  const { elevantal, eleverPerLarare, behorighetLarare, allaAmnen, yrkesprog, meritvarde, trygghet, studiero, matHogreNP, matLagreNP, engHogreNP, engLagreNP, sveHogreNP, sveLagreNP, engelska, matematik, svenska } = {
    elevantal: kpiData['N15807'],
    eleverPerLarare: kpiData['N15034'],
    behorighetLarare: kpiData['N15813'],
    allaAmnen: kpiData['N15419'],
    yrkesprog: kpiData['N15436'],
    meritvarde: kpiData['N15505'],
    trygghet: kpiData['N15613'],
    studiero: kpiData['N15603'],
    matHogreNP: kpiData['U15429'],
    matLagreNP: kpiData['U15430'],
    engHogreNP: kpiData['U15431'],
    engLagreNP: kpiData['U15432'],
    sveHogreNP: kpiData['U15433'],
    sveLagreNP: kpiData['U15434'],
    engelska: kpiData['N15482'],
    matematik: kpiData['N15485'],
    svenska: kpiData['N15488']
  };

  if (allaAmnen?.dir === 'declining' || meritvarde?.dir === 'declining') {
    insights.push('📉 <strong>Fallande resultat:</strong> Andelen elever med godkända betyg eller meritvärde sjunker. Prioritera tidiga stödinsatser och uppföljning av undervisningskvalitet.');
  }
  if (allaAmnen?.dir === 'improving' && meritvarde?.dir === 'improving') {
    insights.push('📈 <strong>Positiv trend:</strong> Både andel godkända och meritvärde stiger. Fortsätt arbetet med effektiva lärstrategier.');
  }
  if (yrkesprog?.latest && yrkesprog.latest < 80) {
    insights.push('🎯 <strong>Behörighet yrkesprogram:</strong> Andelen behöriga till yrkesprogram är under 80%. Säkerställ att eleverna får stöd i kärnämnena.');
  }
  if (eleverPerLarare?.latest && eleverPerLarare.latest > 15) {
    insights.push('👩‍🏫 <strong>Resurstryck:</strong> Hög elevtäthet per lärare kan påverka undervisningskvaliteten. Överväg resursförstärkning eller omfördelning.');
  }
  if (behorighetLarare?.latest && behorighetLarare.latest < 70) {
    insights.push('📚 <strong>Lärarbehörighet:</strong> Andelen behöriga lärare är under 70%. Prioritera kompetensförsörjning och rekrytering.');
  }
  if (trygghet?.latest && trygghet.latest < 80) {
    insights.push('🧭 <strong>Trygghet åk 5:</strong> Elevernas upplevda trygghet är låg. Öka trygghetsskapande åtgärder och elevinflytande.');
  }
  if (studiero?.latest && studiero.latest < 80) {
    insights.push('🧠 <strong>Studiero åk 5:</strong> Låg studiero signalerar behov av tydligare struktur och ordningsregler.');
  }
  if (engelska?.dir === 'declining' || matematik?.dir === 'declining' || svenska?.dir === 'declining') {
    insights.push('📚 <strong>Kärnämnen:</strong> Fallande trend i något av kärnämnena. Fokusera på formativ bedömning och stödinsatser.');
  }
  
  // NP-gap analys med systemisk vs ämnesspecifik klassificering
  const npAnalyser = [];
  if (matHogreNP && matLagreNP) {
    npAnalyser.push(analyseraNPGap(matHogreNP, matLagreNP, 'Matematik'));
  }
  if (engHogreNP && engLagreNP) {
    npAnalyser.push(analyseraNPGap(engHogreNP, engLagreNP, 'Engelska'));
  }
  if (sveHogreNP && sveLagreNP) {
    npAnalyser.push(analyseraNPGap(sveHogreNP, sveLagreNP, 'Svenska'));
  }
  
  // Räkna ämnen med hög risk i samma riktning
  const hogRiskInflation = npAnalyser.filter(a => a.riskNiva === 'hög risk' && a.badge === 'inflation');
  const hogRiskDeflation = npAnalyser.filter(a => a.riskNiva === 'hög risk' && a.badge === 'deflation');
  
  // Systemisk kalibreringsfråga om 2+ ämnen har hög risk samma riktning
  if (hogRiskInflation.length >= 2) {
    const amnen = hogRiskInflation.map((_, i) => ['Matematik', 'Engelska', 'Svenska'][i]).join(', ');
    insights.push(`🔍 <strong>Systemisk kalibreringsfråga - Inflation:</strong> Två eller fler ämnen visar systematiskt högre slutbetyg än NP. Prioritera <em>gemensamma bedömningssamtal, kalibrering mellan lärare och matchning mot proven</em>.`);
  } else if (hogRiskDeflation.length >= 2) {
    insights.push(`🔍 <strong>Systemisk kalibreringsfråga - Deflation:</strong> Två eller fler ämnen visar systematiskt lägre slutbetyg än NP. Undersök om eleverna får tillräckligt <em>bedömningsunderlag över tid, likvärdighet i bedömning och uthållig progression</em>.`);
  } else {
    // Ämnesspecifik kalibrering om endast 1 ämne sticker ut
    npAnalyser.forEach(analys => {
      if (analys.riskNiva === 'hög risk' || analys.riskNiva === 'uppmärksamhet') {
        insights.push(`⚖️ ${analys.analysText}`);
      }
    });
  }

  const harSaknad = Object.values(kpiData).some(k => k?.latest === null);
  if (harSaknad) {
    insights.push('<em>OBS: Vissa indikatorer saknar OU-data för denna enhet och ingår därför inte i bedömningen.</em>');
  }

  const elevantalValue = elevantal?.latest;
  if (elevantalValue && elevantalValue < 50) {
    insights.push('<em>Liten elevgrupp → resultat kan variera mycket mellan år.</em>');
  }

  return insights.length > 0 ? insights : ['Ingen automatisk analys kunde genereras baserat på tillgänglig data.'];
}

async function renderSection(sectionId, defs, ouId, kpiData, municipalityCode = '0684') {
  setLoading(sectionId, true);
  const sectionEl = document.getElementById(sectionId);
  const total = defs.length;
  let completed = 0;
  
  const cardPromises = defs.map(async (def) => {
    const card = await hamtaKpiCardData(ouId, def, municipalityCode);
    completed++;
    updateProgress(sectionId, completed, total);
    return { card, def };
  });
  
  const results = await Promise.all(cardPromises);
  
  // Bygg realAvgs från comparisonData (fallback till mock om data saknas)
  const realAvgs = {};
  const sourceAvgs = {};
  let sectionHasMock = false;
  const mockAvgs = {
    'N15807': 300, 'N15034': 13, 'N15813': 75, 'N15031': 90, 'N11805': 95,
    'N15482': 85, 'N15485': 80, 'N15488': 82, 'N15509': 65, 'N15510': 90,
    'N15539': 85, 'N15516': 80, 'N15523': 65,
    'N15418': 88, 'N15419': 88, 'N15436': 85, 'N15503': 220, 'N15504': 85, 'N15505': 220,
    'U15429': 10, 'U15430': 10, 'U15431': 10, 'U15432': 10,
    'U15433': 10, 'U15434': 10, 'U15413': 0, 'U15414': 0, 'U15415': 0, 'U15416': 0,
    'N15613': 82, 'N15603': 80, 'N15614': 85
  };
  
  results.forEach(({ card, def }) => {
    if (card.comparisonData && card.comparisonData.available) {
      const baseline = pickBaseline(def, card.comparisonData);
      if (baseline !== null) {
        realAvgs[def.id] = baseline;
        sourceAvgs[def.id] = card.comparisonData.rule_bucket;
      } else {
        realAvgs[def.id] = mockAvgs[def.id] || null;
        sourceAvgs[def.id] = 'mock';
        sectionHasMock = true;
      }
    } else {
      realAvgs[def.id] = mockAvgs[def.id] || null;
      sourceAvgs[def.id] = 'mock';
      sectionHasMock = true;
    }
  });
  
  // Sortera efter positiva värden först (högst diff mot realAvgs)
  results.sort((a, b) => {
    const groupAvgA = realAvgs[a.def.id] || null;
    const groupAvgB = realAvgs[b.def.id] || null;
    
    const klassifA = klassificeraKPI(a.card.trendData, groupAvgA);
    const klassifB = klassificeraKPI(b.card.trendData, groupAvgB);
    
    // Sortera fallande efter diff (högst först)
    return klassifB.diff - klassifA.diff;
  });
  
  sectionEl.innerHTML = '';
  const frag = document.createDocumentFragment();
  
  // Gruppera NP-gap KPIer för speciell rendering
  const npGapPairs = [];
  const npGapIds = new Set();
  const regularCards = [];
  
  // Identifiera NP-gap par
  const npPairs = [
    { hogre: 'U15429', lagre: 'U15430', amne: 'Matematik' },
    { hogre: 'U15431', lagre: 'U15432', amne: 'Engelska' },
    { hogre: 'U15433', lagre: 'U15434', amne: 'Svenska' }
  ];
  
  npPairs.forEach(pair => {
    const hogreCard = results.find(r => r.def.id === pair.hogre);
    const lagreCard = results.find(r => r.def.id === pair.lagre);
    
    if (hogreCard && lagreCard) {
      npGapPairs.push({ hogre: hogreCard.card, lagre: lagreCard.card, amne: pair.amne });
      npGapIds.add(pair.hogre);
      npGapIds.add(pair.lagre);
    }
  });
  
  // Separera reguljära kort från NP-gap kort
  results.forEach(({ card, def }) => {
    if (!npGapIds.has(def.id)) {
      regularCards.push({ card, def });
    }
  });
  
  // Rendera reguljära kort först
  regularCards.forEach(({ card, def }) => {
    frag.appendChild(createKPICard(card));
    // Spara både trendData OCH regel/unit för styrande analys
    kpiData[def.id] = {
      ...card.trendData,
      rule_bucket: card.comparisonData?.rule_bucket || null,
      unit: def.unit,
      scaleDependent: def.scaleDependent || false
    };
  });
  
  // Rendera NP-gap kort som kombinerade kort
  npGapPairs.forEach(({ hogre, lagre, amne }) => {
    frag.appendChild(createNPGapCard(hogre, lagre, amne));
    // Spara data för båda KPIerna
    kpiData[hogre.id] = { ...hogre.trendData, unit: '%' };
    kpiData[lagre.id] = { ...lagre.trendData, unit: '%' };
  });
  
  sectionEl.appendChild(frag);
  return { cards: results.map(r => r.card), realAvgs, sourceAvgs, sectionHasMock };
}

async function renderSections(ouId, municipalityCode = null) {
  const kpiData = {};
  
  // Hämta kommunkod från dropdown om inte angiven
  if (!municipalityCode) {
    const kommunSelect = document.getElementById('kommunSelect');
    municipalityCode = kommunSelect?.value || '0684';
  }
  
  // Rensa comparison cache när kommun/enhet ändras
  clearCache();
  
  // Hämta skoltyp för filtrering av resultatgrupper
  const schoolType = await detectSchoolType(ouId);
  
  // Hämta baseline, SALSA och trygghet med vanlig rendering
  const [baselineResult, salsaResult, tryggResult] = await Promise.all([
    renderSection('baselineKPIs', BASELINE_KPIS, ouId, kpiData, municipalityCode),
    renderSection('salsaKPIs', SALSA_KPIS, ouId, kpiData, municipalityCode),
    renderSection('trygghetsKPIs', TRYG_KPIS, ouId, kpiData, municipalityCode)
  ]);
  
  // Hämta outcome-kort manuellt för grupperad rendering
  setLoading('outcomeKPIs', true);
  const outcomeDefs = kpiDefsOutcome();
  console.log('DEBUG kpiDefsOutcome returned:', outcomeDefs.length, 'definitions');
  console.log('DEBUG KPI IDs:', outcomeDefs.map(d => d.id));
  
  const outcomeCardPromises = outcomeDefs.map(async (def) => {
    const card = await hamtaKpiCardData(ouId, def, municipalityCode);
    return { card, def };
  });
  const outcomeCards = await Promise.all(outcomeCardPromises);
  
  console.log('DEBUG outcomeCards loaded:', outcomeCards.length, 'cards');
  if (outcomeCards.length === 0) {
    console.error('No outcome cards loaded!');
  }
  
  // Bygg realAvgs för outcome KPIs
  const mockAvgs = {
    'N15807': 300, 'N15034': 13, 'N15813': 75, 'N15031': 90, 'N11805': 95,
    'N15482': 85, 'N15485': 80, 'N15488': 82, 'N15509': 65, 'N15510': 90,
    'N15539': 85, 'N15516': 80, 'N15523': 65,
    'N15418': 88, 'N15419': 88, 'N15436': 85, 'N15503': 220, 'N15504': 85, 'N15505': 220,
    'U15429': 10, 'U15430': 10, 'U15431': 10, 'U15432': 10,
    'U15433': 10, 'U15434': 10, 'U15413': 0, 'U15414': 0, 'U15415': 0, 'U15416': 0,
    'N15613': 82, 'N15603': 80, 'N15614': 85
  };
  
  const outcomeRealAvgs = {};
  let outcomeHasMock = false;
  
  outcomeCards.forEach(({ card, def }) => {
    if (card.comparisonData && card.comparisonData.available) {
      const baseline = pickBaseline(def, card.comparisonData);
      if (baseline !== null) {
        outcomeRealAvgs[def.id] = baseline;
      } else {
        outcomeRealAvgs[def.id] = mockAvgs[def.id] || null;
        outcomeHasMock = true;
      }
    } else {
      outcomeRealAvgs[def.id] = mockAvgs[def.id] || null;
      outcomeHasMock = true;
    }
  });
  
  // Slå ihop alla realAvgs från sektionerna
  const groupAvgs = {
    ...baselineResult.realAvgs,
    ...salsaResult.realAvgs,
    ...tryggResult.realAvgs,
    ...outcomeRealAvgs
  };
  
  console.log('DEBUG before renderGroupedOutcomeKPIs:', {
    outcomeCardsCount: outcomeCards.length,
    outcomeCardIds: outcomeCards.map(c => c.def.id),
    schoolType,
    groupAvgsKeys: Object.keys(groupAvgs)
  });
  
  // Rendera grupperade resultat-KPIer
  renderGroupedOutcomeKPIs('outcomeKPIs', outcomeCards, kpiData, groupAvgs, schoolType);
  // setLoading redan hanterad i renderGroupedOutcomeKPIs genom sectionEl.innerHTML = ''

  // Data-kvalitet: markera om ersättningsvärden (mock) användes i någon sektion
  const anyMockBaseline = (
    baselineResult.sectionHasMock ||
    salsaResult.sectionHasMock ||
    tryggResult.sectionHasMock ||
    outcomeHasMock
  );

  // === GENERERA OCH VISA STYRANDE ANALYS ===
  const styrandeAnalysContainer = document.getElementById('styrandeAnalys');
  
  // 1. Beräkna sektionsstatus (trafikljus)
  const baselineStatus = beraknaSektionStatus(BASELINE_KPIS, kpiData, groupAvgs);
  const outcomeStatus = beraknaSektionStatus(kpiDefsOutcome(), kpiData, groupAvgs);
  const salsaStatus = beraknaSektionStatus(SALSA_KPIS, kpiData, groupAvgs);
  const tryggStatus = beraknaSektionStatus(TRYG_KPIS, kpiData, groupAvgs);
  
  const sektionStatusGrid = document.getElementById('sektionStatusGrid');
  const baselineBaseNote = baselineResult.sectionHasMock
    ? 'Jämfört med: Liknande skolor (F-9) + ersättningsvärde för saknade'
    : 'Jämfört med: Liknande skolor (F-9)';
  const outcomeBaseNote = outcomeHasMock
    ? 'Jämfört med: Liknande skolor (F-9) + ersättningsvärde för saknade'
    : 'Jämfört med: Liknande skolor (F-9)';
  const salsaBaseNote = salsaResult.sectionHasMock
    ? 'Resultat i relation till förutsättningar + ersättningsvärde för saknade'
    : 'Resultat i relation till förutsättningar';
  const tryggBaseNote = tryggResult.sectionHasMock
    ? 'Jämfört med: Liknande skolor (F-9) + ersättningsvärde för saknade'
    : 'Jämfört med: Liknande skolor (F-9)';

  sektionStatusGrid.innerHTML = `
    <div class="sektion-status-card ${baselineStatus.status}">
      <div class="status-icon">${baselineStatus.icon}</div>
      <h4>Förutsättningar</h4>
      <div class="status-word">${baselineStatus.statusWord}</div>
      <div class="status-summary">${baselineStatus.summary}</div>
      <div class="status-trend">${baselineStatus.trendIcon} ${baselineStatus.trendText} senaste året</div>
      <div class="status-explanation">${baselineStatus.statusExplanation}</div>
      <div class="comparison-base">${baselineBaseNote}</div>
    </div>
    <div class="sektion-status-card ${outcomeStatus.status}">
      <div class="status-icon">${outcomeStatus.icon}</div>
      <h4>Resultat</h4>
      <div class="status-word">${outcomeStatus.statusWord}</div>
      <div class="status-summary">${outcomeStatus.summary}</div>
      <div class="status-trend">${outcomeStatus.trendIcon} ${outcomeStatus.trendText} senaste året</div>
      <div class="status-explanation">${outcomeStatus.statusExplanation}</div>
      <div class="comparison-base">${outcomeBaseNote}</div>
    </div>
    <div class="sektion-status-card ${salsaStatus.status}">
      <div class="status-icon">${salsaStatus.icon}</div>
      <h4>Värdeskapande</h4>
      <div class="status-word">${salsaStatus.statusWord}</div>
      <div class="status-summary">${salsaStatus.summary}</div>
      <div class="status-trend">${salsaStatus.trendIcon} ${salsaStatus.trendText} senaste året</div>
      <div class="status-explanation">${salsaStatus.statusExplanation}</div>
      <div class="comparison-base">${salsaBaseNote}</div>
    </div>
    <div class="sektion-status-card ${tryggStatus.status}">
      <div class="status-icon">${tryggStatus.icon}</div>
      <h4>Trygghet & Studiero</h4>
      <div class="status-word">${tryggStatus.statusWord}</div>
      <div class="status-summary">${tryggStatus.summary}</div>
      <div class="status-trend">${tryggStatus.trendIcon} ${tryggStatus.trendText} senaste året</div>
      <div class="status-explanation">${tryggStatus.statusExplanation}</div>
      <div class="comparison-base">${tryggBaseNote}</div>
    </div>
  `;

  // Visa datakvalitetsnotis över styrande analys vid mock-fallback
  let dqNotice = document.getElementById('dataQualityNotice');
  if (!dqNotice) {
    dqNotice = document.createElement('div');
    dqNotice.id = 'dataQualityNotice';
    dqNotice.className = 'data-quality-notice';
    // Prepend så den syns överst
    styrandeAnalysContainer.prepend(dqNotice);
  }
  if (anyMockBaseline) {
    dqNotice.textContent = 'Begränsad jämförelsedata: Vissa baslinjer kunde inte hämtas live. Ersättningsvärden används — tolka analys med försiktighet.';
    dqNotice.style.display = 'block';
  } else {
    dqNotice.style.display = 'none';
  }
  
  // 2. Generera insikter (Styrka/Risk/Hävstång)
  const insikter = genereraInsikter(kpiData, groupAvgs);
  const insiktGrid = document.getElementById('insiktGrid');
  insiktGrid.innerHTML = `
    <div class="insikt-card styrka">
      <h4>💪 Styrka</h4>
      <div class="insikt-label">VAD:</div>
      <p>${insikter.styrka}</p>
      <div class="insikt-label">KONSEKVENS:</div>
      <p class="insikt-consequence">Detta ger stabilitet och goda förutsättningar för fortsatt utveckling.</p>
      <div class="insikt-label">REKOMMENDATION:</div>
      <p class="insikt-action">Dokumentera och sprid framgångsfaktorer till andra delar av verksamheten.</p>
    </div>
    <div class="insikt-card risk">
      <h4>⚠️ Risk</h4>
      <div class="insikt-label">VAD:</div>
      <p>${insikter.risk}</p>
      <div class="insikt-label">KONSEKVENS:</div>
      <p class="insikt-consequence">Risk för försämrade resultat om inget görs. Eleverna påverkas direkt.</p>
      <div class="insikt-label">REKOMMENDATION:</div>
      <p class="insikt-action">Prioritera detta i nästa arbetsplansperiod. Avsätt tid och resurser.</p>
    </div>
    <div class="insikt-card havstang">
      <h4>🎯 Åtgärd nu</h4>
      <div class="insikt-label">VAD:</div>
      <p>${insikter.havstang}</p>
      <div class="insikt-label">KONSEKVENS:</div>
      <p class="insikt-consequence">Detta är den mest effektiva vägen till förbättring baserat på data.</p>
      <div class="insikt-label">REKOMMENDATION:</div>
      <p class="insikt-action">Starta arbete omgående. Följ upp efter 3 månader.</p>
    </div>
  `;
  
  // 3. Generera narrativ text som punktlista
  const narrativText = genereraNarrativText(kpiData, groupAvgs);
  const narrativEl = document.getElementById('narrativText');
  
  // Konvertera till strukturerad punktlista
  const meningar = narrativText.split('. ').filter(m => m.length > 10);
  const struktureradSammanfattning = `
    <h4>Sammanfattning – Vad du behöver veta</h4>
    <ul class="narrative-bullets">
      <li><strong>📊 Nuläge:</strong> ${meningar[0] || 'Data analyseras...'}.</li>
      <li><strong>⚡ Konsekvens:</strong> ${meningar[1] || 'Följ utvecklingen noga'}.</li>
      <li><strong>✅ Positivt:</strong> ${meningar.find(m => m.includes('god') || m.includes('starka') || m.includes('över')) || 'Fortsätt nuvarande arbetssätt'}.</li>
      <li><strong>🎯 Fokus framåt:</strong> ${meningar[meningar.length - 1] || 'Prioritera enligt rekommendationerna ovan'}.</li>
    </ul>
  `;
  narrativEl.innerHTML = struktureradSammanfattning;
  
  // Visa analysen
  styrandeAnalysContainer.style.display = 'block';
  
  // === GAMMAL AUTOMATISK ANALYS (behålls längst ner) ===
  const insights = genereraAutomatiskAnalys(kpiData);
  const analysisEl = document.getElementById('analysisText');
  analysisEl.innerHTML = '<h4>Automatisk analys</h4>' + insights.map(i => `<p>${i}</p>`).join('');
}

function initKommuner(selectEl, defaultId = '0684') {
  selectEl.innerHTML = '';
  ALLA_KOMMUNER.forEach(k => {
    const opt = document.createElement('option');
    opt.value = k.id;
    opt.textContent = k.title;
    if (k.id === defaultId) opt.selected = true;
    selectEl.appendChild(opt);
  });
}

async function onKommunChange(kommunSelect, skolenhetSelect) {
  skolenhetSelect.disabled = true;
  skolenhetSelect.innerHTML = '<option>Hämtar skolenheter...</option>';
  const enheter = await hamtaSkolenheterForKommun(kommunSelect.value);
  skolenhetSelect.innerHTML = '';
  const def = document.createElement('option');
  def.value='';
  def.textContent='Välj skolenhet';
  skolenhetSelect.appendChild(def);
  enheter.forEach(e => {
    const o=document.createElement('option');
    o.value=e.id; o.textContent=e.title; skolenhetSelect.appendChild(o);
  });
  skolenhetSelect.disabled = false;
  ['baselineKPIs','outcomeKPIs','salsaKPIs','trygghetsKPIs'].forEach(id => document.getElementById(id).innerHTML='');
}

function initFilterButtons(filterF6Btn, filter79Btn, skolenhetSelect) {
  filterF6Btn.addEventListener('click', () => {
    filterState.hideF6 = !filterState.hideF6;
    filterF6Btn.classList.toggle('active', filterState.hideF6);
    const ouId = skolenhetSelect.value;
    if (ouId) renderSections(ouId);
  });

  filter79Btn.addEventListener('click', () => {
    filterState.hide79 = !filterState.hide79;
    filter79Btn.classList.toggle('active', filterState.hide79);
    const ouId = skolenhetSelect.value;
    if (ouId) renderSections(ouId);
  });
}

function initDashboard() {
  const kommunSelect = document.getElementById('kommunSelect');
  const skolenhetSelect = document.getElementById('skolenhetSelect');
  const filterF6Btn = document.getElementById('filterF6');
  const filter79Btn = document.getElementById('filter79');

  initKommuner(kommunSelect);
  initFilterButtons(filterF6Btn, filter79Btn, skolenhetSelect);

  kommunSelect.addEventListener('change', () => onKommunChange(kommunSelect, skolenhetSelect));
  skolenhetSelect.addEventListener('change', () => {
    const ouId = skolenhetSelect.value;
    if (!ouId) return;
    renderSections(ouId);
  });

  onKommunChange(kommunSelect, skolenhetSelect);
}

window.addEventListener('DOMContentLoaded', initDashboard);
