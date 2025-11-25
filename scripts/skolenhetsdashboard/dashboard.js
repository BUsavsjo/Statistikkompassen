// School Unit Dashboard for Primary School Principals
import {
  DEFAULT_KOMMUN_ID,
  SKOLENHET_SEARCH_API,
  SKOLENHET_DATA_BASE
} from '../constants.js';
import { ALLA_KOMMUNER } from '../kommuner.js';
import { getPredefinedSkolenheter } from '../skolenheter.js';

// KPI definitions organized by panel
const BASELINE_KPIS = [
  { id: 'N15807', name: 'Antal elever åk 1-9', unit: 'antal' },
  { id: 'N15034', name: 'Elever per lärare åk 1-9', unit: 'antal' },
  { id: 'N15813', name: 'Andel behöriga lärare åk 1-9', unit: 'procent' }
];

const F6_OUTCOME_KPIS = [
  { id: 'N15482', name: 'Åk 6: minst E i engelska', unit: 'procent' },
  { id: 'N15485', name: 'Åk 6: minst E i matematik', unit: 'procent' },
  { id: 'N15488', name: 'Åk 6: minst E i svenska', unit: 'procent' },
  { id: 'N15516', name: 'Åk 6: minst E i svenska som andraspråk', unit: 'procent' }
];

const SEVEN_NINE_OUTCOME_KPIS = [
  { id: 'N15418', name: 'Åk 9: godkända i alla ämnen', unit: 'procent' },
  { id: 'N15503', name: 'Åk 9: genomsnittligt meritvärde', unit: 'poäng' },
  { id: 'N15504', name: 'Åk 9: behörighet till yrkesprogram', unit: 'procent' },
  { id: 'U15414', name: 'SALSA: avvikelse godkända', unit: 'procentenheter' },
  { id: 'U15416', name: 'SALSA: avvikelse meritvärde', unit: 'poäng' }
];

let aktivKommun = DEFAULT_KOMMUN_ID;
let aktivSkolenhet = null;
let aktivSkolenhetNamn = '';
let detectedStage = null;
const skolenhetCache = new Map();
const dataCache = new Map();

// Fetch data from Kolada API
async function fetchKPIData(ouId, kpiId) {
  const cacheKey = `${ouId}_${kpiId}`;
  if (dataCache.has(cacheKey)) {
    return dataCache.get(cacheKey);
  }

  try {
    const url = `${SKOLENHET_DATA_BASE}/${kpiId}/ou/${ouId}`;
    const response = await fetch(url, {
      mode: 'cors',
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      console.warn(`Failed to fetch KPI ${kpiId}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const values = data.values && data.values.length > 0 && data.values[0].values 
      ? data.values[0].values 
      : [];
    
    dataCache.set(cacheKey, values);
    return values;
  } catch (error) {
    console.error(`Error fetching KPI ${kpiId}:`, error);
    return [];
  }
}

// Fetch municipality average for comparison
async function fetchMunicipalityKPI(municipalityCode, kpiId) {
  const cacheKey = `mun_${municipalityCode}_${kpiId}`;
  if (dataCache.has(cacheKey)) {
    return dataCache.get(cacheKey);
  }

  try {
    const url = `https://api.kolada.se/v3/data/kpi/${kpiId}/municipality/${municipalityCode}`;
    const response = await fetch(url, {
      mode: 'cors',
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const values = data.values && data.values.length > 0 && data.values[0].values 
      ? data.values[0].values 
      : [];
    
    dataCache.set(cacheKey, values);
    return values;
  } catch (error) {
    console.error(`Error fetching municipality KPI ${kpiId}:`, error);
    return [];
  }
}

// Get latest value and trend from data
function analyzeKPIData(values) {
  if (!values || values.length === 0) {
    return { latest: null, trend: [], years: [] };
  }

  // Sort by period descending
  const sorted = [...values].sort((a, b) => b.period - a.period);
  
  // Get total values (gender T)
  const totalValues = sorted
    .filter(v => v.gender === 'T' && v.value !== null)
    .slice(0, 5); // Last 5 years max

  return {
    latest: totalValues[0]?.value || null,
    latestYear: totalValues[0]?.period || null,
    trend: totalValues.map(v => v.value),
    years: totalValues.map(v => v.period)
  };
}

// Calculate trend direction
function getTrendDirection(trend, munTrend) {
  if (trend.length < 2) return 'insufficient';
  
  const current = trend[0];
  const previous = trend[1];
  const change = current - previous;
  
  // Compare with municipality if available
  if (munTrend && munTrend.length >= 2) {
    const munChange = munTrend[0] - munTrend[1];
    if (Math.abs(change - munChange) < 1) return 'stable';
    return change > munChange ? 'improving' : 'declining';
  }
  
  // Simple trend without comparison
  if (Math.abs(change) < 1) return 'stable';
  return change > 0 ? 'improving' : 'declining';
}

// Detect school stage from name or by checking which grades have data
function detectSchoolStage(ouName) {
  const name = ouName.toLowerCase();
  
  // Explicit markers
  if (name.includes('f-6') || name.includes('lågstadie') || name.includes('mellanstadie')) {
    return 'F-6';
  }
  if (name.includes('7-9') || name.includes('högstadie')) {
    return '7-9';
  }
  if (name.includes('f-9')) {
    return 'F-9';
  }
  
  // Default: will be determined by data availability
  return null;
}

// Detect stage by checking which outcome data exists
async function detectStageByData(ouId) {
  // Check if grade 9 data exists
  const grade9Test = await fetchKPIData(ouId, 'N15418');
  const hasGrade9 = grade9Test.some(v => v.value !== null);
  
  // Check if grade 6 data exists
  const grade6Test = await fetchKPIData(ouId, 'N15482');
  const hasGrade6 = grade6Test.some(v => v.value !== null);
  
  if (hasGrade9 && hasGrade6) return 'F-9';
  if (hasGrade9) return '7-9';
  if (hasGrade6) return 'F-6';
  
  return 'F-6'; // Default
}

// Generate interpretation for baseline panel
function generateBaselineInterpretation(data, munData) {
  const sentences = [];
  
  const studentCount = data['N15807'];
  const studentsPerTeacher = data['N15034'];
  const qualifiedTeachers = data['N15813'];
  
  const munStudentsPerTeacher = munData['N15034'];
  const munQualified = munData['N15813'];
  
  // Student count trend
  if (studentCount && studentCount.trend.length >= 2) {
    const change = studentCount.trend[0] - studentCount.trend[1];
    if (Math.abs(change) > 10) {
      sentences.push(`Elevantalet har ${change > 0 ? 'ökat' : 'minskat'} med ${Math.abs(Math.round(change))} elever sedan föregående år.`);
    }
  }
  
  // Students per teacher
  if (studentsPerTeacher && munStudentsPerTeacher) {
    const diff = studentsPerTeacher.latest - munStudentsPerTeacher.latest;
    if (Math.abs(diff) > 1) {
      sentences.push(`Elevtätheten (${studentsPerTeacher.latest.toFixed(1)} elever/lärare) är ${diff > 0 ? 'högre' : 'lägre'} än kommunsnittet (${munStudentsPerTeacher.latest.toFixed(1)}), vilket ${diff > 0 ? 'kan påverka möjligheten till individuell undervisning' : 'ger goda förutsättningar för närundervisning'}.`);
    }
  }
  
  // Teacher qualifications
  if (qualifiedTeachers && munQualified) {
    const diff = qualifiedTeachers.latest - munQualified.latest;
    if (diff < -5) {
      sentences.push(`Andelen behöriga lärare (${Math.round(qualifiedTeachers.latest)}%) ligger under kommunsnittet och bör prioriteras för kompetensförsörjning.`);
    } else if (diff > 5) {
      sentences.push(`Andelen behöriga lärare (${Math.round(qualifiedTeachers.latest)}%) ligger över kommunsnittet, vilket är positivt för undervisningskvaliteten.`);
    }
  }
  
  if (sentences.length === 0) {
    return 'Resurser och struktur ligger nära kommungenomsnittet.';
  }
  
  return sentences.join(' ');
}

// Generate interpretation for F-6 outcomes
function generateF6Interpretation(data, munData) {
  const sentences = [];
  const subjects = ['engelska', 'matematik', 'svenska'];
  const kpis = ['N15482', 'N15485', 'N15488'];
  
  const weakSubjects = [];
  const strongSubjects = [];
  
  kpis.forEach((kpiId, index) => {
    const schoolData = data[kpiId];
    const munDataItem = munData[kpiId];
    
    if (schoolData && munDataItem && schoolData.latest && munDataItem.latest) {
      const diff = schoolData.latest - munDataItem.latest;
      if (diff < -5) {
        weakSubjects.push(subjects[index]);
      } else if (diff > 5) {
        strongSubjects.push(subjects[index]);
      }
    }
  });
  
  if (weakSubjects.length === 3) {
    sentences.push('Resultaten i årskurs 6 ligger under kommunsnittet i alla kärnämnen, vilket indikerar behov av systematiska åtgärder.');
  } else if (weakSubjects.length > 0) {
    sentences.push(`Resultaten i ${weakSubjects.join(' och ')} ligger under kommunsnittet i årskurs 6 och bör prioriteras.`);
  } else {
    sentences.push('Resultaten i årskurs 6 ligger nära eller över kommunsnittet i kärnämnena.');
  }
  
  if (strongSubjects.length > 0) {
    sentences.push(`Skolan visar särskilt goda resultat i ${strongSubjects.join(', ')}.`);
  }
  
  return sentences.join(' ');
}

// Generate interpretation for 7-9 outcomes
function generate79Interpretation(data, munData) {
  const sentences = [];
  
  const approved = data['N15418'];
  const merit = data['N15503'];
  const eligibility = data['N15504'];
  const salsaApproved = data['U15414'];
  const salsaMerit = data['U15416'];
  
  const munApproved = munData['N15418'];
  const munMerit = munData['N15503'];
  
  // Main results
  if (approved && munApproved && approved.latest && munApproved.latest) {
    const diff = approved.latest - munApproved.latest;
    if (diff < -5) {
      sentences.push(`Andelen godkända i alla ämnen (${Math.round(approved.latest)}%) ligger under kommunsnittet (${Math.round(munApproved.latest)}%), vilket kräver systematiska åtgärder.`);
    } else if (diff > 5) {
      sentences.push(`Andelen godkända i alla ämnen (${Math.round(approved.latest)}%) ligger över kommunsnittet, vilket visar att merparten av eleverna når godkända resultat.`);
    }
  }
  
  // SALSA interpretation
  if (salsaApproved && salsaApproved.latest !== null) {
    if (salsaApproved.latest > 2) {
      sentences.push('SALSA-analysen visar positiv avvikelse - skolan lyfter elever över förväntat resultat baserat på deras bakgrund.');
    } else if (salsaApproved.latest < -2) {
      sentences.push('SALSA-analysen visar negativ avvikelse - resultaten ligger under vad som förväntas baserat på elevernas bakgrund, vilket indikerar behov av att stärka undervisningsprocesser och stödstrukturer.');
    }
  }
  
  if (sentences.length === 0) {
    return 'Resultaten i årskurs 9 ligger nära kommunsnittet.';
  }
  
  return sentences.join(' ');
}

// Render a KPI item
function renderKPIItem(kpiDef, data, munData) {
  console.log('Rendering KPI:', kpiDef.id, 'Data points:', data?.length || 0);
  
  const analysis = data ? analyzeKPIData(data) : { latest: null, trend: [], years: [] };
  const munAnalysis = munData ? analyzeKPIData(munData) : { latest: null, trend: [] };
  
  console.log('Analysis for', kpiDef.id, ':', analysis.latest, 'Trend:', analysis.trend);
  
  const trendDir = getTrendDirection(analysis.trend, munAnalysis.trend);
  const trendClass = trendDir === 'improving' ? 'trend-improving' : 
                     trendDir === 'declining' ? 'trend-declining' : 'trend-stable';
  const trendIcon = trendDir === 'improving' ? '↗️' : 
                   trendDir === 'declining' ? '↘️' : '→';
  const trendText = trendDir === 'improving' ? 'Förbättras' : 
                   trendDir === 'declining' ? 'Försämras' : 'Stabilt';
  
  const valueDisplay = analysis.latest !== null ? 
    (kpiDef.unit === 'procent' ? `${Math.round(analysis.latest)}%` : 
     kpiDef.unit === 'poäng' ? Math.round(analysis.latest) :
     Math.round(analysis.latest)) : '–';
  
  const compareText = munAnalysis.latest !== null && analysis.latest !== null ?
    ` (Kommun: ${kpiDef.unit === 'procent' ? Math.round(munAnalysis.latest) + '%' : Math.round(munAnalysis.latest)})` : '';
  
  return `
    <div class="kpi-item">
      <div class="kpi-label">${kpiDef.name}</div>
      <div class="kpi-value">${valueDisplay}</div>
      <div class="kpi-trend">
        <span class="${trendClass}">${trendIcon} ${trendText}</span>
        <span style="color: #94a3b8; font-size: 0.8rem;">${compareText}</span>
      </div>
    </div>
  `;
}

// Render baseline panel
async function renderBaselinePanel(ouId, asText = false) {
  const baselineKPIs = [
    { id: 'N15807', name: 'Antal elever' },
    { id: 'N15034', name: 'Elever per lärare' },
    { id: 'N15813', name: 'Behöriga lärare' }
  ];

  const panelContent = [];

  for (const kpi of baselineKPIs) {
    const data = await fetchKPIData(ouId, kpi.id);
    const latestValue = data.length > 0 ? data[0].value : 'Ingen data';

    if (asText) {
      panelContent.push(`<div>${kpi.name}: ${latestValue}</div>`);
    } else {
      panelContent.push(renderKPIItem(kpi, data));
    }
  }

  return `<div class="panel baseline-panel">${panelContent.join('')}</div>`;
}

// Render F-6 outcomes panel
async function renderF6OutcomesPanel(ouId, asText = false) {
  const f6KPIs = [
    { id: 'N15482', name: 'Engelska' },
    { id: 'N15485', name: 'Matematik' },
    { id: 'N15488', name: 'Svenska' },
    { id: 'N15516', name: 'Svenska som andraspråk' }
  ];

  const panelContent = [];

  for (const kpi of f6KPIs) {
    const data = await fetchKPIData(ouId, kpi.id);
    const latestValue = data.length > 0 ? data[0].value : 'Ingen data';

    if (asText) {
      panelContent.push(`<div>${kpi.name}: ${latestValue}</div>`);
    } else {
      panelContent.push(renderKPIItem(kpi, data));
    }
  }

  return `<div class="panel f6-panel">${panelContent.join('')}</div>`;
}

// Render 7-9 outcomes panel
async function render79OutcomesPanel(ouId, asText = false) {
  const f9KPIs = [
    { id: 'N15418', name: 'Godkända alla ämnen' },
    { id: 'N15503', name: 'Meritvärde' },
    { id: 'N15504', name: 'Behörighet' },
    { id: 'U15414', name: 'SALSA-värde' },
    { id: 'U15416', name: 'SALSA-avvikelse' }
  ];

  const panelContent = [];

  for (const kpi of f9KPIs) {
    const data = await fetchKPIData(ouId, kpi.id);
    const latestValue = data.length > 0 ? data[0].value : 'Ingen data';

    if (asText) {
      panelContent.push(`<div>${kpi.name}: ${latestValue}</div>`);
    } else {
      panelContent.push(renderKPIItem(kpi, data));
    }
  }

  return `<div class="panel f9-panel">${panelContent.join('')}</div>`;
}

// Load and render full dashboard
async function loadDashboard(ouId, ouName) {
  const content = document.getElementById('dashboardContent');
  content.innerHTML = '<div class="loading-message">Laddar data...</div>';

  console.log('=== LOADING DASHBOARD ===');
  console.log('OU ID:', ouId);
  console.log('OU Name:', ouName);
  console.log('Municipality:', aktivKommun);

  try {
    // Detect stage
    let stage = detectSchoolStage(ouName);
    console.log('Stage from name detection:', stage);

    if (!stage) {
      console.log('No stage from name, detecting from data...');
      stage = await detectStageByData(ouId);
      console.log('Stage from data detection:', stage);
    }

    detectedStage = stage;

    // Show stage detection
    const stageDetection = document.getElementById('stageDetection');
    stageDetection.style.display = 'block';
    stageDetection.innerHTML = `
      <strong>Detekterat stadium:</strong> <span class="stage-badge">${stage}</span> 
      <span style="margin-left: 1rem; color: #64748b;">Jämförelser görs endast inom ${stage}-enheter</span>
    `;

    // Render panels
    console.log('Starting to render panels...');
    const panels = [];

    // Always show baseline
    console.log('Rendering baseline panel...');
    const baselinePanel = await renderBaselinePanel(ouId, true); // Pass true to render as text
    panels.push(baselinePanel);
    console.log('Baseline panel complete');

    // Show relevant outcome panels based on stage
    if (stage === 'F-6') {
      console.log('Rendering F-6 outcomes panel...');
      const f6Panel = await renderF6OutcomesPanel(ouId, true); // Pass true to render as text
      panels.push(f6Panel);
      console.log('F-6 panel complete');
    } else if (stage === '7-9') {
      console.log('Rendering 7-9 outcomes panel...');
      const f9Panel = await render79OutcomesPanel(ouId, true); // Pass true to render as text
      panels.push(f9Panel);
      console.log('7-9 panel complete');
    } else if (stage === 'F-9') {
      console.log('Rendering both F-6 and 7-9 panels...');
      const [f6Panel, f9Panel] = await Promise.all([
        renderF6OutcomesPanel(ouId, true), // Pass true to render as text
        render79OutcomesPanel(ouId, true)  // Pass true to render as text
      ]);
      panels.push(f6Panel, f9Panel);
      console.log('Both panels complete');
    }

    content.innerHTML = `<div class="dashboard-panels">${panels.join('')}</div>`;
    console.log('=== DASHBOARD COMPLETE ===');

  } catch (error) {
    console.error('ERROR loading dashboard:', error);
    console.error('Error stack:', error.stack);
    content.innerHTML = `
      <div class="panel" style="border-left-color: #dc2626;">
        <h2 style="color: #dc2626;">⚠️ Fel vid laddning</h2>
        <p>Ett fel uppstod vid laddning av data. Detaljer i konsolen.</p>
        <p style="color: #64748b; font-size: 0.9rem;">Fel: ${error.message}</p>
      </div>
    `;
  }
}

// Fetch school units for municipality
async function hamtaSkolenheterForKommun(kommunId) {
  if (skolenhetCache.has(kommunId)) {
    return skolenhetCache.get(kommunId);
  }

  const forinlagda = getPredefinedSkolenheter(kommunId).map(enhet => ({
    id: enhet.id,
    title: enhet.title,
    type: (enhet.type || '').toLowerCase()
  }));

  let url = `${SKOLENHET_SEARCH_API}?municipality=${kommunId}&per_page=500`;
  const enheter = [...forinlagda];

  try {
    while (url) {
      const response = await fetch(url, {
        mode: 'cors',
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) throw new Error('Kunde inte hämta skolenheter');
      const data = await response.json();
      const resultat = data.results || data.values || [];

      resultat.forEach(enhet => {
        if (!enheter.some(e => e.id === enhet.id)) {
          enheter.push({
            id: enhet.id,
            title: enhet.title,
            type: (enhet.type || enhet.type_name || '').toLowerCase()
          });
        }
      });

      url = data.next_page || data.next || null;
    }
  } catch (error) {
    console.error('Fel vid hämtning av skolenheter:', error);
    if (enheter.length) {
      enheter.sort((a, b) => a.title.localeCompare(b.title, 'sv'));
      skolenhetCache.set(kommunId, enheter);
      return enheter;
    }
    throw error;
  }

  enheter.sort((a, b) => a.title.localeCompare(b.title, 'sv'));
  skolenhetCache.set(kommunId, enheter);
  return enheter;
}

// Update school unit dropdown
async function uppdateraSkolenhetDropdown() {
  const select = document.getElementById('skolenhetSelect');
  if (!select) return;

  select.innerHTML = '';
  select.disabled = true;

  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Välj skolenhet...';
  select.appendChild(defaultOption);

  try {
    const allaEnheter = await hamtaSkolenheterForKommun(aktivKommun);
    console.log('Hittade', allaEnheter.length, 'skolenheter');

    if (!allaEnheter.length) {
      const infoOption = document.createElement('option');
      infoOption.value = '';
      infoOption.textContent = 'Inga skolenheter hittades';
      select.appendChild(infoOption);
    } else {
      allaEnheter.forEach(enhet => {
        const option = document.createElement('option');
        option.value = enhet.id;
        option.textContent = enhet.title;
        select.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Kunde inte hämta skolenheter', error);
    const errorOption = document.createElement('option');
    errorOption.value = '';
    errorOption.textContent = 'Kunde inte hämta skolenheter';
    select.appendChild(errorOption);
  } finally {
    select.disabled = false;
  }
}

// Initialize municipality dropdown
function initKommunDropdown() {
  const kommunSelect = document.getElementById('kommunSelect');
  ALLA_KOMMUNER.forEach(kommun => {
    const option = document.createElement('option');
    option.value = kommun.id;
    option.textContent = kommun.title;
    option.selected = kommun.id === aktivKommun;
    kommunSelect.appendChild(option);
  });
}

// Event handlers
function bytKommun(kommunId) {
  aktivKommun = kommunId;
  aktivSkolenhet = null;
  aktivSkolenhetNamn = '';
  console.log('Byte till kommun:', kommunId);
  uppdateraSkolenhetDropdown();
  document.getElementById('dashboardContent').innerHTML = 
    '<div class="loading-message">Välj en skolenhet för att visa data...</div>';
  document.getElementById('stageDetection').style.display = 'none';
}

function bytSkolenhet(skolenhetId, skolenhetNamn) {
  if (!skolenhetId) {
    aktivSkolenhet = null;
    aktivSkolenhetNamn = '';
    document.getElementById('dashboardContent').innerHTML = 
      '<div class="loading-message">Välj en skolenhet för att visa data...</div>';
    document.getElementById('stageDetection').style.display = 'none';
    return;
  }

  aktivSkolenhet = skolenhetId;
  aktivSkolenhetNamn = skolenhetNamn || '';
  console.log('Byte till skolenhet:', aktivSkolenhetNamn);
  loadDashboard(skolenhetId, skolenhetNamn);
}

// Initialize
function init() {
  console.log('Initierar skolenhetsdashboard för rektorer...');
  
  initKommunDropdown();
  uppdateraSkolenhetDropdown();
  
  document.getElementById('kommunSelect')?.addEventListener('change', event => {
    bytKommun(event.target.value);
  });

  document.getElementById('skolenhetSelect')?.addEventListener('change', event => {
    const option = event.target.selectedOptions[0];
    bytSkolenhet(event.target.value, option ? option.textContent : '');
  });
  
  console.log('Initiering klar');
}

init();
