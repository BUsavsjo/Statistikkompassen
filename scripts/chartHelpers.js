import { API_BASE, DATASET_CONFIG, getKpiMetadata } from './constants.js';

/**
 * Hämtar Kolada‑data för kommun eller skolenhet.
 * - Kommunnivå: använder path‑formatet (som tidigare).
 * - Skolenhetsnivå (OU): använder querystring‑formatet som Kolada v2 kräver.
 *
 * apiBase:
 *  - API_BASE (kommun) t.ex. https://api.kolada.se/v2/municipality
 *  - SKOLENHET_DATA_BASE (enhet) t.ex. https://api.kolada.se/v2/data
 */
export async function hamtaKoladaData(kommunKod, kpiKod, apiBase = API_BASE) {
  const ar = [];
  const kvinnor = [];
  const man = [];
  const totalt = [];

  // Kolada OU‑id börjar normalt med V11E (förskola) eller V15E (grundskola)
  const arOuId = typeof kommunKod === 'string' && /^V(11|15|17)E/i.test(kommunKod);

  // Bygg URL beroende på nivå
  // Kommun:  /<kommun>/kpi/<kpi>
  // OU:      /data?kpi=<kpi>&ou=<ou>
  const url = arOuId
    ? `${apiBase}?kpi=${encodeURIComponent(kpiKod)}&ou=${encodeURIComponent(kommunKod)}`
    : `${apiBase}/${encodeURIComponent(kommunKod)}/kpi/${encodeURIComponent(kpiKod)}`;

  const response = await fetch(url, {
    mode: 'cors',
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`Kunde inte hämta data (${response.status})`);
  }

  const json = await response.json();

  // Både kommun‑ och OU‑endpointen returnerar values‑lista med perioder
  (json.values || []).forEach(entry => {
    ar.push(entry.period);

    const varden = { K: null, M: null, T: null };
    (entry.values || []).forEach(varde => {
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
  const metadata = getKpiMetadata(aktivKPI);
  const unit = metadata?.unit === 'currency' ? 'currency' : 'percent';
  const yLabel = unit === 'currency' ? 'Kostnad (kr)' : 'Procent (%)';
  const yTicksCallback = unit === 'currency'
    ? function(value) { return value.toLocaleString() + ' kr'; }
    : undefined;
  const yMax = unit === 'percent' ? 100 : undefined;

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
          ticks: yTicksCallback ? { callback: yTicksCallback } : {}
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
  const metadata = getKpiMetadata(aktivKPI);
  const enhet = metadata?.unit === 'currency' ? 'kr' : '%';

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
  const metadata = getKpiMetadata(aktivKPI);
  const valueUnit = metadata?.unit === 'currency' ? 'kr' : '%';

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
