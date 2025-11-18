import {
  DEFAULT_KOMMUN_ID,
  DEFAULT_KPI,
  FILTER_DATASETS,
  RIKET_ID,
  getKpiList
} from './constants.js';
import { ALLA_KOMMUNER } from './kommuner.js';
import {
  genereraAnalysText,
  hamtaKommunData,
  hantaSenastaTvaVarden,
  skapaChartConfig,
  skapaDatasets
} from './chartHelpers.js';

let aktivKPI = DEFAULT_KPI;
let aktivSkoltyp = 'grundskola';
let aktivKommun = DEFAULT_KOMMUN_ID;
let chart;
let allData;

function uppdateraKpiDropdown() {
  const kpiSelect = document.getElementById('kpiSelect');
  const lista = getKpiList(aktivSkoltyp);
  kpiSelect.innerHTML = '';

  lista.forEach(kpi => {
    const option = document.createElement('option');
    option.value = kpi.id;
    option.textContent = `${kpi.id} - ${kpi.namn}`;
    option.selected = kpi.id === aktivKPI;
    kpiSelect.appendChild(option);
  });

  if (!lista.some(kpi => kpi.id === aktivKPI) && lista.length > 0) {
    aktivKPI = lista[0].id;
  }
}

function uppdateraAnalysis(totalt, riketTotalt, ar) {
  const uppdateraBox = (data, arArray, elementId, namn) => {
    const senaste = hantaSenastaTvaVarden(data);
    if (senaste.nuvarande !== undefined && senaste.nuvarande !== null &&
        senaste.forriga !== undefined && senaste.forriga !== null) {
      const validAr = arArray.filter((_, i) => data[i] !== null);
      if (validAr.length >= 2) {
        const nuAr = validAr[validAr.length - 1];
        const forAr = validAr[validAr.length - 2];
        const kpiInfo = getKpiList(aktivSkoltyp).find(k => k.id === aktivKPI) || { namn: aktivKPI };
        document.getElementById(elementId).innerHTML = genereraAnalysText(
          aktivKPI,
          kpiInfo.namn,
          namn,
          senaste.nuvarande,
          senaste.forriga,
          nuAr,
          forAr
        );
      }
    } else {
      document.getElementById(elementId).innerHTML =
        '<p class="analysis-text">Data ej tillgänglig för jämförelse.</p>';
    }
  };

  const kommunNamn = ALLA_KOMMUNER.find(k => k.id === aktivKommun)?.title || 'Okänd kommun';
  uppdateraBox(totalt, ar, 'kommunAnalysis', kommunNamn);
  uppdateraBox(riketTotalt, ar, 'riketAnalysis', 'riket');
}

function visaDataset(event) {
  const typ = event.target.dataset.filter;
  if (!chart || !allData) {
    return;
  }
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
  uppdateraKpiDropdown();
  hamtaData();
}

function bytKPI(kpiKod) {
  aktivKPI = kpiKod;
  const kpiInfo = getKpiList(aktivSkoltyp).find(k => k.id === kpiKod);
  if (kpiInfo) {
    document.getElementById('pageTitle').textContent = `Statistikkompassen: ${kpiInfo.namn}`;
  }
  hamtaData();
}

function bytKommun(kommunId) {
  aktivKommun = kommunId;
  hamtaData();
}

async function hamtaData() {
  try {
    const kommunData = await hamtaKommunData(aktivKommun, aktivKPI);
    const rikeData = await hamtaKommunData(RIKET_ID, aktivKPI);

    uppdateraAnalysis(kommunData.totalt, rikeData.totalt, kommunData.ar);

    const datasets = skapaDatasets(
      kommunData.kvinnor,
      kommunData.man,
      kommunData.totalt,
      rikeData.totalt
    );

    allData = {
      labels: kommunData.ar,
      datasets
    };

    const kpiInfo = getKpiList(aktivSkoltyp).find(k => k.id === aktivKPI) || { namn: aktivKPI };
    const chartTitle = `${kpiInfo.namn} (Sävsjö kommun)`;
    const config = skapaChartConfig(aktivKPI, allData.labels, allData.datasets, chartTitle);
    if (chart) {
      chart.destroy();
    }
    chart = new Chart(document.getElementById('koladaChart'), config);
  } catch (error) {
    console.error('Fel vid hämtning av data:', error);
    document.getElementById('kommunAnalysis').innerHTML =
      '<p class="analysis-text">Fel vid hämtning av data. Försök igen senare.</p>';
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
    bytSkoltyp(event.target.value);
  });

  document.getElementById('kpiSelect')?.addEventListener('change', event => {
    bytKPI(event.target.value);
  });

  document.getElementById('kommunSelect')?.addEventListener('change', event => {
    bytKommun(event.target.value);
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
  hamtaData();
}

document.addEventListener('DOMContentLoaded', init);
