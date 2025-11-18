import { API_BASE, DATASET_CONFIG } from './constants.js';

export async function hamtaKommunData(kommunKod, kpiKod, apiBase = API_BASE) {
  const url = `${apiBase}/${kommunKod}/kpi/${kpiKod}`;
  const response = await fetch(url);
  const json = await response.json();

  const ar = [];
  const kvinnor = [];
  const man = [];
  const totalt = [];

  json.values.forEach(entry => {
    ar.push(entry.period);
    const varden = { K: null, M: null, T: null };
    entry.values.forEach(varde => {
      varden[varde.gender] = varde.value;
    });
    kvinnor.push(varden.K);
    man.push(varden.M);
    totalt.push(varden.T);
  });

  return { ar, kvinnor, man, totalt };
}

export function skapaDatasets(kvinnor, man, totalt, riketTotalt) {
  const data = [kvinnor, man, totalt, riketTotalt];

  return DATASET_CONFIG.map((config, index) => ({
    label: config.label,
    data: data[index],
    borderColor: config.color,
    borderDash: config.dashed ? [5, 5] : [],
    fill: false
  }));
}

export function skapaChartConfig(aktivKPI, labels, datasets, titleText = 'Andel behöriga') {
  let yLabel = 'Procent (%)';
  let yTicksCallback;
  let yMax = 100;

  if (aktivKPI === 'N11032') {
    yLabel = 'Kostnad (kr)';
    yTicksCallback = function(value) { return value.toLocaleString() + ' kr'; };
    yMax = undefined;
  }

  return {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: titleText
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          max: yMax,
          title: { display: true, text: yLabel },
          ticks: yTicksCallback ? { callback: yTicksCallback } : {},
        },
        x: {
          title: { display: true, text: 'År' }
        }
      }
    }
  };
}

export function hantaSenastaTvaVarden(data) {
  const validVarden = data.filter(v => v !== null);
  return {
    nuvarande: validVarden[validVarden.length - 1],
    forriga: validVarden[validVarden.length - 2]
  };
}

export function beraknaTrend(aktivKPI, skillnad) {
  const andel = skillnad.toFixed(2);
  let enhet = '%';
  if (aktivKPI === 'N11032') {
    enhet = 'kr';
  }
  if (skillnad > 0) {
    return `går <span class="trend-up">upp med ${Math.abs(andel)} ${enhet} ⬆️</span>`;
  } else if (skillnad < 0) {
    return `går <span class="trend-down">ner med ${Math.abs(andel)} ${enhet} ⬇️</span>`;
  }
  return 'förblir <span class="trend-neutral">oförändrad ➡️</span>';
}

export function genereraAnalysText(aktivKPI, kpiNamn, namn, nuvarandeVarde, forrigaVarde, nuvarandeAr, forrigaAr) {
  if (nuvarandeVarde === null || forrigaVarde === null) {
    return '<p class="analysis-text">Data ej tillgänglig för jämförelse.</p>';
  }

  const skillnad = nuvarandeVarde - forrigaVarde;
  const trend = beraknaTrend(aktivKPI, skillnad);
  let valueUnit = aktivKPI === 'N11032' ? 'kr' : '%';

  return `
        <p class="analysis-text">
          Valt mätvärde (<strong>${kpiNamn}</strong>) i ${namn} ${trend} från föregående år.
        </p>
        <p class="analysis-text">
          <strong>${nuvarandeAr}:</strong> ${nuvarandeVarde.toLocaleString()} ${valueUnit} |
          <strong>${forrigaAr}:</strong> ${forrigaVarde.toLocaleString()} ${valueUnit}
        </p>
      `;
}
