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
import {
  genereraAnalysText,
  hamtaKoladaData,
  hantaSenastaTvaVarden,
  skapaChartConfig,
  skapaDatasets
} from './chartHelpers.js';

let aktivKPI = DEFAULT_KPI;
let aktivSkoltyp = 'grundskola';
let aktivKommun = DEFAULT_KOMMUN_ID;
let aktivSkolenhet = '';
let aktivSkolenhetNamn = '';
let chart;
let allData;
const skolenhetCache = new Map();

function uppdateraSidtitel() {
  const kpiInfo = getKpiList(aktivSkoltyp).find(k => k.id === aktivKPI);
  if (kpiInfo) {
    document.getElementById('pageTitle').textContent = `Statistikkompassen: ${kpiInfo.namn}`;
  }
}

function uppdateraKpiDropdown() {
  const kpiSelect = document.getElementById('kpiSelect');
  const lista = getKpiList(aktivSkoltyp);

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
    notice.textContent = 'Data ej tillgängligt på detta dataset.';
    notice.classList.add('visible');
  } else {
    notice.textContent = '';
    notice.classList.remove('visible');
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

function bytSkoltyp(skoltyp) {
  aktivSkoltyp = skoltyp;

  const lista = getKpiList(aktivSkoltyp);
  if (!lista.some(k => k.id === aktivKPI) && lista.length > 0) {
    aktivKPI = lista[0].id;
  }

  uppdateraKpiDropdown();
  uppdateraSkolenhetDropdown();
  hamtaData();
}

function bytKPI(kpiKod) {
  aktivKPI = kpiKod;
  uppdateraSidtitel();
  hamtaData();
}

function bytKommun(kommunId) {
  aktivKommun = kommunId;
  aktivSkolenhet = '';
  aktivSkolenhetNamn = '';
  uppdateraSkolenhetDropdown();
  hamtaData();
}

function bytSkolenhet(skolenhetId, skolenhetNamn, skolenhetTyp = '') {
  aktivSkolenhet = skolenhetId;
  aktivSkolenhetNamn = skolenhetId ? skolenhetNamn : '';

  // Debug: log when a school unit is changed
  console.log('bytSkolenhet called:', { aktivSkolenhet, aktivSkolenhetNamn });

  const typ = skolenhetTyp.includes('forskola') ? 'forskola' : skolenhetTyp.includes('grund') ? 'grundskola' : '';
  if (typ && typ !== aktivSkoltyp) {
    aktivSkoltyp = typ;
    document.getElementById('skolTypSelect').value = typ;
    uppdateraKpiDropdown();
  } else {
    const lista = getKpiList(aktivSkoltyp);
    if (!lista.some(k => k.id === aktivKPI) && lista.length > 0) {
      aktivKPI = lista[0].id;
      uppdateraKpiDropdown();
    }
  }

  hamtaData();
}

async function hamtaSkolenheterForKommun(kommunId) {
  if (skolenhetCache.has(kommunId)) {
    return skolenhetCache.get(kommunId);
  }

  let url = `${SKOLENHET_SEARCH_API}?municipality=${kommunId}&per_page=500`;
  const enheter = [];

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
      enheter.push({
        id: enhet.id,
        title: enhet.title,
        type: (enhet.type || enhet.type_name || '').toLowerCase()
      });
    });

    url = data.next_page || data.next || null;
  }

  enheter.sort((a, b) => a.title.localeCompare(b.title, 'sv'));
  skolenhetCache.set(kommunId, enheter);
  return enheter;
}

function filtreraSkolenheter(enheter) {
  if (!enheter.length) return enheter;

  const normalize = value =>
    (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');

  const nyckelordLista = aktivSkoltyp === 'forskola'
    ? ['forskol', 'forskola', 'forskoleklass']
    : ['grundskola', 'grund', 'skola', 'grskola', 'gr skola', 'kommunal grundskola'];

  const filtrerade = enheter.filter(enhet => {
    const s = normalize(enhet.type + ' ' + enhet.title);
    return nyckelordLista.some(nyckel => s.includes(nyckel));
  });

  return filtrerade.length ? filtrerade : enheter;
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
    const filtrerade = filtreraSkolenheter(allaEnheter);

    if (!filtrerade.length) {
      const infoOption = document.createElement('option');
      infoOption.value = '';
      infoOption.textContent = 'Inga skolenheter hittades';
      select.appendChild(infoOption);
    } else {
      filtrerade.forEach(enhet => {
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
    const isCors = error instanceof TypeError && /fetch/i.test(error.message);
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
    chart = new Chart(document.getElementById('koladaChart'), config);
  } catch (error) {
    const isCors = error instanceof TypeError && /fetch/i.test(error.message);
    console.error('Fel vid hämtning av data:', error);
    document.getElementById('kommunAnalysis').innerHTML =
      isCors
        ? '<p class="analysis-text">Kunde inte hämta data på grund av nätverks- eller CORS-fel. Kontrollera att API:et är tillgängligt.</p>'
        : '<p class="analysis-text">Fel vid hämtning av data. Försök igen senare.</p>';
    uppdateraDatasetNotice(true);
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
  document.getElementById('skolTypSelect')?.addEventListener('change', event => {
    aktivSkolenhet = '';
    aktivSkolenhetNamn = '';
    bytSkoltyp(event.target.value);
  });

  document.getElementById('kpiSelect')?.addEventListener('change', event => {
    bytKPI(event.target.value);
  });

  document.getElementById('kommunSelect')?.addEventListener('change', event => {
    bytKommun(event.target.value);
  });

  document.getElementById('skolenhetSelect')?.addEventListener('change', event => {
    const option = event.target.selectedOptions[0];
    const skolenhetTyp = option?.dataset?.type || '';
    bytSkolenhet(event.target.value, option ? option.textContent : '', skolenhetTyp);
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

function init() {
  initKommunDropdown();
  initFilters();
  initSelectors();
  initCopyButton();
  uppdateraKpiDropdown();
  uppdateraSkolenhetDropdown();
  hamtaData();
}

// 🚀 Kör direkt
init();
