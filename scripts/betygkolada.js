import {
  DEFAULT_KOMMUN_ID,
  DEFAULT_KPI,
  FILTER_DATASETS,
  RIKET_ID,
  SKOLENHET_DATA_BASE,
  SKOLENHET_SEARCH_API,
  getKpiList
} from './constants.js';
import { ALLA_KOMMUNER } from './kommuner.js';
import { getPredefinedSkolenheter } from './skolenheter.js';
import {
  genereraAnalysText,
  hamtaKoladaData,
  hantaSenastaTvaVarden,
  skapaChartConfig,
  skapaDatasets
} from './chartHelpers.js';

const documentSkoltyp = (document.body?.dataset?.skoltyp || '').toLowerCase();
let aktivSkoltyp = documentSkoltyp === 'forskola' ? 'forskola' : 'grundskola';
let aktivKPI = DEFAULT_KPI;
let aktivKommun = DEFAULT_KOMMUN_ID;
let aktivSkolenhet = '';
let aktivSkolenhetNamn = '';
let chart;
let allData;
const skolenhetCache = new Map();

// OU-stödda KPIer från skolenhetsdashboard (dessa finns på skolenhetsnivå)
const OU_SUPPORTED_KPIS = new Set([
  'N15033',  // Antal elever grundskolan
  'N15438',  // Elever per lärare
  'N15447',  // Andel lärare med ped. högskoleexamen
  'N15561',  // Åk 6: E i svenska
  'N15559',  // Åk 6: E i matematik
  'N15560',  // Åk 6: E i engelska
  'N15419',  // Åk 9: behöriga till yrkesprogram
  'N15421',  // Åk 9: genomsnittligt meritvärde
  'N15414',  // Åk 9: betygspoäng matematik
  'U15423',  // SALSA: avvikelse behörighet yrkesprogram
  'U15424',  // SALSA: avvikelse meritvärde
  'N15481',  // Åk 6: E engelska fristående
  'N15482',  // Åk 6: E engelska kommunala
  'N15483',  // Åk 6: E matematik lägeskommun
  'N15484',  // Åk 6: E matematik fristående
  'N15485',  // Åk 6: E matematik kommunala
  'N15503',  // Åk 9: betygspoäng matematik genomsnitt
  'N15504',  // Åk 9: meritvärde lägeskommun
  'N15505',  // Åk 9: meritvärde kommunala
  'N15506',  // Åk 9: meritvärde fristående
  'N15502',  // Åk 9: E svenska kommunala
  'U15414',  // Åk 9: avvikelse SALSA betygskriterier
  'U15415',  // Åk 9: meritvärde modellberäknat SALSA
  'U15416'   // Åk 9: meritvärde avvikelse SALSA
]);

function filtreraKpiForOu(lista) {
  // Kommunnivå: returnera ofiltrerat
  if (!aktivSkolenhet) return lista;
  // Skolenhetsnivå: filtrera till endast OU-stödda KPIer
  return lista.filter(k => OU_SUPPORTED_KPIS.has(k.id));
}

function uppdateraSidtitel() {
  const kpiInfo = getKpiList(aktivSkoltyp).find(k => k.id === aktivKPI);
  if (kpiInfo) {
    document.getElementById('pageTitle').textContent = `Statistikkompassen: ${kpiInfo.namn}`;
  }
}

function uppdateraKpiDropdown() {
  const kpiSelect = document.getElementById('kpiSelect');
  const fullLista = getKpiList(aktivSkoltyp);
  // Om skolenhet: filtrera till endast OU-stödda KPIer
  const lista = filtreraKpiForOu(fullLista);

  if (!lista.length) {
    kpiSelect.innerHTML = '';
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = aktivSkolenhet
      ? 'Inga KPI:er har Kolada OU-data'
      : 'Inga KPI:er tillgängliga';
    opt.disabled = true;
    opt.selected = true;
    kpiSelect.appendChild(opt);
    kpiSelect.disabled = true;
    return;
  }
  kpiSelect.disabled = false;

  if (!lista.some(kpi => kpi.id === aktivKPI) && lista.length > 0) {
    aktivKPI = lista[0].id;
  }

  kpiSelect.innerHTML = '';

  lista.forEach(kpi => {
    const option = document.createElement('option');
    option.value = kpi.id;
    option.textContent = `${kpi.id} - ${kpi.namn}`;
    option.selected = kpi.id === aktivKPI;
    kpiSelect.appendChild(option);
  });

  kpiSelect.value = aktivKPI;
  uppdateraSidtitel();
}

function uppdateraSkoltypSelect() {
  const select = document.getElementById('skolTypSelect');
  if (select) {
    select.value = aktivSkoltyp;
  }
}

function skapaAnalysInnehall(data = [], arArray = [], namn) {
  const senaste = hantaSenastaTvaVarden(data);
  if (senaste.nuvarande != null && senaste.forriga != null) {
    const validAr = arArray.filter((_, i) => data[i] !== null);
    if (validAr.length >= 2) {
      const nuAr = validAr[validAr.length - 1];
      const forAr = validAr[validAr.length - 2];
      const kpiInfo = getKpiList(aktivSkoltyp).find(k => k.id === aktivKPI) || { namn: aktivKPI };
      return genereraAnalysText(
        aktivKPI,
        kpiInfo.namn,
        namn,
        senaste.nuvarande,
        senaste.forriga,
        nuAr,
        forAr
      );
    }
  }
  return '<p class="analysis-text">Data ej tillgänglig för jämförelse.</p>';
}

function uppdateraKommunAnalysis(data, ar, namn) {
  const titelElement = document.getElementById('lokalAnalysisTitle');
  if (titelElement) {
    titelElement.textContent = `📊 ${namn}`;
  }
  document.getElementById('kommunAnalysis').innerHTML = skapaAnalysInnehall(data, ar, namn);
}

function uppdateraRiketAnalysis(data, ar) {
  document.getElementById('riketAnalysis').innerHTML = skapaAnalysInnehall(data, ar, 'riket');
}

function uppdateraAnalysis(lokalData, lokalAr, riketData, riketAr, lokalNamn) {
  uppdateraKommunAnalysis(lokalData, lokalAr, lokalNamn);
  uppdateraRiketAnalysis(riketData, riketAr);
}

function visaIngenDataAnalys(lokalNamn) {
  const titelElement = document.getElementById('lokalAnalysisTitle');
  if (titelElement) {
    titelElement.textContent = `📊 ${lokalNamn}`;
  }
  document.getElementById('kommunAnalysis').innerHTML =
    '<p class="analysis-text">Data ej tillgängligt på detta dataset.</p>';
}

function datasetHarVarden(dataArray = []) {
  return dataArray.some(v => v != null);
}

function uppdateraDatasetNotice(hasData) {
  const notice = document.getElementById('datasetNotice');
  if (!notice) return;

  if (!hasData) {
    if (aktivSkolenhet) {
      notice.textContent = `⚠️ Ingen data tillgänglig för vald skolenhet (${aktivSkolenhetNamn || 'okänd'}) och KPI ${aktivKPI}. Detta KPI finns troligen inte rapporterat på organisationsenhetsnivå.`;
      notice.classList.add('no-data');
    } else {
      notice.textContent = 'Data ej tillgängligt för vald kommun och KPI.';
    }
    notice.classList.add('visible');
  } else {
    notice.textContent = '';
    notice.classList.remove('visible', 'no-data');
  }
}

function hamtaKommunNamn(id) {
  return ALLA_KOMMUNER.find(k => k.id === id)?.title || 'Okänd kommun';
}

function getAktivLokalNamn() {
  if (aktivSkolenhet) return aktivSkolenhetNamn || 'Vald skolenhet';
  const kommunNamn = hamtaKommunNamn(aktivKommun);
  return kommunNamn.toLowerCase().includes('kommun') ? kommunNamn : `${kommunNamn} kommun`;
}

function visaDataset(event) {
  const typ = event.target.dataset.filter;
  if (!chart || !allData) return;

  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');

  const visibleDatasets = FILTER_DATASETS[typ] || FILTER_DATASETS.alla;
  allData.datasets.forEach((dataset, index) => {
    chart.getDatasetMeta(index).hidden = !visibleDatasets.includes(index);
  });

  chart.update();
}

async function bytSkoltyp(skoltyp) {
  aktivSkoltyp = skoltyp;

  const lista = getKpiList(aktivSkoltyp);
  if (!lista.some(k => k.id === aktivKPI) && lista.length > 0) {
    aktivKPI = lista[0].id;
  }

  uppdateraKpiDropdown();
  await uppdateraSkolenhetDropdown();
  await hamtaData();
}

async function bytKPI(kpiKod) {
  aktivKPI = kpiKod;
  console.log('bytKPI called, ny KPI:', kpiKod);
  // Uppdatera dropdown‑listan ifall KPI‑listan beror på skoltyp (t.ex. vid byte av enhet)
  uppdateraKpiDropdown();
  uppdateraSidtitel();
  // Visa laddningsmeddelande i analysrutorna så att användaren ser att data uppdateras
  document.getElementById('kommunAnalysis').innerHTML = '<p class="analysis-text">Hämtar data...</p>';
  document.getElementById('riketAnalysis').innerHTML = '<p class="analysis-text">Hämtar data...</p>';
  await hamtaData();
}

async function bytKommun(kommunId) {
  aktivKommun = kommunId;
  aktivSkolenhet = '';
  aktivSkolenhetNamn = '';
  await uppdateraSkolenhetDropdown();
  await hamtaData();
}

async function bytSkolenhet(skolenhetId, skolenhetNamn, skolenhetTyp = '') {
  // Om användaren väljer "Hela kommunen" (tomt ID), återställ till kommunnivå
  if (!skolenhetId) {
    aktivSkolenhet = '';
    aktivSkolenhetNamn = '';
    console.log('Återställer till kommunnivå');
    uppdateraKpiDropdown();
    await hamtaData();
    return;
  }

  aktivSkolenhet = skolenhetId;
  aktivSkolenhetNamn = skolenhetNamn || '';

  // Debug: log when a school unit is changed
  console.log('bytSkolenhet called:', { aktivSkolenhet, aktivSkolenhetNamn });

  // Försök bestämma skoltyp utifrån enhetens ID‑prefix (V11E = förskola, V15E = grundskola)
  let typ = '';
  if (skolenhetId) {
    if (skolenhetId.startsWith('V11E')) typ = 'forskola';
    else if (skolenhetId.startsWith('V15E')) typ = 'grundskola';
  }
  // Fallback: använd eventuell typ‑information från data‑attributet (om den finns)
  if (!typ && skolenhetTyp) {
    typ = skolenhetTyp.includes('forskola') ? 'forskola' : skolenhetTyp.includes('grund') ? 'grundskola' : '';
  }

  if (typ && typ !== aktivSkoltyp) {
    aktivSkoltyp = typ;
    document.getElementById('skolTypSelect').value = typ;
  }
  // Uppdatera KPI-listan (filtrerar till OU-stödda KPI:er vid skolenhet)
  uppdateraKpiDropdown();
  // Efter att enheten har valts (och eventuella KPI‑ändringar har hanterats) hämta ny data och uppdatera diagrammet
  await hamtaData();
}

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
        headers: {
          Accept: 'application/json'
        }
      });
      if (!response.ok) throw new Error('Kunde inte hämta skolenheter');
      const data = await response.json();
      const resultat = data.results || data.values || [];

      resultat.forEach(enhet => {
        // Undvik dubbletter om samma enhet redan finns förladdad
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
    // Om förladdade enheter finns, returnera dem även om API‑anropet misslyckas
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

async function uppdateraSkolenhetDropdown() {
  const select = document.getElementById('skolenhetSelect');
  if (!select) return;

  select.innerHTML = '';
  select.disabled = true;

  let valdSkolenhetFinns = false;

  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Hela kommunen (samlad nivå)';
  select.appendChild(defaultOption);

  try {
    const allaEnheter = await hamtaSkolenheterForKommun(aktivKommun);

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
        option.dataset.type = enhet.type;
        option.selected = enhet.id === aktivSkolenhet;
        if (option.selected) {
          valdSkolenhetFinns = true;
        }
        select.appendChild(option);
      });
    }
  } catch (error) {
    const isCors = error instanceof TypeError;
    console.error('Kunde inte hämta skolenheter', error);
    const errorOption = document.createElement('option');
    errorOption.value = '';
    errorOption.textContent = isCors
      ? 'Kunde inte hämta skolenheter (CORS eller nätverksfel)'
      : 'Kunde inte hämta skolenheter';
    select.appendChild(errorOption);
  } finally {
    if (!valdSkolenhetFinns) {
      aktivSkolenhet = '';
      aktivSkolenhetNamn = '';
    }
    select.disabled = false;
    select.value = aktivSkolenhet;
  }
}

async function hamtaData() {
  try {
    console.log('hamtaData invoked for', aktivSkolenhet ? 'skolenhet' : 'kommun', aktivSkolenhet || aktivKommun);
    const lokalId = aktivSkolenhet || aktivKommun;
    const lokalApi = aktivSkolenhet ? SKOLENHET_DATA_BASE : undefined;
    const lokalData = await hamtaKoladaData(lokalId, aktivKPI, lokalApi);
    const rikeData = await hamtaKoladaData(RIKET_ID, aktivKPI);

    const lokalNamn = getAktivLokalNamn();
    const harLokalData = datasetHarVarden(lokalData.totalt);
    uppdateraDatasetNotice(harLokalData);

    // Visa/dölj chart beroende på om data finns
    const chartCanvas = document.getElementById('koladaChart');
    const copyBtn = document.getElementById('copyChartBtn');
    const updateBtn = document.getElementById('updateChartBtn');
    
    if (!harLokalData && aktivSkolenhet) {
      // Om det är en skolenhet och ingen data finns - dölj chart helt
      console.warn('Ingen OU-data tillgänglig för', aktivKPI, 'på', lokalNamn);
      if (chartCanvas) chartCanvas.style.display = 'none';
      if (copyBtn) copyBtn.style.display = 'none';
      if (updateBtn) updateBtn.style.display = 'none';
      
      visaIngenDataAnalys(lokalNamn);
      uppdateraRiketAnalysis(rikeData.totalt, rikeData.ar);
      
      if (chart) {
        chart.destroy();
        chart = null;
      }
      uppdateraSidtitel();
      return;
    }

    // Visa chart om data finns eller om det är kommun-nivå
    if (chartCanvas) chartCanvas.style.display = 'block';
    if (copyBtn) copyBtn.style.display = 'block';
    if (updateBtn) updateBtn.style.display = 'block';

    if (harLokalData) {
      uppdateraAnalysis(lokalData.totalt, lokalData.ar, rikeData.totalt, rikeData.ar, lokalNamn);
    } else {
      visaIngenDataAnalys(lokalNamn);
      uppdateraRiketAnalysis(rikeData.totalt, rikeData.ar);
    }

    const datasets = skapaDatasets(
      lokalData.kvinnor,
      lokalData.man,
      lokalData.totalt,
      rikeData.totalt
    );

    const labels = lokalData.ar.length ? lokalData.ar : rikeData.ar;
    allData = { labels, datasets };

    const kpiInfo = getKpiList(aktivSkoltyp).find(k => k.id === aktivKPI) || { namn: aktivKPI };
    const chartTitle = `${kpiInfo.namn} (${lokalNamn})`;
    const config = skapaChartConfig(aktivKPI, labels, datasets, chartTitle);

    if (chart) chart.destroy();
    chart = new Chart(chartCanvas, config);
    // Uppdatera sidrubriken så den alltid visar det valda KPI‑namnet (kan ha ändrats vid enhetsval)
    uppdateraSidtitel();
  } catch (error) {
    const isCors = error instanceof TypeError;
    console.error('Fel vid hämtning av data:', error);
    document.getElementById('kommunAnalysis').innerHTML =
      isCors
        ? '<p class="analysis-text">Kunde inte hämta data på grund av nätverks- eller CORS-fel. Kontrollera att API:et är tillgängligt.</p>'
        : '<p class="analysis-text">Fel vid hämtning av data. Försök igen senare.</p>';
    uppdateraDatasetNotice(false);
    
    // Dölj chart vid fel
    const chartCanvas = document.getElementById('koladaChart');
    const copyBtn = document.getElementById('copyChartBtn');
    const updateBtn = document.getElementById('updateChartBtn');
    if (chartCanvas) chartCanvas.style.display = 'none';
    if (copyBtn) copyBtn.style.display = 'none';
    if (updateBtn) updateBtn.style.display = 'none';
  }
}

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

function initFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', visaDataset);
  });
}

function initSelectors() {
  uppdateraSkoltypSelect();
  document.getElementById('skolTypSelect')?.addEventListener('change', async event => {
    aktivSkolenhet = '';
    aktivSkolenhetNamn = '';
    await bytSkoltyp(event.target.value);
  });

  document.getElementById('kpiSelect')?.addEventListener('change', async event => {
    await bytKPI(event.target.value);
  });

  document.getElementById('kommunSelect')?.addEventListener('change', async event => {
    await bytKommun(event.target.value);
  });

  document.getElementById('skolenhetSelect')?.addEventListener('change', async event => {
    const option = event.target.selectedOptions[0];
    const skolenhetTyp = option?.dataset?.type || '';
    await bytSkolenhet(event.target.value, option ? option.textContent : '', skolenhetTyp);
  });
}

function initCopyButton() {
  document.getElementById('copyChartBtn')?.addEventListener('click', async () => {
    const canvas = document.getElementById('koladaChart');
    if (canvas) {
      canvas.toBlob(async function(blob) {
        try {
          await navigator.clipboard.write([
            new window.ClipboardItem({ 'image/png': blob })
          ]);
          const btn = document.getElementById('copyChartBtn');
          const oldText = btn.textContent;
          btn.textContent = '✅ Kopierad!';
          setTimeout(() => { btn.textContent = oldText; }, 1500);
        } catch (err) {
          alert('Kunde inte kopiera bilden. Prova en modern webbläsare.');
        }
      }, 'image/png');
    }
  });
}

function initUpdateButton() {
  document.getElementById('updateChartBtn')?.addEventListener('click', () => {
    console.log('Manuell uppdatering av diagrammet initierad');
    hamtaData();
  });
}

async function init() {
  const initialKpiList = getKpiList(aktivSkoltyp);
  if (!initialKpiList.some(kpi => kpi.id === aktivKPI) && initialKpiList.length > 0) {
    aktivKPI = initialKpiList[0].id;
  }

  initKommunDropdown();
  initFilters();
  initSelectors();
  initCopyButton();
  initUpdateButton(); // Ny knapp för manuell uppdatering
  uppdateraKpiDropdown();
  await uppdateraSkolenhetDropdown();
  await hamtaData();
}

// 🚀 Kör direkt
init().catch(err => console.error('Init failed', err));
