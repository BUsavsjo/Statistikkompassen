import { ALLA_KOMMUNER } from '../kommuner.js';
import { SKOLENHET_SEARCH_API, SKOLENHET_DATA_BASE } from '../constants.js';
import { hamtaKoladaData } from '../chartHelpers.js';

const BASELINE_KPIS = [
  { id: 'N11805', label: 'Antal elever i förskoleklass', unit: 'st' },
  { id: 'N15807', label: 'Antal elever åk 1–9', unit: 'st' },
  { id: 'N15034', label: 'Elever per lärare (heltidstjänst), kommunal grundskola åk 1–9', unit: 'st' },
  { id: 'N15813', label: 'Andel legitimerade/behöriga lärare åk 1–9', unit: '%' },
  { id: 'N15031', label: 'Lärare med pedagogisk högskoleexamen i kommunal grundskola åk 1–9', unit: '%' }
];

const OUTCOME_KPIS = [
  { id: 'N15482', label: 'Åk 6: Engelska minst E', unit: '%', stage: 'f6' },
  { id: 'N15485', label: 'Åk 6: Matematik minst E', unit: '%', stage: 'f6' },
  { id: 'N15488', label: 'Åk 6: Svenska minst E', unit: '%', stage: 'f6' },
  { id: 'N15509', label: 'Åk 6: Betygspoäng i matematik', unit: 'poäng', stage: 'f6' },
  { id: 'N15510', label: 'Åk 6: Betygspoäng i svenska', unit: 'poäng', stage: 'f6' },
  { id: 'N15419', label: 'Åk 9: Alla ämnen godkända', unit: '%', stage: '79' },
  { id: 'N15436', label: 'Åk 9: Behöriga till yrkesprogram', unit: '%', stage: '79' },
  { id: 'N15505', label: 'Åk 9: Meritvärde (17 ämnen)', unit: 'poäng', stage: '79' },
  { id: 'N15503', label: 'Åk 9: Betygspoäng matematik', unit: 'poäng', stage: '79' },
  { id: 'U15429', label: 'Åk 9: Högre slutbetyg än NP i matematik', unit: '%', stage: '79' },
  { id: 'U15430', label: 'Åk 9: Lägre slutbetyg än NP i matematik', unit: '%', stage: '79' },
  { id: 'U15431', label: 'Åk 9: Högre slutbetyg än NP i engelska', unit: '%', stage: '79' },
  { id: 'U15432', label: 'Åk 9: Lägre slutbetyg än NP i engelska', unit: '%', stage: '79' },
  { id: 'U15433', label: 'Åk 9: Högre slutbetyg än NP i svenska', unit: '%', stage: '79' },
  { id: 'U15434', label: 'Åk 9: Lägre slutbetyg än NP i svenska', unit: '%', stage: '79' }
];

const SALSA_KPIS = [
  { id: 'U15413', label: 'Åk 9: SALSA modellberäknad andel alla ämnen', unit: '%' },
  { id: 'U15414', label: 'Åk 9: Avvikelse SALSA (%)', unit: 'p.p.' },
  { id: 'U15415', label: 'Åk 9: SALSA modellberäknat meritvärde', unit: 'poäng' },
  { id: 'U15416', label: 'Åk 9: Meritvärde avvikelse (SALSA)', unit: 'poäng' }
];

const TRYG_KPIS = [
  { id: 'N15613', label: 'Åk 5: Trygghet', unit: '%' },
  { id: 'N15603', label: 'Åk 5: Studiero', unit: '%' },
  { id: 'N15614', label: 'Åk 5: Vuxnas agerande mot kränkningar', unit: '%' }
];

const filterState = { hideF6: false, hide79: false };
const skolenhetCache = new Map();
const kpiCache = new Map();

function createKPICard(kpi) {
  const card = document.createElement('div');
  card.className = 'kpi-item';

  const label = document.createElement('div');
  label.className = 'kpi-label';
  label.textContent = kpi.label;

  const value = document.createElement('div');
  value.className = 'kpi-value';
  value.textContent = `${kpi.value ?? '—'} ${kpi.unit || ''}`.trim();

  const trend = document.createElement('div');
  trend.className = `kpi-trend trend-${kpi.trendDirection}`;
  trend.textContent = kpi.trendText;

  const analysis = document.createElement('div');
  analysis.className = 'kpi-analysis';
  analysis.textContent = kpi.analysis;

  card.append(label, value, trend, analysis);
  return card;
}

function setLoading(sectionId, loading = true) {
  const el = document.getElementById(sectionId);
  if (el) el.innerHTML = loading ? '<div class="loading-message">Laddar...</div>' : '';
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
  return OUTCOME_KPIS.filter(kpi => {
    if (filterState.hideF6 && kpi.stage === 'f6') return false;
    if (filterState.hide79 && kpi.stage === '79') return false;
    return true;
  });
}

function beraknaTrendtext(unit, values) {
  const serie = (values || []).filter(v => v != null);
  if (serie.length === 0) return { dir: 'stable', arrow: '→', text: 'Ingen data', analysis: 'Data saknas.', latest: null, diff1: null, diff3: null };
  const latest = serie[serie.length - 1];
  const prev = serie[serie.length - 2] ?? null;
  const idxMinus3 = serie.length - 4; const prev3 = idxMinus3 >= 0 ? serie[idxMinus3] : null;
  const unitSuffix = unit === '%' ? 'p.p.' : unit || '';
  let dir = 'stable', arrow = '→', text = 'Stabil';
  let diff1 = null, diff3 = null;
  if (prev !== null) { diff1 = latest - prev; if (diff1 > 0.05) { dir='improving'; arrow='↑'; } else if (diff1 < -0.05) { dir='declining'; arrow='↓'; } }
  if (prev3 !== null) { diff3 = latest - prev3; const sign = diff3 > 0 ? '+' : ''; text = `${sign}${diff3.toFixed(1)} ${unitSuffix} på 3 år`; }
  else if (prev !== null) { const sign = diff1 > 0 ? '+' : ''; text = `${sign}${diff1.toFixed(1)} ${unitSuffix} på 1 år`; }
  else { text = 'Ingen trenddata'; }
  const analysis = dir === 'improving' ? 'Förbättring över tid.' : dir === 'declining' ? 'Försämring över tid.' : 'Stabil nivå.';
  return { dir, arrow, text, analysis, latest, diff1, diff3 };
}

async function hamtaKpiCardData(ouId, def) {
  const cacheKey = `${ouId}:${def.id}`;
  if (kpiCache.has(cacheKey)) return kpiCache.get(cacheKey);

  const fetchPromise = (async () => {
    try {
      const data = await hamtaKoladaData(ouId, def.id, SKOLENHET_DATA_BASE);
      const hasAny = (data?.totalt || []).some(v => v != null);
      if (!hasAny) {
        return { label: def.label, value: '—', unit: def.unit, trendDirection: 'stable', trendArrow: '→', trendText: 'Ingen data', analysis: 'Data saknas för denna indikator.', trendData: { dir: null, latest: null, diff1: null, diff3: null } };
      }
      const trend = beraknaTrendtext(def.unit, data.totalt);
      return { label: def.label, value: trend.latest != null ? (def.unit === '%' ? Number(trend.latest).toFixed(1) : trend.latest) : '—', unit: def.unit, trendDirection: trend.dir, trendArrow: trend.arrow, trendText: trend.text, analysis: trend.analysis, trendData: { dir: trend.dir, latest: trend.latest, diff1: trend.diff1, diff3: trend.diff3 } };
    } catch (error) {
      console.error('Kunde inte hämta KPI', def.id, error);
      return { label: def.label, value: '—', unit: def.unit, trendDirection: 'stable', trendArrow: '→', trendText: 'Fel vid hämtning', analysis: 'Kunde inte ladda data just nu.', trendData: { dir: null, latest: null, diff1: null, diff3: null } };
    }
  })();

  kpiCache.set(cacheKey, fetchPromise);
  return fetchPromise;
}

function genereraAutomatiskAnalys(kpiData) {
  const insights = [];
  const { elevantal, eleverPerLarare, behorighetLarare, allaAmnen, yrkesprog, meritvarde, trygghet, studiero, engHogreNP, engLagreNP, sveHogreNP, sveLagreNP, engelska, matematik, svenska } = {
    elevantal: kpiData['N15807'],
    eleverPerLarare: kpiData['N15034'],
    behorighetLarare: kpiData['N15813'],
    allaAmnen: kpiData['N15419'],
    yrkesprog: kpiData['N15436'],
    meritvarde: kpiData['N15505'],
    trygghet: kpiData['N15613'],
    studiero: kpiData['N15603'],
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
  if (engHogreNP?.latest && engHogreNP.latest > 15 && engelska?.dir === 'declining') {
    insights.push('⚖️ <strong>Engelska:</strong> Hög andel högre slutbetyg än NP + fallande resultat → risk för glapp i bedömning/NP-matchning.');
  }
  if (engLagreNP?.latest && engLagreNP.latest > 15) {
    insights.push('⚖️ <strong>Engelska:</strong> Hög andel lägre slutbetyg än NP → elever presterar på prov men tappar över tid.');
  }
  if (sveHogreNP?.latest && sveHogreNP.latest > 15 && svenska?.dir === 'declining') {
    insights.push('⚖️ <strong>Svenska:</strong> Hög andel högre slutbetyg än NP + fallande resultat → risk för glapp i bedömning/NP-matchning.');
  }
  if (sveLagreNP?.latest && sveLagreNP.latest > 15) {
    insights.push('⚖️ <strong>Svenska:</strong> Hög andel lägre slutbetyg än NP → elever presterar på prov men tappar över tid.');
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

async function renderSection(sectionId, defs, ouId, kpiData) {
  setLoading(sectionId, true);
  const sectionEl = document.getElementById(sectionId);
  const cards = await Promise.all(defs.map(def => hamtaKpiCardData(ouId, def)));
  sectionEl.innerHTML = '';
  const frag = document.createDocumentFragment();
  cards.forEach((card, index) => {
    frag.appendChild(createKPICard(card));
    kpiData[defs[index].id] = card.trendData;
  });
  sectionEl.appendChild(frag);
  return cards;
}

async function renderSections(ouId) {
  const kpiData = {};
  await Promise.all([
    renderSection('baselineKPIs', BASELINE_KPIS, ouId, kpiData),
    renderSection('salsaKPIs', SALSA_KPIS, ouId, kpiData),
    renderSection('trygghetsKPIs', TRYG_KPIS, ouId, kpiData),
    renderSection('outcomeKPIs', kpiDefsOutcome(), ouId, kpiData)
  ]);

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
