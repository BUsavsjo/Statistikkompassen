import { ALLA_KOMMUNER } from '../kommuner.js';
import { SKOLENHET_SEARCH_API, SKOLENHET_DATA_BASE } from '../constants.js';
import { hamtaKoladaData } from '../chartHelpers.js';
import { createKPIComparison, formatComparisonText, getComparisonRule, clearCache, detectSchoolType } from './comparisons.js';

// ===== CONFIGURATION & CONSTANTS =====

// Thresholds for analysis and classification
const THRESHOLDS = {
  LEVEL: { GREEN: 2, RED: -2 },
  TREND: { UP: 3, DOWN: -3 },
  STUDENTS_PER_TEACHER: 15,
  TEACHER_QUALIFICATION: 70,
  SAFETY: 80,
  SMALL_COHORT: 50,
  NP_GAP: { CALIBRATED: 5, WATCH: 5, ATTENTION: 10, HIGH_RISK: 15, TREND: 3 }
};

// Mock averages for fallback when real data is unavailable
const MOCK_AVERAGES = {
  'N15807': 300, 'N15034': 13, 'N15813': 75, 'N15031': 90, 'N11805': 95,
  'N15482': 85, 'N15485': 80, 'N15488': 82, 'N15509': 65, 'N15510': 90,
  'N15539': 85, 'N15516': 80, 'N15523': 65,
  'N15418': 88, 'N15419': 88, 'N15436': 85, 'N15503': 220, 'N15504': 85, 'N15505': 220,
  'U15429': 10, 'U15430': 10, 'U15431': 10, 'U15432': 10,
  'U15433': 10, 'U15434': 10, 'U15413': 0, 'U15414': 0, 'U15415': 0, 'U15416': 0,
  'N15613': 82, 'N15603': 80, 'N15602': 78, 'N15614': 85
};

// NP-gap subject configurations
const NP_GAP_SUBJECTS = [
  { hogre: 'U15429', lagre: 'U15430', amne: 'Matematik' },
  { hogre: 'U15431', lagre: 'U15432', amne: 'Engelska' },
  { hogre: 'U15433', lagre: 'U15434', amne: 'Svenska' }
];

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
  { id: 'N15504', label: 'Åk 9: Meritvärde i kommun', unit: 'poäng', stage: '79' },
  // Åk 9 kärnämnen (gamla KPIer behålls för bakåtkompatibilitet)
  { id: 'N15419', label: 'Åk 9: Alla ämnen godkända', unit: '%', stage: '79' },
  { id: 'N15436', label: 'Åk 9: Behöriga till yrkesprogram (kommun)', unit: '%', stage: '79' },
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

// Ämnessektioner: filtrera ut KPIer per ämne för separata sektioner
const SVENSKA_KPIS = OUTCOME_KPIS.filter(def => ['N15488','N15510','N15516','U15433','U15434'].includes(def.id));
const MATEMATIK_KPIS = OUTCOME_KPIS.filter(def => ['N15485','N15509','N15523','U15429','U15430'].includes(def.id));
const ENGELSKA_KPIS = OUTCOME_KPIS.filter(def => ['N15482','U15431','U15432'].includes(def.id));

// Resultatsammanfattning: KPIer som ska ligga kvar under "Resultat"
const OUTCOME_SUMMARY_KPIS = OUTCOME_KPIS.filter(def => ['N15539','N15418','N15419','N15436','N15505'].includes(def.id));

const SALSA_KPIS = [
  { id: 'U15413', label: 'Åk 9: SALSA-modell förväntat (alla ämnen)', unit: '%' },
  { id: 'U15414', label: 'Åk 9: Avvikelse faktisk vs SALSA-modell (%)', unit: 'procentenheter' },
  { id: 'U15415', label: 'Åk 9: SALSA-modell förväntat meritvärde', unit: 'poäng' },
  { id: 'U15416', label: 'Åk 9: Avvikelse faktisk vs SALSA-modell (meritvärde)', unit: 'poäng' }
];

const TRYG_KPIS = [
  { id: 'N15613', label: 'Åk 5: Trygghet', unit: '%' },
  { id: 'N15603', label: 'Åk 5: Studiero', unit: '%' },
  { id: 'N15602', label: 'Åk 5: Stimulans', unit: '%', description: 'Elever i åk 5 upplever att lärarna gör skolarbetet intressant' },
  { id: 'N15614', label: 'Åk 5: Vuxnas agerande mot kränkningar', unit: '%' }
];

const filterState = { hideF6: false, hide79: false };
const skolenhetCache = new Map();
const kpiCache = new Map();

// Global loading state
let totalKPIs = 0;
let loadedKPIs = 0;

// KPI-metadata: riktning för bättre/sämre
const KPI_DIRECTION = {
  // Lägre är bättre: Elever per lärare
  'N15034': 'lower-better',
  // SALSA-avvikelser: högre positiv avvikelse är bättre
  'U15414': 'higher-better',
  'U15416': 'higher-better'
};

function getDirectionForKPI(id) {
  return KPI_DIRECTION[id] || 'higher-better';
}

// KPI-specifika diffetiketter
const DIFF_LABEL_OVERRIDES = {
  'N15034': 'elever/lärare'
};

function formatDiffById(diff, unit, kpiId) {
  const UNIT_LABELS = {
    '%': 'procentenheter',
    'st': 'elever',
    'poäng': 'poäng'
  };
  const labelOverride = DIFF_LABEL_OVERRIDES[kpiId];
  const label = labelOverride || UNIT_LABELS[unit] || unit || '';
  const sign = diff >= 0 ? '+' : '';
  const value = diff.toFixed(1);
  return `${sign}${value} ${label}`.trim();
}

/**
 * Uppdaterar global loading bar
 * @param {number} current - Nuvarande antal laddade KPIer
 * @param {number} total - Totalt antal KPIer att ladda
 */
function updateGlobalProgress(current, total) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  const progressBar = document.getElementById('globalProgressBar');
  const progressText = document.getElementById('globalProgressText');
  
  if (progressBar) progressBar.style.width = `${percent}%`;
  if (progressText) progressText.textContent = `${percent}%`;
}

/**
 * Visar global loading screen
 */
function showGlobalLoading() {
  const loadingScreen = document.getElementById('globalLoadingScreen');
  if (loadingScreen) {
    loadingScreen.style.display = 'flex';
    loadingScreen.classList.remove('hidden');
  }
}

/**
 * Döljer global loading screen
 */
function hideGlobalLoading() {
  const loadingScreen = document.getElementById('globalLoadingScreen');
  if (loadingScreen) {
    loadingScreen.classList.add('hidden');
    setTimeout(() => {
      loadingScreen.style.display = 'none';
    }, 500);
  }
}

/**
 * Selects the appropriate baseline for a KPI based on comparison rules
 * UPDATED: Prioritizes municipality average within same school type
 * @param {object} def - KPI definition
 * @param {object} comp - Comparison data from createKPIComparison
 * @returns {number|null} Selected baseline value
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
 * Formats a difference value with appropriate unit
 * @param {number} diff - Difference value
 * @param {string} unit - Unit (%, st, poäng)
 * @returns {string} Formatted difference with correct unit
 */
function formatDiff(diff, unit) {
  const UNIT_LABELS = {
    '%': 'procentenheter',
    'st': 'elever',
    'poäng': 'poäng'
  };
  
  const sign = diff >= 0 ? '+' : '';
  const value = diff.toFixed(1);
  const label = UNIT_LABELS[unit] || unit || '';
  
  return `${sign}${value} ${label}`.trim();
}

/**
 * Creates a KPI card with structured comparisons according to rules
 * @param {object} kpi - KPI data with value, trend, and optional comparisonData
 * @returns {HTMLElement} KPI card element
 */
function createKPICard(kpi) {
  const card = document.createElement('div');
  card.className = 'kpi-item';
  
  // KPIer som ska ha neutral färg (ingen automatisk grön/röd)
  const isNPGap = kpi.id && (kpi.id.startsWith('U1542') || kpi.id.startsWith('U1543'));
  const isBaselineCount = kpi.id && (kpi.id === 'N11805' || kpi.id === 'N15807'); // Elevantal
  const isSALSA = kpi.id && kpi.id.startsWith('U154') && ['U15413', 'U15414', 'U15415', 'U15416'].includes(kpi.id);
  const isSALSADeviationOnly = kpi.id === 'U15414' || kpi.id === 'U15416';
  const isStimulans = kpi.id && kpi.id === 'N15602'; // Stimulans - förklarare/klimatindikator
  
  // Kortfärg väger in nivå mot baseline + trend
  // SKIP för NP-gap, elevantal, SALSA och Stimulans
  let colorClass = '';
  if (!isNPGap && !isBaselineCount && !isSALSA && !isStimulans && kpi.trendData) {
    const baseline = kpi.comparisonData ? pickBaseline(null, kpi.comparisonData) : null;
    const klassif = klassificeraKPI(kpi.trendData, baseline, kpi.id);
    if (klassif.nivaStatus === 'red' || klassif.trendStatus === 'ner') {
      colorClass = 'status-red';
    } else if (klassif.nivaStatus === 'green' && (klassif.trendStatus === 'upp' || klassif.trendStatus === 'stabil')) {
      colorClass = 'status-green';
    } else {
      colorClass = 'status-lightgreen';
    }
  }
  
  if (colorClass) {
    card.classList.add(colorClass);
  }
  
  // Om det är ett NP-gap kort, använd neutral styling
  if (isNPGap) {
    card.classList.add('np-gap-individual');
  }
  
  // Om det är elevantal, SALSA eller Stimulans, använd neutral styling
  if (isBaselineCount || isSALSA || isStimulans) {
    card.classList.add('neutral-kpi');
  }

  const label = document.createElement('div');
  label.className = 'kpi-label';
  label.textContent = kpi.label;
  
  // Add KPI ID below label in small text
  const kpiId = document.createElement('div');
  kpiId.className = 'kpi-id';
  kpiId.textContent = `ID: ${kpi.id || ''}`;
  kpiId.style.fontSize = '0.75rem';
  kpiId.style.color = '#64748b';
  kpiId.style.marginTop = '2px';

  const value = document.createElement('div');
  value.className = 'kpi-value';
  
  // Visa huvudvärde
  const mainValue = `${kpi.value ?? '—'} ${kpi.unit || ''}`.trim();
  value.textContent = mainValue;

  // Jämförelsesektion (om comparisonData finns)
  const comparisonDiv = document.createElement('div');
  comparisonDiv.className = 'kpi-comparison';
  
  // För elevantal: visa bara kontext-badge, ingen jämförelse
  if (isBaselineCount) {
    const contextBadge = document.createElement('div');
    contextBadge.className = 'context-badge';
    contextBadge.innerHTML = '📌 Kontext/volym (ingen värdering)';
    contextBadge.style.cssText = 'display: inline-block; margin-top: 8px; padding: 4px 10px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 12px; font-size: 0.75rem; color: #64748b; font-weight: 500;';
    comparisonDiv.appendChild(contextBadge);
    
    // Visa endast trend om den finns
    if (kpi.trendData && kpi.trendData.diff3 !== null) {
      const trendInfo = document.createElement('div');
      trendInfo.style.cssText = 'margin-top: 6px; font-size: 0.85rem; color: #64748b;';
      // Neutral trendtext för kontextindikator
      trendInfo.textContent = `→ kontext (3 år)`;
      comparisonDiv.appendChild(trendInfo);
    }
  } else if (isSALSADeviationOnly) {
    // För SALSA U15414/U15416 – visa endast trendtext (ingen jämförelse)
    const trendText = kpi.trendText || (kpi.trendData?.diff3 != null
      ? `${kpi.trendData.diff3 >= 0 ? '↗' : kpi.trendData.diff3 < 0 ? '↘' : '→'} ${formatDiffById(Math.abs(kpi.trendData.diff3), kpi.unit, kpi.id)} (3 år)`
      : '→ stabilt (3 år)');
    comparisonDiv.textContent = trendText;
  } else {
  
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
        compLines.push(`Riket (referens) ${riketVal.toFixed(1)}${kpi.unit} (${formatDiffById(diff, kpi.unit, kpi.id)})`);
      }
    } else {
      // PRIMÄR JÄMFÖRELSE: Kommungenomsnitt inom samma skolform
      if (comp.deltas.main_vs_kommun_schooltype !== undefined) {
        const kommunVal = comp.values.kommun_schooltype[0];
        const diff = comp.deltas.main_vs_kommun_schooltype;
        const schoolTypeLabel = comp.schoolType ? ` (${comp.schoolType})` : '';
        compLines.push(`Kommun${schoolTypeLabel} ${kommunVal.toFixed(1)}${kpi.unit} (${formatDiffById(diff, kpi.unit, kpi.id)})`);
      }
      
      // SEKUNDÄR REFERENS: Riket (grå, endast visning)
      if (comp.deltas.main_vs_riket_reference !== undefined) {
        const riketVal = comp.values.riket_reference[comp.values.riket_reference.length - 1];
        const diff = comp.deltas.main_vs_riket_reference;
        compLines.push(`<span style="color: #94a3b8;">Riket (ref) ${riketVal.toFixed(1)}${kpi.unit} (${formatDiffById(diff, kpi.unit, kpi.id)})</span>`);
      }
    }
    
    // Lägg till trend med enhetsmedveten formatering
    if (comp.trend && comp.trend.direction !== 'flat') {
      const trendIcon = comp.trend.direction === 'up' ? '↗' : '↘';
      compLines.push(`${trendIcon} ${formatDiffById(comp.trend.change, kpi.unit, kpi.id)} (3 år)`);
    } else {
      compLines.push('→ stabilt (3 år)');
    }
    
    comparisonDiv.innerHTML = compLines.join(' | ');
  } else {
    // Fallback till gammal trendtext om ingen comparisonData
    comparisonDiv.textContent = kpi.trendText || 'Ingen jämförelsedata';
  }
  }

  const analysis = document.createElement('div');
  analysis.className = 'kpi-analysis';
  analysis.textContent = kpi.analysis || '';

  card.append(label, kpiId, value, comparisonDiv, analysis);
  return card;
}

function setLoading(sectionId, loading = true) {
  const el = document.getElementById(sectionId);
  if (!el) return;
  if (loading) {
    el.innerHTML = `<div class="loading-message">Laddar data...</div>`;
  } else {
    el.innerHTML = '';
  }
}

function updateProgress(sectionId, current, total) {
  const el = document.getElementById(sectionId);
  if (!el) return;
  // Progressindikatorer visas inte längre; placeholdern behålls tills sektionen är klar.
}

async function hamtaSkolenheterForKommun(kommunId) {
  if (skolenhetCache.has(kommunId)) return skolenhetCache.get(kommunId);

  const fetchPromise = (async () => {
    let url = `${SKOLENHET_SEARCH_API}?municipality=${kommunId}&per_page=500`;
    const enheter = [];
    
    // Filtrera baserat på OU-ID-prefix
    // V11E = Förskola, V15E = Grundskola, V17E = Gymnasieskola
    const allowedPrefixes = ['V11E', 'V15E', 'V17E'];
    
    while (url) {
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) break;
      const data = await response.json();
      const resultat = data.results || data.values || [];
      resultat.forEach(enhet => {
        const enhetId = enhet.id || '';
        const enhetType = (enhet.type || enhet.type_name || '').toLowerCase();
        
        // Filtrera: bara inkludera skolenheter baserat på ID-prefix
        if (allowedPrefixes.some(prefix => enhetId.startsWith(prefix))) {
          enheter.push({ id: enhet.id, title: enhet.title, type: enhetType });
        }
      });
      url = data.next_page || data.next || null;
    }
    enheter.sort((a, b) => a.title.localeCompare(b.title, 'sv'));
    return enheter;
  })();

  skolenhetCache.set(kommunId, fetchPromise);
  return fetchPromise;
}

function kpiDefsOutcome(kpiDataOpt = null) {
  // Använd endast sammanfattnings-KPIer i Resultat-sektionen
  // Preferera N15419; om den har data, uteslut N15418. Annars tvärtom.
  if (!kpiDataOpt) return OUTCOME_SUMMARY_KPIS;
  const hasN15419 = !!(kpiDataOpt['N15419'] && kpiDataOpt['N15419'].latest != null);
  const preferred = hasN15419 ? 'N15419' : 'N15418';
  const excluded = hasN15419 ? 'N15418' : 'N15419';
  return OUTCOME_SUMMARY_KPIS.filter(def => def.id !== excluded);
}

// ===== ANALYSMOTOR: Klassificering och beräkningar =====

/**
 * Analyzes NP-gap (final grades vs national tests)
 * @param {object} hogreData - KPI for higher final grades than NP
 * @param {object} lagreData - KPI for lower final grades than NP
 * @param {string} amne - Subject name (matematik/engelska/svenska)
 * @returns {object} NP-gap analysis with risk level, direction, badges
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
  
  // Base risk level based on absolute net gap
  const absGap = Math.abs(nettoGap);
  let riskNiva = 'kalibrerat';
  if (absGap >= THRESHOLDS.NP_GAP.HIGH_RISK) {
    riskNiva = 'hög risk';
  } else if (absGap >= THRESHOLDS.NP_GAP.ATTENTION) {
    riskNiva = 'uppmärksamhet';
  } else if (absGap >= THRESHOLDS.NP_GAP.WATCH) {
    riskNiva = 'bevaka';
  }
  
  // Adjust risk level based on trend
  if (Math.abs(nettoGapTrend3y) >= THRESHOLDS.NP_GAP.TREND) {
    if (nettoGapTrend3y >= 3) {
      // Gap ökar - höj risk
      if (riskNiva === 'kalibrerat') riskNiva = 'bevaka';
      else if (riskNiva === 'bevaka') riskNiva = 'uppmärksamhet';
      else if (riskNiva === 'uppmärksamhet') riskNiva = 'hög risk';
    } else if (nettoGapTrend3y <= -THRESHOLDS.NP_GAP.TREND) {
      // Gap minskar - sänk risk
      if (riskNiva === 'hög risk') riskNiva = 'uppmärksamhet';
      else if (riskNiva === 'uppmärksamhet') riskNiva = 'bevaka';
      else if (riskNiva === 'bevaka') riskNiva = 'kalibrerat';
    }
  }
  
  // Classify direction
  let riktning = 'Kalibrerat';
  let badge = 'neutral';
  if (nettoGap > THRESHOLDS.NP_GAP.CALIBRATED) {
    riktning = 'Lutar mot inflation';
    badge = 'inflation';
  } else if (nettoGap < -THRESHOLDS.NP_GAP.CALIBRATED) {
    riktning = 'Lutar mot deflation';
    badge = 'deflation';
  }
  
  // Trend text
  let trendText = 'Stabilt';
  if (nettoGapTrend3y >= THRESHOLDS.NP_GAP.TREND) {
    trendText = 'Gapet ökar';
  } else if (nettoGapTrend3y <= -THRESHOLDS.NP_GAP.TREND) {
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
  
  // Add KPI IDs for NP-gap
  const kpiId = document.createElement('div');
  kpiId.className = 'kpi-id';
  kpiId.textContent = `ID: ${hogreKPI.id || ''}, ${lagreKPI.id || ''}`;
  kpiId.style.fontSize = '0.75rem';
  kpiId.style.color = '#64748b';
  kpiId.style.marginTop = '2px';
  
  // Visa båda andelar + netto-gap
  const value = document.createElement('div');
  value.className = 'kpi-value np-gap-value';
  if (npAnalys.hogreAndel != null && npAnalys.lagreAndel != null) {
    value.innerHTML = `
      <div class="np-components">
        <span class="np-hogre">↑ ${npAnalys.hogreAndel.toFixed(1)}%</span>
        <span class="np-lagre">↓ ${npAnalys.lagreAndel.toFixed(1)}%</span>
      </div>
      <div class="np-netto">Netto: ${npAnalys.nettoGap > 0 ? '+' : ''}${npAnalys.nettoGap.toFixed(1)} procentenheter</div>
    `;
  } else {
    value.textContent = '— Saknar data';
  }

  // Tydliggörande rad(er) under pilarna
  const info = document.createElement('div');
  info.className = 'np-info';
  info.style.cssText = 'margin-top: 6px; font-size: 0.85rem; color: #64748b; line-height: 1.25;';
  if (npAnalys.hogreAndel != null && npAnalys.lagreAndel != null) {
    info.innerHTML = `
      Högre än NP (senaste år): ${npAnalys.hogreAndel.toFixed(1)}%<br/>
      Lägre än NP (senaste år): ${npAnalys.lagreAndel.toFixed(1)}%<br/>
      Trend netto-gap (3 år): ${npAnalys.trendText}
    `;
  } else {
    info.textContent = 'Nuläge senaste år. Trend avser förändring 3 år.';
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
  card.appendChild(kpiId);
  card.appendChild(value);
  card.appendChild(info);
  card.appendChild(badgesDiv);
  card.appendChild(analysis);
  
  return card;
}

/**
 * Classifies a KPI based on level and trend
 * @param {object} kpi - KPI data from hamtaKpiCardData
 * @param {number|null} groupAvg - Group average (from Kolada or mocked)
 * @returns {object} { nivaStatus, trendStatus, diff, trend3y }
 */
function klassificeraKPI(kpi, groupAvg = null, kpiId = null) {
  const current = kpi?.latest;
  const trend3y = kpi?.diff3;
  
  if (current == null) {
    return { nivaStatus: 'missing', trendStatus: 'missing', diff: 0, trend3y: 0 };
  }
  
  const rawDiff = groupAvg != null ? current - groupAvg : 0;
  const direction = kpiId ? getDirectionForKPI(kpiId) : 'higher-better';
  const diff = direction === 'lower-better' ? -rawDiff : rawDiff;
  
  // Classify level status
  let nivaStatus = 'yellow';
  if (diff >= THRESHOLDS.LEVEL.GREEN) nivaStatus = 'green';
  else if (diff <= THRESHOLDS.LEVEL.RED) nivaStatus = 'red';
  
  // Classify trend status
  let trendStatus = 'stabil';
  let effectiveTrend3y = trend3y || 0;
  if (trend3y != null) {
    effectiveTrend3y = direction === 'lower-better' ? -trend3y : trend3y;
    if (effectiveTrend3y >= THRESHOLDS.TREND.UP) trendStatus = 'upp';
    else if (effectiveTrend3y <= THRESHOLDS.TREND.DOWN) trendStatus = 'ner';
  }
  
  return { nivaStatus, trendStatus, diff, trend3y: effectiveTrend3y };
}

/**
 * Calculates section status (traffic light) for a group of KPIs
 * @param {Array} kpiList - List of KPI definitions
 * @param {object} kpiData - Object with KPI data { kpiId: trendData }
 * @param {object} groupAvgs - Group averages for each KPI { kpiId: avgValue }
 * @returns {object} { status: 'red'|'yellow'|'green', summary: 'text', ...details }
 */
function beraknaSektionStatus(kpiList, kpiData, groupAvgs = {}) {
  let greenCount = 0, yellowCount = 0, redCount = 0;
  let decliningCount = 0;
  
  kpiList.forEach(kpiDef => {
    const data = kpiData[kpiDef.id];
    if (!data || data.latest == null) return; // Skippa saknad data
    
    // Exkludera kontextindikatorer från trafikljus
    if (excludedFromTrafficLight.has(kpiDef.id)) return;
    
    const groupAvg = groupAvgs[kpiDef.id] || null;
    const klassif = klassificeraKPI(data, groupAvg, kpiDef.id);
    
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
 * KPI:er som ska uteslutas från risk/styrka-beräkning i nyckelinsikter
 * Dessa är förklarare/kontextindikatorer snarare än åtgärdsbara resultat
 */
const excludedRiskIds = new Set([
  // NP-gap (kalibreringssignal, inte resultatmått)
  'U15429', 'U15430', 'U15431', 'U15432', 'U15433', 'U15434',
  // SALSA-förväntansnivåer (modellberäknade värden)
  'U15413', 'U15415',
  // Elevantal/volym (strukturell faktor, inte resultat)
  'N11805', 'N15807'
]);

/**
 * KPI:er som ska uteslutas från trafikljusberäkning i sektionsstatus
 * Samma som excludedRiskIds - används i beraknaSektionStatus
 */
const excludedFromTrafficLight = new Set([
  'U15429', 'U15430', 'U15431', 'U15432', 'U15433', 'U15434',
  'U15413', 'U15415',
  'N11805', 'N15807'
]);

/**
 * Kontrollerar om ett KPI-ID ska uteslutas från risk/styrka-beräkning
 * @param {string} id - KPI-ID
 * @returns {boolean}
 */
function isExcludedFromRisk(id) {
  return excludedRiskIds.has(id);
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
    
    // Uteslut förklarare/kontextindikatorer från risk/styrka-beräkning (inkl elevantal)
    if (isExcludedFromRisk(kpiDef.id)) return;
    
    const groupAvg = groupAvgs[kpiDef.id] || null;
    const klassif = klassificeraKPI(data, groupAvg, kpiDef.id);
    
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
    styrka = `<strong>${bestKPI.label}</strong> ligger ${formatDiffById(bestKPI.diff, bestKPI.unit, bestKPI.id)} över gruppsnitt.`;
  } else if (bestTrendKPI.trend3y > 3) {
    styrka = `<strong>${bestTrendKPI.label}</strong> har förbättrats med ${formatDiffById(bestTrendKPI.trend3y, bestTrendKPI.unit, bestTrendKPI.id)} på 3 år.`;
  }
  
  // Risk: Den indikator med sämst diff eller trend (enhetsanpassad)
  let risk = 'Ingen tydlig risk identifierad.';
  if (worstKPI.diff < -2) {
    risk = `<strong>${worstKPI.label}</strong> ligger ${formatDiffById(Math.abs(worstKPI.diff), worstKPI.unit, worstKPI.id)} under gruppsnitt.`;
  } else if (worstTrendKPI.trend3y < -3) {
    risk = `<strong>${worstTrendKPI.label}</strong> har försämrats med ${formatDiffById(Math.abs(worstTrendKPI.trend3y), worstTrendKPI.unit, worstTrendKPI.id)} på 3 år.`;
  }
  
  // Hävstång: Smart rekommendation baserad på data
  let havstang = 'Fortsätt arbeta med nuvarande prioriteringar.';
  
  // Kontrollera studiero, trygghet och stimulans
  const studiero = kpiData['N15603'];
  const trygghet = kpiData['N15613'];
  const stimulans = kpiData['N15602'];
  const allaAmnenF6 = kpiData['N15539'];
  
  // Prioritet 1: Stimulans + studiero båda låga (systemiskt problem)
  if (studiero?.latest && studiero.latest < 80 && stimulans?.latest && stimulans.latest < 80) {
    havstang = 'Fokusera på <strong>tydligare lektionsstruktur och mer elevaktiva arbetssätt</strong> – både stimulans och studiero behöver förbättras.';
  }
  // Prioritet 2: Stimulans låg men trygghet/studiero ok (didaktiskt problem)
  else if (stimulans?.latest && stimulans.latest < 80 && 
           (!studiero?.latest || studiero.latest >= 80) && 
           (!trygghet?.latest || trygghet.latest >= 80)) {
    havstang = 'Miljön är trygg och lugn, men undervisningen upplevs inte engagerande. Fokusera på <strong>variation och utmanande uppgifter</strong>.';
  }
  // Prioritet 3: F-6 resultat dåliga + stimulans låg (motivation som nyckelfaktor)
  else if (allaAmnenF6?.latest && allaAmnenF6.latest < 75 && stimulans?.latest && stimulans.latest < 80) {
    havstang = 'Resultattapp sammanfaller med minskad stimulans. <strong>Motivation och undervisningsupplägg</strong> kan vara en nyckelfaktor.';
  }
  // Prioritet 4: Studiero låg (ursprunglig regel)
  else if (studiero?.latest && studiero.latest < 80) {
    havstang = 'Fokusera på <strong>studiero och tydliga strukturer</strong> – lågåterkommande grund för lärande.';
  }
  // Prioritet 5: Trygghet låg
  else if (trygghet?.latest && trygghet.latest < 80) {
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

  // Uppmärksamhet: indikatorer som är på väg åt fel håll men inte akut risk ännu
  const attentionCandidates = allKPIs
    .map(kpiDef => {
      // Exkludera kontext-/förklarande KPI:er från uppmärksamhetslistan
      if (isExcludedFromRisk(kpiDef.id)) return null;
      const data = kpiData[kpiDef.id];
      if (!data || data.latest == null) return null;

      const groupAvg = groupAvgs[kpiDef.id] || null;
      const klassif = klassificeraKPI(data, groupAvg, kpiDef.id);

      return {
        id: kpiDef.id,
        label: kpiDef.label,
        unit: data.unit || kpiDef.unit,
        klassif
      };
    })
    .filter(Boolean)
    .filter(item => item.klassif.nivaStatus === 'yellow' || item.klassif.trendStatus === 'ner')
    .sort((a, b) => a.klassif.trend3y - b.klassif.trend3y || a.klassif.diff - b.klassif.diff);

  let uppmarksamma = 'Följ utvecklingen – inga tydliga varningssignaler, men säkerställ fortsatt bevakning av nyckeltalen.';

  if (attentionCandidates.length > 0) {
    const candidate = attentionCandidates[0];
    const riktning = candidate.klassif.trendStatus === 'ner' ? 'försämras' : 'ligger nära snitt';
    const diffText = formatDiffById(Math.abs(candidate.klassif.diff), candidate.unit, candidate.id);

    uppmarksamma = `<strong>${candidate.label}</strong> ${riktning} (${diffText}). Följ utvecklingen och agera om trenden fortsätter.`;
  }

  return { styrka, risk, havstang, uppmarksamma };
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
    const klassif = klassificeraKPI(card.trendData, groupAvg, def.id);
    
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
    const klassifA = klassificeraKPI(a.card.trendData, realAvgs[a.def.id], a.def.id);
    const klassifB = klassificeraKPI(b.card.trendData, realAvgs[b.def.id], b.def.id);
    
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
      kpis: ['N15516'],
      npGap: { hogre: 'U15433', lagre: 'U15434', amne: 'Svenska' },
      stage: '79'
    },
    'matematik_79': {
      title: 'Matematik åk 9',
      kpis: ['N15523'],
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

  // Preferera N15419 i sammanfattningen om den finns i resultaten
  const hasN15419 = results.some(r => r?.def?.id === 'N15419');
  if (hasN15419) {
    groups['summary_79'].kpis = ['N15419', 'N15503', 'N15504'];
  }
  
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
    const allaF6Klassif = klassificeraKPI(allaAmnenF6, groupAvgs['N15539'], 'N15539');
    
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
        klassif: klassificeraKPI(item.kpi, groupAvgs[item.id], item.id)
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
        const studKlassif = klassificeraKPI(studiero, groupAvgs['N15603'], 'N15603');
        if (studKlassif.nivaStatus === 'red' || studKlassif.trendStatus === 'ner') {
          meningar.push(`Låg studiero (${studiero.latest.toFixed(0)}%) är en förklaring – förbättrad arbetsro och klassrumsledarskap är avgörande hävstångar.`);
        }
      }
      
      if (trygghet?.latest != null && (!studiero?.latest || studiero.latest >= 75)) {
        const tryggKlassif = klassificeraKPI(trygghet, groupAvgs['N15613'], 'N15613');
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
      const matPoangKlassif = klassificeraKPI(matPoangF6, groupAvgs['N15509'], 'N15509');
      const svePoangKlassif = klassificeraKPI(svePoangF6, groupAvgs['N15510'], 'N15510');
      
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
      klassif: klassificeraKPI(item.kpi, groupAvgs[item.id], item.id)
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
  
  // 1. Förutsättningar (elevantal som KONTEXT, elever per lärare, behörighet)
  // OBS: Elevantal används endast som kontextinformation, aldrig som risk/styrka
  const elevantal = kpiData['N15807'];
  const eleverPerLarare = kpiData['N15034'];
  const behorighetLarare = kpiData['N15813'];
  
  // Elevantal endast som kontextförklaring för datakvalitet
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
    const allaKlassif = klassificeraKPI(allaAmnen, groupAvgs['N15419'], 'N15419');
    const meritKlassif = klassificeraKPI(meritvarde, groupAvgs['N15505'], 'N15505');
    
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
    klassif: klassificeraKPI(kpiData[def.id], groupAvgs[def.id], def.id)
  })).filter(item => item.data?.latest != null);

  const salsaNegative = salsaKPIs.filter(item => item.klassif.diff < -2);
  const salsaPositive = salsaKPIs.filter(item => item.klassif.diff > 2);
  
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

/**
 * Calculates trend text and direction from time series data
 * @param {string} unit - Unit for display
 * @param {Array<number>} values - Time series values
 * @returns {object} Trend information
 */
function beraknaTrendtext(unit, values) {
  const serie = (values || []).filter(v => v != null);
  
  if (serie.length === 0) {
    return { dir: 'stable', arrow: '→', text: 'Ingen data', analysis: 'Data saknas.', latest: null, diff1: null, diff3: null };
  }
  
  const latest = serie[serie.length - 1];
  const prev = serie[serie.length - 2] ?? null;
  const prev3 = serie.length >= 4 ? serie[serie.length - 4] : null;
  
  let dir = 'stable', arrow = '→', text = 'Stabil';
  let diff1 = null, diff3 = null;
  
  // Prioritize 3-year trend if available
  if (prev3 !== null) {
    diff3 = latest - prev3;
    if (diff3 > 0.5) { dir = 'improving'; arrow = '↗'; }
    else if (diff3 < -0.5) { dir = 'declining'; arrow = '↘'; }
    text = `${formatDiff(diff3, unit)} på 3 år`;
  } else if (prev !== null) {
    diff1 = latest - prev;
    if (diff1 > 0.05) { dir = 'improving'; arrow = '↗'; }
    else if (diff1 < -0.05) { dir = 'declining'; arrow = '↘'; }
    text = `${formatDiff(diff1, unit)} på 1 år`;
  } else {
    text = 'Ingen trenddata';
  }
  
  const ANALYSIS_TEXT = {
    improving: 'Förbättring över tid.',
    declining: 'Försämring över tid.',
    stable: 'Stabil nivå.'
  };
  
  return { dir, arrow, text, analysis: ANALYSIS_TEXT[dir], latest, diff1, diff3 };
}

/**
 * Fetches KPI card data with structured comparisons from Kolada API v3
 * @param {string} ouId - School unit ID
 * @param {object} def - KPI definition
 * @param {string} municipalityCode - Municipality code for comparisons (default '0684' Sävsjö)
 * @returns {Promise<Object>} KPI card data with comparisonData
 */
async function hamtaKpiCardData(ouId, def, municipalityCode = '0684') {
  const cacheKey = `${ouId}:${def.id}`;
  if (kpiCache.has(cacheKey)) {
    loadedKPIs++;
    updateGlobalProgress(loadedKPIs, totalKPIs);
    return kpiCache.get(cacheKey);
  }

  const fetchPromise = (async () => {
    try {
      // Hämta basdata
      const data = await hamtaKoladaData(ouId, def.id, SKOLENHET_DATA_BASE);
      const hasAny = (data?.totalt || []).some(v => v != null);
      
      if (!hasAny) {
        loadedKPIs++;
        updateGlobalProgress(loadedKPIs, totalKPIs);
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
      
      loadedKPIs++;
      updateGlobalProgress(loadedKPIs, totalKPIs);
      
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
      loadedKPIs++;
      updateGlobalProgress(loadedKPIs, totalKPIs);
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



/**
 * Builds real averages from comparison data with mock fallbacks
 * @param {Array} results - Card results with comparison data
 * @param {Function} pickBaselineFn - Function to pick baseline value
 * @returns {object} { realAvgs, sourceAvgs, hasMock }
 */
function buildRealAverages(results, pickBaselineFn) {
  const realAvgs = {};
  const sourceAvgs = {};
  let hasMock = false;
  
  results.forEach(({ card, def }) => {
    if (card.comparisonData && card.comparisonData.available) {
      const baseline = pickBaselineFn(def, card.comparisonData);
      if (baseline !== null) {
        realAvgs[def.id] = baseline;
        sourceAvgs[def.id] = card.comparisonData.rule_bucket;
      } else {
        realAvgs[def.id] = MOCK_AVERAGES[def.id] || null;
        sourceAvgs[def.id] = 'mock';
        hasMock = true;
      }
    } else {
      realAvgs[def.id] = MOCK_AVERAGES[def.id] || null;
      sourceAvgs[def.id] = 'mock';
      hasMock = true;
    }
  });
  
  return { realAvgs, sourceAvgs, hasMock };
}

/**
 * Renders regular and NP-gap cards into a document fragment
 * @param {Array} regularCards - Regular KPI cards
 * @param {Array} npGapPairs - NP-gap card pairs
 * @param {object} kpiData - KPI data storage object
 * @returns {DocumentFragment}
 */
function renderCards(regularCards, npGapPairs, kpiData) {
  const frag = document.createDocumentFragment();
  
  // Render regular cards first
  regularCards.forEach(({ card, def }) => {
    frag.appendChild(createKPICard(card));
    kpiData[def.id] = {
      ...card.trendData,
      rule_bucket: card.comparisonData?.rule_bucket || null,
      unit: def.unit,
      scaleDependent: def.scaleDependent || false
    };
  });
  
  // Render NP-gap cards as combined cards
  npGapPairs.forEach(({ hogre, lagre, amne }) => {
    frag.appendChild(createNPGapCard(hogre, lagre, amne));
    kpiData[hogre.id] = { ...hogre.trendData, unit: '%' };
    kpiData[lagre.id] = { ...lagre.trendData, unit: '%' };
  });
  
  return frag;
}

/**
 * Extracts NP-gap pairs from results
 * @param {Array} results - All card results
 * @returns {object} { npGapPairs, npGapIds }
 */
function extractNPGapPairs(results) {
  const npGapPairs = [];
  const npGapIds = new Set();
  
  NP_GAP_SUBJECTS.forEach(pair => {
    const hogreCard = results.find(r => r.def.id === pair.hogre);
    const lagreCard = results.find(r => r.def.id === pair.lagre);
    
    if (hogreCard && lagreCard) {
      npGapPairs.push({ hogre: hogreCard.card, lagre: lagreCard.card, amne: pair.amne });
      npGapIds.add(pair.hogre);
      npGapIds.add(pair.lagre);
    }
  });
  
  return { npGapPairs, npGapIds };
}

async function renderSection(sectionId, defs, ouId, kpiData, municipalityCode = '0684') {
  setLoading(sectionId, true);
  const cardPromises = defs.map(async (def) => {
    const card = await hamtaKpiCardData(ouId, def, municipalityCode);
    return { card, def };
  });

  const results = await Promise.all(cardPromises);

  const availableResults = results.filter(({ card }) => card?.trendData?.latest != null);

  if (availableResults.length === 0) {
    return {
      sectionId,
      fragment: document.createDocumentFragment(),
      cards: [],
      realAvgs: {},
      sourceAvgs: {},
      sectionHasMock: false
    };
  }

  // Build realAvgs from comparisonData (fallback to mock if data is missing)
  const { realAvgs, sourceAvgs, hasMock } = buildRealAverages(availableResults, pickBaseline);
  const sectionHasMock = hasMock;

  // Sortera efter positiva värden först (högst diff mot realAvgs)
  availableResults.sort((a, b) => {
    const groupAvgA = realAvgs[a.def.id] || null;
    const groupAvgB = realAvgs[b.def.id] || null;

    const klassifA = klassificeraKPI(a.card.trendData, groupAvgA, a.def.id);
    const klassifB = klassificeraKPI(b.card.trendData, groupAvgB, b.def.id);

    // Sortera fallande efter diff (högst först)
    return klassifB.diff - klassifA.diff;
  });

  // Group NP-gap KPIs for special rendering
  const { npGapPairs, npGapIds } = extractNPGapPairs(availableResults);

  // Separate regular cards from NP-gap cards
  const regularCards = availableResults.filter(({ def }) => !npGapIds.has(def.id));

  // Render all cards and return fragment for deferred injection
  const fragment = renderCards(regularCards, npGapPairs, kpiData);

  return { sectionId, fragment, cards: availableResults.map(r => r.card), realAvgs, sourceAvgs, sectionHasMock };
}

/**
 * Renderar styrande skolbild baserat på kritisk data (Fas 2)
 * @param {object} kpiData - KPI-data objekt
 * @param {object} groupAvgs - Gruppgenomsnitt
 * @param {Array} sectionResults - Resultat från kritiska sektioner
 */
async function renderStyrandeAnalys(kpiData, groupAvgs, sectionResults) {
  const styrandeAnalysContainer = document.getElementById('styrandeAnalys');
  
  if (!styrandeAnalysContainer) {
    console.warn('styrandeAnalys container not found in DOM - skipping styrande analys rendering');
    return;
  }
  
  console.log('DEBUG: Rendering styrande analys (kritisk data)', {
    containerFound: !!styrandeAnalysContainer,
    kpiDataKeys: Object.keys(kpiData),
    kpiDataCount: Object.keys(kpiData).length,
    groupAvgsKeys: Object.keys(groupAvgs),
    sampleKPI: kpiData['N15807']
  });
  
  // Beräkna sektionsstatus (trafikljus) baserat på kritisk data
  const baselineStatus = beraknaSektionStatus(BASELINE_KPIS, kpiData, groupAvgs);
  const svenskaStatus = beraknaSektionStatus(SVENSKA_KPIS, kpiData, groupAvgs);
  const matematikStatus = beraknaSektionStatus(MATEMATIK_KPIS, kpiData, groupAvgs);
  const engelskaStatus = beraknaSektionStatus(ENGELSKA_KPIS, kpiData, groupAvgs);
  const outcomeStatus = beraknaSektionStatus(kpiDefsOutcome(kpiData), kpiData, groupAvgs);
  
  const sektionStatusGrid = document.getElementById('sektionStatusGrid');
  
  if (!sektionStatusGrid) {
    console.warn('sektionStatusGrid element not found in DOM');
  } else {
    const baselineResult = sectionResults.find(r => r.sectionId === 'baselineKPIs') || {};
    const svenskaResult = sectionResults.find(r => r.sectionId === 'svenskaKPIs') || {};
    const matematikResult = sectionResults.find(r => r.sectionId === 'matematikKPIs') || {};
    const engelskaResult = sectionResults.find(r => r.sectionId === 'engelskaKPIs') || {};
    const outcomeResult = sectionResults.find(r => r.sectionId === 'outcomeKPIs') || {};
    
    const baselineBaseNote = baselineResult.sectionHasMock
      ? 'Jämfört med: Liknande skolor (F-9) + ersättningsvärde för saknade'
      : 'Jämfört med: Liknande skolor (F-9)';
    const svenskaBaseNote = svenskaResult.sectionHasMock
      ? 'Jämfört med: Liknande skolor (F-9) + ersättningsvärde för saknade'
      : 'Jämfört med: Liknande skolor (F-9)';
    const matematikBaseNote = matematikResult.sectionHasMock
      ? 'Jämfört med: Liknande skolor (F-9) + ersättningsvärde för saknade'
      : 'Jämfört med: Liknande skolor (F-9)';
    const engelskaBaseNote = engelskaResult.sectionHasMock
      ? 'Jämfört med: Liknande skolor (F-9) + ersättningsvärde för saknade'
      : 'Jämfört med: Liknande skolor (F-9)';
    const outcomeBaseNote = outcomeResult.sectionHasMock
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
      <div class="sektion-status-card ${svenskaStatus.status}">
        <div class="status-icon">${svenskaStatus.icon}</div>
        <h4>Svenska</h4>
        <div class="status-word">${svenskaStatus.statusWord}</div>
        <div class="status-summary">${svenskaStatus.summary}</div>
        <div class="status-trend">${svenskaStatus.trendIcon} ${svenskaStatus.trendText} senaste året</div>
        <div class="status-explanation">${svenskaStatus.statusExplanation}</div>
        <div class="comparison-base">${svenskaBaseNote}</div>
      </div>
      <div class="sektion-status-card ${matematikStatus.status}">
        <div class="status-icon">${matematikStatus.icon}</div>
        <h4>Matematik</h4>
        <div class="status-word">${matematikStatus.statusWord}</div>
        <div class="status-summary">${matematikStatus.summary}</div>
        <div class="status-trend">${matematikStatus.trendIcon} ${matematikStatus.trendText} senaste året</div>
        <div class="status-explanation">${matematikStatus.statusExplanation}</div>
        <div class="comparison-base">${matematikBaseNote}</div>
      </div>
      <div class="sektion-status-card ${engelskaStatus.status}">
        <div class="status-icon">${engelskaStatus.icon}</div>
        <h4>Engelska</h4>
        <div class="status-word">${engelskaStatus.statusWord}</div>
        <div class="status-summary">${engelskaStatus.summary}</div>
        <div class="status-trend">${engelskaStatus.trendIcon} ${engelskaStatus.trendText} senaste året</div>
        <div class="status-explanation">${engelskaStatus.statusExplanation}</div>
        <div class="comparison-base">${engelskaBaseNote}</div>
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
      <div class="sektion-status-card loading">
        <div class="status-icon">⏳</div>
        <h4>Värdeskapande</h4>
        <div class="status-summary">Laddar...</div>
      </div>
      <div class="sektion-status-card loading">
        <div class="status-icon">⏳</div>
        <h4>Trygghet & Studiero</h4>
        <div class="status-summary">Laddar...</div>
      </div>
    `;
  }
  
  // Generera insikter baserat på kritisk data (begränsad)
  const insikter = genereraInsikter(kpiData, groupAvgs);
  const insiktGrid = document.getElementById('insiktGrid');
  
  if (!insiktGrid) {
    console.warn('insiktGrid element not found in DOM');
  } else {
    insiktGrid.innerHTML = `
      <div class="insikt-card styrka">
        <h4>💪 Positivt</h4>
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
        <h4>🎯 Hävstång</h4>
        <div class="insikt-label">VAD:</div>
        <p>${insikter.havstang}</p>
        <div class="insikt-label">KONSEKVENS:</div>
        <p class="insikt-consequence">Detta är den mest effektiva vägen till förbättring baserat på data.</p>
        <div class="insikt-label">REKOMMENDATION:</div>
        <p class="insikt-action">Starta arbete omgående. Följ upp efter 3 månader.</p>
      </div>
      <div class="insikt-card uppmarksamma">
        <h4>👀 Att uppmärksamma</h4>
        <div class="insikt-label">VAD:</div>
        <p>${insikter.uppmarksamma}</p>
        <div class="insikt-label">KONSEKVENS:</div>
        <p class="insikt-consequence">Tidiga signaler – följ upp innan det utvecklas till ett större problem.</p>
        <div class="insikt-label">REKOMMENDATION:</div>
        <p class="insikt-action">Planera riktade observationer/uppföljningar och justera arbetssätt vid behov.</p>
      </div>
    `;
  }
  
  // Generera narrativ text baserat på kritisk data
  const narrativText = genereraNarrativText(kpiData, groupAvgs);
  const narrativEl = document.getElementById('narrativText');
  
  if (!narrativEl) {
    console.warn('narrativText element not found in DOM');
  } else {
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
      <p style="margin-top: 15px; padding: 10px; background: #fef3c7; border-left: 3px solid #f59e0b; font-size: 0.85rem;">
        <strong>📋 Fullständig analys genereras...</strong> Trygghet och värdeskapande läggs till när alla data laddats.
      </p>
    `;
    narrativEl.innerHTML = struktureradSammanfattning;
  }
  
  // Visa analysen
  styrandeAnalysContainer.style.display = 'block';
  
  // Add source attribution if not already present
  let sourceAttribution = document.getElementById('sourceAttribution');
  if (!sourceAttribution) {
    sourceAttribution = document.createElement('div');
    sourceAttribution.id = 'sourceAttribution';
    sourceAttribution.style.cssText = 'margin-top: 30px; padding: 20px; background: #f8fafc; border-left: 4px solid #3b82f6; font-size: 0.875rem; color: #475569;';
    sourceAttribution.innerHTML = '<strong>Källa:</strong> Kolada | <strong>Analysmotor:</strong> Peter Wenström';
    styrandeAnalysContainer.appendChild(sourceAttribution);
  }
}

/**
 * Uppdaterar styrande analys med fullständig data inkl. SALSA och trygghet (Fas 3)
 * @param {object} kpiData - Fullständig KPI-data
 * @param {object} groupAvgs - Fullständiga gruppgenomsnitt
 * @param {Array} allResults - Alla sektionsresultat (kritiska + tunga)
 */
async function enrichStyrandeAnalys(kpiData, groupAvgs, allResults) {
  const styrandeAnalysContainer = document.getElementById('styrandeAnalys');
  
  if (!styrandeAnalysContainer) {
    console.warn('styrandeAnalys container not found - skipping enrichment');
    return;
  }
  
  console.log('DEBUG: Enriching styrande analys with full data', {
    kpiDataCount: Object.keys(kpiData).length,
    groupAvgsCount: Object.keys(groupAvgs).length
  });
  
  // Uppdatera sektionsstatus med SALSA och trygghet
  const salsaStatus = beraknaSektionStatus(SALSA_KPIS, kpiData, groupAvgs);
  const tryggStatus = beraknaSektionStatus(TRYG_KPIS, kpiData, groupAvgs);
  
  const salsaResult = allResults.find(r => r.sectionId === 'salsaKPIs') || {};
  const tryggResult = allResults.find(r => r.sectionId === 'trygghetsKPIs') || {};
  
  const salsaBaseNote = salsaResult.sectionHasMock
    ? 'Resultat i relation till förutsättningar + ersättningsvärde för saknade'
    : 'Resultat i relation till förutsättningar';
  const tryggBaseNote = tryggResult.sectionHasMock
    ? 'Jämfört med: Liknande skolor (F-9) + ersättningsvärde för saknade'
    : 'Jämfört med: Liknande skolor (F-9)';
  
  // Hitta och uppdatera värdeskapande- och trygghetskort
  const sektionStatusGrid = document.getElementById('sektionStatusGrid');
  if (sektionStatusGrid) {
    const cards = sektionStatusGrid.querySelectorAll('.sektion-status-card');
    cards.forEach((card, index) => {
      const heading = card.querySelector('h4');
      if (heading) {
        if (heading.textContent.includes('Värdeskapande')) {
          card.className = `sektion-status-card ${salsaStatus.status}`;
          card.innerHTML = `
            <div class="status-icon">${salsaStatus.icon}</div>
            <h4>Värdeskapande</h4>
            <div class="status-word">${salsaStatus.statusWord}</div>
            <div class="status-summary">${salsaStatus.summary}</div>
            <div class="status-trend">${salsaStatus.trendIcon} ${salsaStatus.trendText} senaste året</div>
            <div class="status-explanation">${salsaStatus.statusExplanation}</div>
            <div class="comparison-base">${salsaBaseNote}</div>
          `;
        } else if (heading.textContent.includes('Trygghet')) {
          card.className = `sektion-status-card ${tryggStatus.status}`;
          card.innerHTML = `
            <div class="status-icon">${tryggStatus.icon}</div>
            <h4>Trygghet & Studiero</h4>
            <div class="status-word">${tryggStatus.statusWord}</div>
            <div class="status-summary">${tryggStatus.summary}</div>
            <div class="status-trend">${tryggStatus.trendIcon} ${tryggStatus.trendText} senaste året</div>
            <div class="status-explanation">${tryggStatus.statusExplanation}</div>
            <div class="comparison-base">${tryggBaseNote}</div>
          `;
        }
      }
    });
  }
  
  // Uppdatera insikter med fullständig data
  const insikter = genereraInsikter(kpiData, groupAvgs);
  const insiktGrid = document.getElementById('insiktGrid');
  
  if (insiktGrid) {
    insiktGrid.innerHTML = `
      <div class="insikt-card styrka">
        <h4>💪 Positivt</h4>
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
        <h4>🎯 Hävstång</h4>
        <div class="insikt-label">VAD:</div>
        <p>${insikter.havstang}</p>
        <div class="insikt-label">KONSEKVENS:</div>
        <p class="insikt-consequence">Detta är den mest effektiva vägen till förbättring baserat på data.</p>
        <div class="insikt-label">REKOMMENDATION:</div>
        <p class="insikt-action">Starta arbete omgående. Följ upp efter 3 månader.</p>
      </div>
      <div class="insikt-card uppmarksamma">
        <h4>👀 Att uppmärksamma</h4>
        <div class="insikt-label">VAD:</div>
        <p>${insikter.uppmarksamma}</p>
        <div class="insikt-label">KONSEKVENS:</div>
        <p class="insikt-consequence">Tidiga signaler – följ upp innan det utvecklas till ett större problem.</p>
        <div class="insikt-label">REKOMMENDATION:</div>
        <p class="insikt-action">Planera riktade observationer/uppföljningar och justera arbetssätt vid behov.</p>
      </div>
    `;
  }
  
  // Uppdatera narrativ med fullständig analys
  const narrativText = genereraNarrativText(kpiData, groupAvgs);
  const narrativEl = document.getElementById('narrativText');
  
  if (narrativEl) {
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
  }
}

async function renderSections(ouId, municipalityCode = null) {
  const kpiData = {};

  showGlobalLoading();
  showAnalysLoadingState();
  
  // Hämta kommunkod från dropdown om inte angiven
  if (!municipalityCode) {
    const kommunSelect = document.getElementById('kommunSelect');
    municipalityCode = kommunSelect?.value || '0684';
  }
  
  // Rensa comparison cache när kommun/enhet ändras
  clearCache();
  
  // Hämta skoltyp för filtrering av resultatgrupper
  const schoolType = await detectSchoolType(ouId);

  const criticalSectionConfigs = [
    { id: 'baselineKPIs', defs: BASELINE_KPIS },
    { id: 'svenskaKPIs', defs: SVENSKA_KPIS },
    { id: 'matematikKPIs', defs: MATEMATIK_KPIS },
    { id: 'engelskaKPIs', defs: ENGELSKA_KPIS },
    { id: 'outcomeKPIs', defs: kpiDefsOutcome() }
  ];

  const heavySectionConfigs = [
    { id: 'salsaKPIs', defs: SALSA_KPIS },
    { id: 'trygghetsKPIs', defs: TRYG_KPIS }
  ];

  // Räkna totalt antal KPIer att ladda
  totalKPIs = [...criticalSectionConfigs, ...heavySectionConfigs]
    .reduce((sum, config) => sum + config.defs.length, 0);
  loadedKPIs = 0;
  updateGlobalProgress(0, totalKPIs);

  const loadSectionGroup = async (configs) => {
    const orderedConfigs = [...configs].sort((a, b) => a.defs.length - b.defs.length);
    const groupPromises = orderedConfigs.map(cfg => renderSection(cfg.id, cfg.defs, ouId, kpiData, municipalityCode));
    const results = await Promise.all(groupPromises);

    results.forEach(result => {
      const sectionEl = document.getElementById(result.sectionId);
      if (sectionEl) {
        sectionEl.innerHTML = '';
        sectionEl.appendChild(result.fragment);
      }
    });

    return results;
  };

  // === FAS 1: Ladda kritiska sektioner och rendera i DOM ===
  const criticalResults = await loadSectionGroup(criticalSectionConfigs);

  // === FAS 2: När DOM är uppdaterad, generera och rendera styrande analys ===
  // Vänta på nästa animation frame för att säkerställa att DOM är fullt renderad
  await new Promise(resolve => requestAnimationFrame(resolve));
  
  // Samla ihop alla realAvgs från kritiska sektioner för styrande analys
  const criticalGroupAvgs = {};
  criticalResults.forEach(result => {
    Object.assign(criticalGroupAvgs, result.realAvgs || {});
  });
  
  // Generera och visa styrande analys baserat på kritisk data
  await renderStyrandeAnalys(kpiData, criticalGroupAvgs, criticalResults);

  // === FAS 3: Lazy-load tunga sektioner och enricha analys ===
  // Visa laddningsindikator för tunga sektioner
  heavySectionConfigs.forEach(cfg => setLoading(cfg.id, true));
  const heavyResults = await new Promise((resolve) => {
    setTimeout(async () => {
      try {
        const results = await loadSectionGroup(heavySectionConfigs);
        resolve(results);
      } catch (error) {
        console.error('Fel vid laddning av tunga sektioner', error);
        resolve([]);
      }
    }, 50);
  });

  const sectionResults = [...criticalResults, ...heavyResults];

  // Plocka ut resultat per sektion
  const baselineResult = sectionResults.find(r => r.sectionId === 'baselineKPIs') || {};
  const svenskaResult = sectionResults.find(r => r.sectionId === 'svenskaKPIs') || {};
  const matematikResult = sectionResults.find(r => r.sectionId === 'matematikKPIs') || {};
  const engelskaResult = sectionResults.find(r => r.sectionId === 'engelskaKPIs') || {};
  const outcomeResult = sectionResults.find(r => r.sectionId === 'outcomeKPIs') || {};
  const salsaResult = sectionResults.find(r => r.sectionId === 'salsaKPIs') || {};
  const tryggResult = sectionResults.find(r => r.sectionId === 'trygghetsKPIs') || {};

  // Slå ihop alla realAvgs från sektionerna (inkl. tunga sektioner för full analys)
  const groupAvgs = {
    ...(baselineResult?.realAvgs || {}),
    ...(svenskaResult?.realAvgs || {}),
    ...(matematikResult?.realAvgs || {}),
    ...(engelskaResult?.realAvgs || {}),
    ...(outcomeResult?.realAvgs || {}),
    ...(salsaResult?.realAvgs || {}),
    ...(tryggResult?.realAvgs || {})
  };

  // Uppdatera styrande analys med fullständig data (inkl. SALSA och trygghet)
  await enrichStyrandeAnalys(kpiData, groupAvgs, sectionResults);

  // Data-kvalitet: markera om ersättningsvärden (mock) användes i någon sektion
  const anyMockBaseline = (
    baselineResult?.sectionHasMock ||
    svenskaResult?.sectionHasMock ||
    matematikResult?.sectionHasMock ||
    engelskaResult?.sectionHasMock ||
    outcomeResult?.sectionHasMock ||
    salsaResult?.sectionHasMock ||
    tryggResult?.sectionHasMock
  );

  // Visa datakvalitetsnotis vid mock-fallback
  let dqNotice = document.getElementById('dataQualityNotice');
  if (!dqNotice) {
    const styrandeAnalysContainer = document.getElementById('styrandeAnalys');
    if (styrandeAnalysContainer) {
      dqNotice = document.createElement('div');
      dqNotice.id = 'dataQualityNotice';
      dqNotice.className = 'data-quality-notice';
      styrandeAnalysContainer.prepend(dqNotice);
    }
  }
  if (dqNotice) {
    if (anyMockBaseline) {
      dqNotice.textContent = 'Begränsad jämförelsedata: Vissa baslinjer kunde inte hämtas live. Ersättningsvärden används — tolka analys med försiktighet.';
      dqNotice.style.display = 'block';
    } else {
      dqNotice.style.display = 'none';
    }
  }
  
  // === DÖLJ GLOBAL LOADING SCREEN ===
  hideGlobalLoading();
}

function showAnalysLoadingState() {
  const styrandeAnalysContainer = document.getElementById('styrandeAnalys');
  if (!styrandeAnalysContainer) return;

  styrandeAnalysContainer.style.display = 'block';

  const sektionStatusGrid = document.getElementById('sektionStatusGrid');
  if (sektionStatusGrid) {
    sektionStatusGrid.innerHTML = `
      <div class="sektion-status-card loading">
        <div class="status-icon">⏳</div>
        <h4>Förutsättningar</h4>
        <div class="status-summary">Laddar analys...</div>
      </div>
      <div class="sektion-status-card loading">
        <div class="status-icon">⏳</div>
        <h4>Resultat</h4>
        <div class="status-summary">Laddar analys...</div>
      </div>
      <div class="sektion-status-card loading">
        <div class="status-icon">⏳</div>
        <h4>Värdeskapande</h4>
        <div class="status-summary">Laddar analys...</div>
      </div>
      <div class="sektion-status-card loading">
        <div class="status-icon">⏳</div>
        <h4>Trygghet & Studiero</h4>
        <div class="status-summary">Laddar analys...</div>
      </div>
    `;
  }

  const insiktGrid = document.getElementById('insiktGrid');
  if (insiktGrid) {
    insiktGrid.innerHTML = `
      <div class="insikt-card styrka"><h4>💪 Positivt</h4><p>Laddar...</p></div>
      <div class="insikt-card risk"><h4>⚠️ Risk</h4><p>Laddar...</p></div>
      <div class="insikt-card havstang"><h4>🎯 Hävstång</h4><p>Laddar...</p></div>
      <div class="insikt-card uppmarksamma"><h4>👀 Att uppmärksamma</h4><p>Laddar...</p></div>
    `;
  }

  const narrativEl = document.getElementById('narrativText');
  if (narrativEl) {
    narrativEl.innerHTML = `
      <h4>Sammanfattning – Vad du behöver veta</h4>
      <ul class="narrative-bullets">
        <li><strong>📊 Nuläge:</strong> Analys genereras...</li>
        <li><strong>⚡ Konsekvens:</strong> Uppdateras när data laddats.</li>
        <li><strong>✅ Positivt:</strong> Identifieras efter dataladdning.</li>
        <li><strong>🎯 Fokus framåt:</strong> Sätts när fullständigt underlag finns.</li>
      </ul>
    `;
  }

  const dqNotice = document.getElementById('dataQualityNotice');
  if (dqNotice) dqNotice.style.display = 'none';
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
  ['baselineKPIs','outcomeKPIs','svenskaKPIs','matematikKPIs','engelskaKPIs','salsaKPIs','trygghetsKPIs'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML='';
  });
}

function initDashboard() {
  const kommunSelect = document.getElementById('kommunSelect');
  const skolenhetSelect = document.getElementById('skolenhetSelect');

  initKommuner(kommunSelect);

  kommunSelect.addEventListener('change', () => onKommunChange(kommunSelect, skolenhetSelect));
  skolenhetSelect.addEventListener('change', () => {
    const ouId = skolenhetSelect.value;
    if (!ouId) return;
    renderSections(ouId);
  });

  onKommunChange(kommunSelect, skolenhetSelect);
}

window.addEventListener('DOMContentLoaded', initDashboard);
