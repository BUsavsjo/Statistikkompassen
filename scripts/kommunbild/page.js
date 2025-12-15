// Kommunbild – separat logik så skolenhetsdashboard inte påverkas.
// Denna modul är fristående från scripts/skolenhetsdashboard/page.js

import { ALLA_KOMMUNER } from "../kommuner.js";

const KOLADA_BASE = "https://api.kolada.se/v3";
const KOLADA_DATA_BASE = `${KOLADA_BASE}/data/kpi`;

const kpiMetaCache = new Map();
const allMunicipalitiesCache = new Map(); // Cache for fetchAllMunicipalitiesForYear
const municipalityValueCache = new Map(); // Cache for individual municipality values

const DEFAULTS = {
  municipalityId: "0684", // Sävsjö (bra för dev)
  maxParallelFetches: 3, // Reduced from 6 to 3 for better mobile performance
  year: 2024,
};

/**
 * Kommunbild KPI-konfiguration
 * NOTE: Detta är en startuppsättning. Lägg in hela KPI-listan enligt spec när du skickar den igen.
 */
const KPI_BLOCKS = [
  {
    title: "Övergripande kvalitet och index",
    kpis: [
      { id: "U15456", label: "Åk 9: Alla ämnen godkända (modellberäknat)", unit: "%", higherIsBetter: true, kpi_type: "U", rankable: true, comparison_type: "median" },
    ],
  },
  {
    title: "Kunskapsresultat – betyg och måluppfyllelse",
    kpis: [
      { id: "N15505", label: "Meritvärde åk 9 (kommunala skolor)", unit: "p", higherIsBetter: true, kpi_type: "N", rankable: true },
      { id: "N15419", label: "Åk 9: Alla ämnen godkända (kommunala skolor)", unit: "%", higherIsBetter: true, kpi_type: "N", rankable: true },
      { id: "N15436", label: "Åk 9: Behöriga till yrkesprogram (kommunala skolor)", unit: "%", higherIsBetter: true, kpi_type: "N", rankable: true },
      { id: "N15540", label: "Andel elever i åk 6 som uppnått kunskapskraven i alla ämnen", unit: "%", higherIsBetter: true, kpi_type: "N", rankable: true },
    ],
  },
  {
    title: "Nationella prov – genomförande",
    kpis: [
      { id: "N15473", label: "Elever i åk 3 som klarat alla delar av nationella proven för ämnesprovet i matematik, hemkommun, andel (%)", unit: "%", higherIsBetter: true, kpi_type: "N", rankable: true },
      { id: "N15472", label: "Elever i åk 3 som klarat alla delar av nationella proven för ämnesprovet i svenska och svenska som andraspråk, hemkommun, andel (%)", unit: "%", higherIsBetter: true, kpi_type: "N", rankable: true },
    ],
  },
  {
    title: "Trygghet – elever",
    kpis: [
      { id: "N15613", label: "Trygghet i skolan åk 5", unit: "index", higherIsBetter: true, kpi_type: "N", rankable: true },
      { id: "N15643", label: "Trygghet i skolan åk 8", unit: "index", higherIsBetter: true, kpi_type: "N", rankable: true },
    ],
  },
  {
    title: "Trygghet och studiero – personal",
    kpis: [
      { id: "N15313", label: "Pedagogisk personal: studiero på lektioner", unit: "index", higherIsBetter: true, kpi_type: "N", rankable: true },
      { id: "N15331", label: "Uppföljning av elevers upplevelse av studiero", unit: "index", higherIsBetter: true, kpi_type: "N", rankable: true },
    ],
  },
];

// Index-tabell KPI:er (visas i separat tabell)
const INDEX_KPIS = [
  { id: "U15401", label: "Kvalitetsindex grundskola", unit: "index", higherIsBetter: true, kpi_type: "U", rankable: true, comparison_type: "median" },
  { id: "U15900", label: "Effektivitetsindex kommunal grundskola F-9", unit: "index", higherIsBetter: true, kpi_type: "U", rankable: true, comparison_type: "median" },
  { id: "U15010", label: "Resursindex kommunal grundskola F-9", unit: "index", higherIsBetter: true, kpi_type: "U", rankable: true, comparison_type: "median" },
  { id: "U15200", label: "Medarbetarengagemang grundskola och förskoleklass", unit: "index", higherIsBetter: true, kpi_type: "U", rankable: true, comparison_type: "median" },
  { id: "U15402", label: "Elevenkätsindex åk 8", unit: "index", higherIsBetter: true, kpi_type: "U", rankable: true, comparison_type: "median" },
];

// KPIs that should show a 5-year trend line
// KPIs that should show a 5-year trend with comparison to all municipalities
const TREND_KPI_IDS = new Set(["U15401", "U15456", "N15505", "N15419", "N15436", "N15540"]);

// KPIs that should show mini-trend (2-3 years) - enkätkort
const MINI_TREND_KPI_IDS = new Set(["U15402", "U15200"]);

// Optional: per-KPI referenskälla för svart linje.
// Om värdet är olika från KPI själv → hämtar per-kommun-värde från det KPI:t.
// Om värdet är samma som KPI → hämtar median över alla kommuner för det KPI:t.
// N15505, N15419, N15436, N15540 har egen specialhantering: använder riket (0000) istället för median
const REFERENCE_MEDIAN_OVERRIDE = {
  U15456: null,  // null = standard median över alla för U15456
  N15419: null,
  N15436: null,
  N15540: null,
  U15401: null,
};

// Mock-data för svart linje (referensvärde) som fallback när riktiga anrop misslyckas
// N15505, N15419, N15436, N15540 = riket (0000), övriga = alla kommuner median
const MOCK_REFERENCE_DATA = {
  U15456: { 2020: 71.4, 2021: 71.95, 2022: 69.57, 2023: 68.85, 2024: 67.49 },
  N15419: { 2020: 85.2, 2021: 84.9, 2022: 84.3, 2023: 83.8, 2024: 83.2 }, // Riket
  N15436: { 2020: 91.3, 2021: 91.1, 2022: 90.8, 2023: 90.5, 2024: 90.2 }, // Riket
  N15540: { 2020: 78.5, 2021: 78.2, 2022: 77.8, 2023: 77.4, 2024: 77.0 }, // Riket
  U15401: { 2020: 52.3, 2021: 51.8, 2022: 50.9, 2023: 50.5, 2024: 50.17 },
  N15505: { 2020: 227.4, 2021: 226.8, 2022: 225.9, 2023: 225.2, 2024: 224.6 }, // Riket
};

const ORG_KPIS = [
  { id: "U15011", label: "Nettokostnad per elev grundskolan", unit: "kr", higherIsBetter: false },
  { id: "N15006", label: "Kostnad grundskola åk 1-9 hemkommun, kr/elev", unit: "kr", higherIsBetter: false },
  { id: "N15031", label: "Lärare med pedagogisk högskoleexamen", unit: "%", higherIsBetter: true },
  { id: "N15814", label: "Lärare med legitimation och behörighet", unit: "%", higherIsBetter: true },
  { id: "N15034", label: "Elever/lärare grundskola", unit: "antal", higherIsBetter: false },
  { id: "U15200", label: "Medarbetarengagemang grundskola och förskoleklass", unit: "index", higherIsBetter: true, kpi_type: "U", rankable: true, comparison_type: "median" },
];

function $(id) {
  return document.getElementById(id);
}

function requireEl(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}
function generateExecutiveSummary(blockResults) {
  // Flatten all KPIs from all blocks
  const allKpis = blockResults.flatMap((br) => br.kpis);
  
  // Filter out invalid KPIs
  const validKpis = allKpis.filter((r) => 
    r.current !== null && 
    r.previous !== null &&
    r.refMedian !== null
  );

  if (validKpis.length === 0) return null;

  // Find biggest improvement
  const improvements = validKpis
    .map((r) => ({
      ...r,
      change: numberOrNull(r.current) - numberOrNull(r.previous),
      changePercent: ((numberOrNull(r.current) - numberOrNull(r.previous)) / Math.abs(numberOrNull(r.previous))) * 100
    }))
    .filter((r) => r.change > 0);
  
  const biggestImprovement = improvements.length > 0
    ? improvements.reduce((best, curr) => Math.abs(curr.change) > Math.abs(best.change) ? curr : best)
    : null;

  // Find biggest decline
  const declines = validKpis
    .map((r) => ({
      ...r,
      change: numberOrNull(r.current) - numberOrNull(r.previous),
      changePercent: ((numberOrNull(r.current) - numberOrNull(r.previous)) / Math.abs(numberOrNull(r.previous))) * 100
    }))
    .filter((r) => r.change < 0);
  
  const biggestDecline = declines.length > 0
    ? declines.reduce((worst, curr) => Math.abs(curr.change) > Math.abs(worst.change) ? curr : worst)
    : null;

  // Find clearly above median (top quartile by gap)
  const aboveMedian = validKpis
    .map((r) => ({
      ...r,
      gap: numberOrNull(r.current) - numberOrNull(r.refMedian),
      gapPercent: ((numberOrNull(r.current) - numberOrNull(r.refMedian)) / Math.abs(numberOrNull(r.refMedian))) * 100
    }))
    .filter((r) => r.gap > 0 && r.kpi.higherIsBetter);
  
  const clearlyAbove = aboveMedian.length > 0
    ? aboveMedian.reduce((best, curr) => Math.abs(curr.gap) > Math.abs(best.gap) ? curr : best)
    : null;

  // Find clearly below median (bottom quartile by gap)
  const belowMedian = validKpis
    .map((r) => ({
      ...r,
      gap: numberOrNull(r.current) - numberOrNull(r.refMedian),
      gapPercent: ((numberOrNull(r.current) - numberOrNull(r.refMedian)) / Math.abs(numberOrNull(r.refMedian))) * 100
    }))
    .filter((r) => r.gap < 0 && r.kpi.higherIsBetter);
  
  const clearlyBelow = belowMedian.length > 0
    ? belowMedian.reduce((worst, curr) => Math.abs(curr.gap) > Math.abs(worst.gap) ? curr : worst)
    : null;

  return {
    biggestImprovement,
    biggestDecline,
    clearlyAbove,
    clearlyBelow
  };
}

function renderExecutiveSummary(summary) {
  const container = document.getElementById("executiveSummary");
  if (!container || !summary) return;

  const items = [];

  if (summary.biggestImprovement) {
    const r = summary.biggestImprovement;
    const delta = formatDelta(r.current, r.previous, r.kpi.unit, r.trendData5Years);
    items.push(`
      <div class="executive-summary-item positive">
        <div class="executive-summary-item-title">📈 Största förbättring</div>
        <div class="executive-summary-item-content">${delta.text}</div>
        <div class="executive-summary-item-label">${escapeHtml(r.kpi.label)}</div>
      </div>
    `);
  }

  if (summary.biggestDecline) {
    const r = summary.biggestDecline;
    const delta = formatDelta(r.current, r.previous, r.kpi.unit, r.trendData5Years);
    items.push(`
      <div class="executive-summary-item negative">
        <div class="executive-summary-item-title">📉 Största försämring</div>
        <div class="executive-summary-item-content">${delta.text}</div>
        <div class="executive-summary-item-label">${escapeHtml(r.kpi.label)}</div>
      </div>
    `);
  }

  if (summary.clearlyAbove) {
    const r = summary.clearlyAbove;
    const gap = (numberOrNull(r.current) - numberOrNull(r.refMedian)).toFixed(1);
    const isRiketKpi = ["N15505", "N15419", "N15436", "N15540"].includes(r.kpi.id);
    const refLabel = isRiketKpi ? "riket" : "median";
    items.push(`
      <div class="executive-summary-item above">
        <div class="executive-summary-item-title">⭐ Tydligt över ${refLabel}</div>
        <div class="executive-summary-item-content">+${gap} ${r.kpi.unit}</div>
        <div class="executive-summary-item-label">${escapeHtml(r.kpi.label)}</div>
      </div>
    `);
  }

  if (summary.clearlyBelow) {
    const r = summary.clearlyBelow;
    const gap = Math.abs(numberOrNull(r.current) - numberOrNull(r.refMedian)).toFixed(1);
    const isRiketKpi = ["N15505", "N15419", "N15436", "N15540"].includes(r.kpi.id);
    const refLabel = isRiketKpi ? "riket" : "median";
    items.push(`
      <div class="executive-summary-item below">
        <div class="executive-summary-item-title">⚠️ Tydligt under ${refLabel}</div>
        <div class="executive-summary-item-content">-${gap} ${r.kpi.unit}</div>
        <div class="executive-summary-item-label">${escapeHtml(r.kpi.label)}</div>
      </div>
    `);
  }

  if (items.length > 0) {
    container.style.display = "block";
    container.innerHTML = `
      <div class="executive-summary">
        <h3>🎯 Sammanfattning för beslutsfattare</h3>
        <div class="executive-summary-grid">
          ${items.join("")}
        </div>
      </div>
    `;
  }
}
function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function numberOrNull(value) {
  if (value === null || value === undefined) return null;
  const num = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(num) ? num : null;
}

// Klassificera nivå och trend utan riket-jämförelse
function classifyLevel(value) {
  const v = numberOrNull(value);
  if (v === null) return { label: "Ingen nivå", color: "#94a3b8", band: null };
  if (v >= 90) return { label: "Stark nivå", color: "#16a34a", band: "strong" };
  if (v >= 80) return { label: "Acceptabel nivå", color: "#0ea5e9", band: "ok" };
  if (v >= 70) return { label: "Risknivå", color: "#f97316", band: "risk" };
  return { label: "Problemnivå", color: "#dc2626", band: "problem" };
}

function classifyTrend(current, previous) {
  const c = numberOrNull(current);
  const p = numberOrNull(previous);
  if (c === null || p === null) return { label: "Ingen trend", color: "#94a3b8", dir: null, strength: "none", delta: null };
  const delta = c - p;
  const abs = Math.abs(delta);
  let strength = "stabil";
  if (abs > 5) strength = "kraftig";
  else if (abs > 3) strength = "tydlig";
  else if (abs > 1) strength = "svag";
  const dir = delta > 0 ? "up" : delta < 0 ? "down" : null;
  const directionLabel = dir === "up" ? "ökning" : dir === "down" ? "minskning" : "stabilt";
  const label = strength === "stabil" ? "Stabilt" : `${strength[0].toUpperCase()}${strength.slice(1)} ${directionLabel}`;
  const color = dir === null ? "#94a3b8" : dir === "up" ? "#16a34a" : "#dc2626";
  return { label, color, dir, strength, delta };
}

function buildInterpretation(levelBand, trendDir, trendStrength) {
  if (!trendDir || trendStrength === "none") return "Ingen trend";
  const isHigh = levelBand === "strong" || levelBand === "ok";
  const isLow = levelBand === "risk" || levelBand === "problem";
  if (isHigh && trendDir === "down") return "Varningssignal";
  if (isLow && trendDir === "up") return "Förbättring pågår";
  if (isLow && trendDir === "down") return "Prioriterat problem";
  if (isHigh && trendStrength === "stabil") return "Robust läge";
  return "Balanserat läge";
}

function formatValue(value, unit) {
  if (value === null) return "Ej publicerat för valt år";
  const num = numberOrNull(value);
  if (num === null) return "–";

  const nf = new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: unit === "%" ? 1 : 2,
    minimumFractionDigits: unit === "%" ? 0 : 0,
  });
  return `${nf.format(num)}${unit ? ` ${unit}` : ""}`;
}

function formatDelta(current, previous, unit, trendData5Years = null) {
  if (current === null || previous === null) return { text: "Ingen förändring beräknad", className: "trend-stable", icon: "" };
  const c = numberOrNull(current);
  const p = numberOrNull(previous);
  if (c === null || p === null) return { text: "Ingen förändring beräknad", className: "trend-stable", icon: "" };
  const d = c - p;

  // Standardized decimals: always 1 decimal for consistency
  const nf = new Intl.NumberFormat("sv-SE", { 
    minimumFractionDigits: 1,
    maximumFractionDigits: 1 
  });
  
  // Direction icon and text
  let icon = "";
  let direction = "";
  let className = "trend-stable";
  
  if (Math.abs(d) < 0.05) {
    // Negligible change
    icon = "→";
    direction = "oförändrat";
    className = "trend-stable";
  } else if (d > 0) {
    icon = "↑";
    direction = "upp";
    className = "trend-improving";
  } else {
    icon = "↓";
    direction = "ner";
    className = "trend-declining";
  }

  // Check if this is a large change (> 2x standard deviation from 5-year changes)
  let isLargeChange = false;
  if (trendData5Years && trendData5Years.length >= 3) {
    const changes = [];
    for (let i = 1; i < trendData5Years.length; i++) {
      const change = trendData5Years[i].value - trendData5Years[i - 1].value;
      if (change !== null && !isNaN(change)) changes.push(Math.abs(change));
    }
    if (changes.length >= 2) {
      const mean = changes.reduce((a, b) => a + b, 0) / changes.length;
      const variance = changes.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / changes.length;
      const stdDev = Math.sqrt(variance);
      if (Math.abs(d) > mean + 2 * stdDev) {
        isLargeChange = true;
      }
    }
  }

  const sign = d > 0 ? "+" : d < 0 ? "" : "±";
  const deltaValue = Math.abs(d) < 0.05 ? "0.0" : nf.format(d);
  const unitStr = unit ? ` ${unit}` : "";
  const largeChangeBadge = isLargeChange ? " ⚠️" : "";
  
  return { 
    text: `${icon} ${sign}${deltaValue}${unitStr}${largeChangeBadge}`, 
    className,
    icon,
    direction,
    isLargeChange
  };
}

function median(nums) {
  const arr = nums.filter((n) => typeof n === "number" && Number.isFinite(n)).sort((a, b) => a - b);
  if (!arr.length) return null;
  const mid = Math.floor(arr.length / 2);
  if (arr.length % 2) return arr[mid];
  return (arr[mid - 1] + arr[mid]) / 2;
}

function rankOfValue(values, value, higherIsBetter) {
  const arr = values.filter((n) => typeof n === "number" && Number.isFinite(n)).sort((a, b) => a - b);
  if (!arr.length || value === null) return { rank: null, total: arr.length };
  const v = numberOrNull(value);
  if (v === null) return { rank: null, total: arr.length };

  // rank 1 = best
  if (higherIsBetter) {
    const better = arr.filter((x) => x > v).length;
    return { rank: better + 1, total: arr.length };
  }
  const better = arr.filter((x) => x < v).length;
  return { rank: better + 1, total: arr.length };
}

// Set this to your proxy endpoint if you want HTTP analyze fallback (used when hook saknas)
// Example: '/api/analyze' or full URL to your Kolada analyze proxy
const ANALYZE_HTTP_ENDPOINT = "/api/analyze";

let analyzeWarningShown = false;

function showAnalyzeWarning(message) {
  if (analyzeWarningShown) return;
  const status = document.getElementById("kommunbildStatus");
  if (!status) return;
  const box = document.createElement("div");
  box.id = "kommunbild-analyze-warning";
  box.style.cssText = "margin-top:6px; padding:6px 10px; background:#fff7ed; border:1px solid #fdba74; color:#9a3412; border-radius:6px; font-size:0.85rem;";
  box.textContent = message;
  status.prepend(box);
  analyzeWarningShown = true;
}

async function analyzeKpiAcrossMunicipalities(kpiId, year, { gender = 'T', municipality_type = 'K' } = {}) {
  // 1) Prefer MCP-backed analyze hook
  if (typeof window !== "undefined" && window.__KOMMUNBILD_ANALYZE_KPI__) {
    return window.__KOMMUNBILD_ANALYZE_KPI__(kpiId, year, { gender, municipality_type });
  }

  // 2) Optional HTTP proxy to Kolada analyze (set ANALYZE_HTTP_ENDPOINT or window.__KOMMUNBILD_ANALYZE_HTTP__)
  const httpEndpoint = (typeof window !== "undefined" && window.__KOMMUNBILD_ANALYZE_HTTP__) || ANALYZE_HTTP_ENDPOINT;
  if (httpEndpoint) {
    const url = `${httpEndpoint}?kpi_id=${encodeURIComponent(kpiId)}&year=${encodeURIComponent(year)}&gender=${encodeURIComponent(gender)}&municipality_type=${encodeURIComponent(municipality_type)}`;
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (res.ok) {
        const json = await res.json();
        return json;
      }
      console.warn('[kommunbild] analyze HTTP endpoint returned non-OK', res.status);
    } catch (e) {
      console.warn('[kommunbild] analyze HTTP endpoint failed', url, e);
    }
  }

  // 3) Fallback: compute median locally from all municipalities for the year
  // Note: This is the normal mode of operation without MCP server
  console.log('[kommunbild] Using client-side median calculation (no analyze endpoint configured)');
  return computeMedianAcrossMunicipalities(kpiId, year, municipality_type);
}

// Explicit helper: fetch median via analyze endpoint/hook, returns { year, median, count }
async function fetchAllMunicipalitiesMedianForYear(kpiId, year) {
  try {
    const analysis = await analyzeKpiAcrossMunicipalities(kpiId, year, { gender: 'T', municipality_type: 'K' });
    if (!analysis) {
      console.warn('[kommunbild] analyzeKpiAcrossMunicipalities returned null for', kpiId, year);
      return { year, median: null, count: null };
    }
    const medianVal = numberOrNull(analysis?.statistics?.median ?? analysis?.median ?? null);
    const countVal = Number(analysis?.statistics?.count ?? analysis?.count ?? 0) || null;
    console.log(`[kommunbild] fetchAllMunicipalitiesMedianForYear ${kpiId} ${year}: median=${medianVal}, count=${countVal}`);
    if (medianVal !== null) {
      return { year, median: medianVal, count: countVal, method: 'analyze' };
    }
    // Fallback: compute median locally if analyze returned null
    const fallback = await computeMedianAcrossMunicipalities(kpiId, year, 'K');
    if (!fallback) {
      console.warn('[kommunbild] fallback median also failed for', kpiId, year);
      return { year, median: null, count: null, method: 'error' };
    }
    const fbMedian = numberOrNull(fallback?.statistics?.median ?? fallback?.median ?? null);
    const fbCount = Number(fallback?.statistics?.count ?? fallback?.count ?? 0) || null;
    console.warn('[kommunbild] analyze median missing, used fallback median', kpiId, year, fbMedian, fbCount);
    return { year, median: fbMedian, count: fbCount, method: 'fallback_median' };
  } catch (e) {
    console.warn('[kommunbild] fetchAllMunicipalitiesMedianForYear failed', kpiId, year, e);
    return { year, median: null, count: null, method: 'error' };
  }
}

// Fallback: compute median locally from all municipalities for the year
async function computeMedianAcrossMunicipalities(kpiId, year, municipality_type = 'K') {
  try {
    const all = await fetchAllMunicipalitiesForYear(kpiId, year);
    // Extract non-null values (assume fetched data is already filtered to appropriate type server-side)
    const vals = all
      .map(row => numberOrNull(row.value))
      .filter(v => v !== null);
    
    if (vals.length === 0) {
      console.warn('[kommunbild] no valid values for median', kpiId, year);
      return null;
    }
    
    const med = median(vals);
    console.log(`[kommunbild] computed median for ${kpiId} year ${year}: ${med} (from ${vals.length} values)`);
    return {
      median: med,
      count: vals.length,
      statistics: { median: med, count: vals.length }
    };
  } catch (e) {
    console.warn('[kommunbild] computeMedianAcrossMunicipalities fallback error', kpiId, year, e);
    return null;
  }
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function fetchKpiMeta(kpiId) {
  if (kpiMetaCache.has(kpiId)) return kpiMetaCache.get(kpiId);
  const url = `${KOLADA_BASE}/kpi?id=${encodeURIComponent(kpiId)}`;
  const data = await fetchJson(url);
  const meta = Array.isArray(data?.results) ? data.results[0] : data;
  kpiMetaCache.set(kpiId, meta ?? null);
  return meta ?? null;
}

function getAvailableYearsFromMeta(meta) {
  // Kolada meta sometimes exposes periods/years arrays; be defensive.
  const candidates = [];
  const periods = meta?.periods ?? meta?.years ?? meta?.available_periods ?? meta?.available_years;
  if (Array.isArray(periods)) candidates.push(...periods);
  const values = meta?.values;
  if (Array.isArray(values)) {
    for (const v of values) {
      const p = v?.period ?? v?.year;
      if (p !== undefined && p !== null) candidates.push(p);
    }
  }
  const years = candidates.map((x) => Number(x)).filter((n) => Number.isFinite(n));
  return Array.from(new Set(years)).sort((a, b) => b - a);
}

function buildMunicipalitySeriesUrl({ kpiId, municipalityId }) {
  // Same as skolenhetsdashboard -> chartHelpers.js
  return `${KOLADA_DATA_BASE}/${encodeURIComponent(kpiId)}/municipality/${encodeURIComponent(municipalityId)}`;
}

async function fetchMunicipalityValueForYear(kpiId, municipalityId, year) {
  // Check cache first
  const cacheKey = `${kpiId}_${municipalityId}_${year}`;
  if (municipalityValueCache.has(cacheKey)) {
    console.log(`[kommunbild] using cached value for ${kpiId} ${municipalityId} ${year}`);
    return municipalityValueCache.get(cacheKey);
  }

  const url = buildMunicipalitySeriesUrl({ kpiId, municipalityId });
  console.log(`[kommunbild] fetching series (for value): ${url}`);
  const json = await fetchJson(url);

  const entries = Array.isArray(json?.values) ? json.values : [];
  for (const entry of entries) {
    if (Number(entry?.period) !== Number(year)) continue;
    const vals = Array.isArray(entry?.values) ? entry.values : [];
    const total = vals.find((v) => v?.gender === "T") ?? vals[0];
    const value = numberOrNull(total?.value);
    municipalityValueCache.set(cacheKey, value);
    return value;
  }
  municipalityValueCache.set(cacheKey, null);
  return null;
}

async function fetchMunicipalityValueWithFallback(kpiId, municipalityId, year) {
  const primary = await fetchMunicipalityValueForYear(kpiId, municipalityId, year);
  if (primary !== null) return { value: primary, year };
  // fallback rule: if missing for selected (e.g. 2024), back to 2023.
  if (Number(year) === 2024) {
    const fallback = await fetchMunicipalityValueForYear(kpiId, municipalityId, 2023);
    if (fallback !== null) return { value: fallback, year: 2023 };
  }
  return { value: null, year };
}

async function fetchAllMunicipalitiesForYear(kpiId, year) {
  // Check cache first
  const cacheKey = `${kpiId}_${year}`;
  if (allMunicipalitiesCache.has(cacheKey)) {
    console.log(`[kommunbild] using cached data for all municipalities ${kpiId} ${year}`);
    return allMunicipalitiesCache.get(cacheKey);
  }

  // 1) Try v2 first (more reliable for all KPI types)
  try {
    const urlV2 = `https://api.kolada.se/v2/data/kpi/${encodeURIComponent(kpiId)}/municipality/${encodeURIComponent(year)}`;
    console.log(`[kommunbild] fetching all municipalities (v2): ${urlV2}`);
    const json = await fetchJson(urlV2);
    console.log(`[kommunbild] v2 response for ${kpiId}:`, json);
    
    // V2 /municipality/{year} returns already filtered by year:
    // { values: [ { kpi:"...", values: [ { municipality:"0684", period:YEAR, values:[{gender,value}] }, ... ] } ] }
    const root = Array.isArray(json?.values) ? json.values : [];
    let rows = root;
    if (root.length && Array.isArray(root[0]?.values) && root[0]?.municipality == null) {
      rows = root[0].values || [];
    }
    
    const out = [];
    for (const row of rows) {
      const municipality = row?.municipality ?? row?.municipality_id ?? null;
      if (!municipality) continue;
      
      // Data is already filtered by year in this endpoint, so row.values is the gender array directly
      const vals = Array.isArray(row?.values) ? row.values : [];
      const total = vals.find((v) => v?.gender === "T") ?? vals[0];
      const val = numberOrNull(total?.value);
      if (val !== null) {
        out.push({ municipality, value: val });
      }
    }

    console.log(`[kommunbild] v2 parsed ${out.length} municipalities for ${kpiId} year ${year}`);
    if (out.length > 0) {
      allMunicipalitiesCache.set(cacheKey, out);
      return out;
    }
    console.warn('[kommunbild] v2 data/kpi returned 0 valid rows');
  } catch (err) {
    console.warn('[kommunbild] v2 data/kpi fetch failed', err);
  }

  allMunicipalitiesCache.set(cacheKey, []);
  return [];
}

// NOTE: Kommunbild ska alltid köras för ett explicit valt år (ingen "senaste år"-logik).

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let index = 0;

  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (index < items.length) {
      const currentIndex = index++;
      try {
        results[currentIndex] = await mapper(items[currentIndex], currentIndex);
      } catch (err) {
        console.error("[kommunbild] mapper error", err);
        results[currentIndex] = { error: err };
      }
    }
  });
  await Promise.all(workers);
  return results;
}



function clearDataCache() {
  allMunicipalitiesCache.clear();
  municipalityValueCache.clear();
  console.log('[kommunbild] Data cache cleared');
}

function getSelectedMunicipalityId() {
  const select = $("kommunSelect");
  return select ? select.value : "";
}

function setYearSelectState({ disabled, options, selected }) {
  const yearSelect = $("qualityYearSelect");
  if (!yearSelect) return;
  yearSelect.disabled = !!disabled;
  yearSelect.innerHTML = "";

  const opts = options?.length ? options : [];
  if (!opts.length) {
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = disabled ? "Välj kommun först..." : "Inga år tillgängliga";
    yearSelect.appendChild(placeholder);
    return;
  }

  for (const y of opts) {
    const opt = document.createElement("option");
    opt.value = String(y);
    opt.textContent = String(y);
    yearSelect.appendChild(opt);
  }

  if (selected != null) yearSelect.value = String(selected);
}

function clearKommunbildContainers() {
  const status = document.getElementById("kommunbildStatus");
  if (status) {
    status.style.display = "none";
    status.textContent = "";
  }

  const blocks = document.getElementById("qualityBlocks");
  if (blocks) blocks.innerHTML = "";

  const org = document.getElementById("orgTableContainer");
  if (org) org.innerHTML = "";
}

async function initKommunSelect() {
  const kommunSelect = requireEl("kommunSelect");

  kommunSelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Välj kommun...";
  kommunSelect.appendChild(placeholder);

  for (const k of ALLA_KOMMUNER) {
    const opt = document.createElement("option");
    opt.value = k.id;
    opt.textContent = k.title;
    kommunSelect.appendChild(opt);
  }

  kommunSelect.value = DEFAULTS.municipalityId;
}

function renderKpiCard({
  label,
  value,
  unit,
  year,
  previousValue,
  previousYear,
  deltaText,
  deltaClass,
  rankText,
  comparisonText,
  gapText,
  showComparison,
  statusClass,
  kpiId,
  debugUrl,
  meta,
  referenceValue,
  trendData5Years,
  trendReference5Years,
  usedMockData,
}) {
  const safeLabel = escapeHtml(label);
  const safeComp = escapeHtml(comparisonText ?? "");
  const safeRank = escapeHtml(rankText ?? "");
  const safeUrl = debugUrl ? escapeHtml(debugUrl) : "";
  const infoTextU15401 =
    "Indexet baseras på avvikelse från modellberäknat värde för meritvärde, andel elever som når målen i alla ämnen och behöriga till yrkesprogram, samt ett elevenkätsindex. " +
    "Alla nyckeltalen avser kommunal grundskola. Nyckeltalen normaliseras så att alla kommunernas värden placeras på en skala från 0 till 100 där 0 är sämst och 100 är bäst. " +
    "För att inte extremvärden ska få för stort genomslag sätts värdet till 0 för kommuner med värden under percentil 2,5, och 100 för kommuner med värden över percentil 97,5. " +
    "För de kommuner som har data på alla nyckeltalen beräknas det ovägda medelvärdet, och därefter normaliseras även medelvärdet till en skala från 0 till 100 på samma sätt. " +
    "Index utgörs av det normaliserade medelvärdet. Källa: RKA:s beräkningar baserade på uppgifter från SKR, SCB och Skolverket. ID: U15401";

  const infoTextU15200 =
    "Engagemangsindex för grundskola enligt resultat från medarbetarenkät. HME står för Hållbart medarbetarengagemang och mäter såväl nivån på medarbetarnas engagemang som chefernas och organisationens förmåga att ta tillvara på och skapa engagemang. " +
    "HME-index består av nio frågor som tillsammans bildar ett totalindex för Hållbart medarbetarengagemang och tre delindex; Motivation, Ledarskap och Styrning. " +
    "Frågorna besvaras på en skala 1-5 där 1 är stämmer mycket dåligt och 5 är stämmer mycket bra. Resultaten på varje fråga omvandlas sedan till ett index med skala 0-100. " +
    "Totalindex formas som ett medelvärde av de nio frågorna. Ett högt värde indikerar en hög nivå på hållbart medarbetarengagemang. Avser egen regi. Källa: Egen undersökning i kommunen. ID: U15200.";
  const unitIcon = unit === "index" ? "📊" : unit === "%" ? "📈" : "";
  const infoBadge = (() => {
    if (kpiId === "U15401") return `<span class="kpi-info" title="${escapeHtml(infoTextU15401)}">ℹ️</span>`;
    if (kpiId === "U15200") return `<span class="kpi-info" title="${escapeHtml(infoTextU15200)}">ℹ️</span>`;
    return "";
  })();

  // Metadata presentation (soft, not techy)
  const metaTitle = meta?.title ?? label;
  const metaDesc = meta?.description ?? meta?.definition ?? "Beskrivning saknas.";
  const interpret = (() => {
    if (unit === "%" || unit === "p") {
      return kpiId && typeof kpiId === "string" && kpiId.startsWith("N") ? "Högre är bättre (andel/poäng)" : "Högre värde = bättre utfall";
    }
    if (unit === "index") return "Högre är bättre (index)";
    return meta?.direction ? meta.direction : kpiId && kpiId.startsWith("N") ? "Högre är bättre" : "Tolka i kontext";
  })();
  const updated = meta?.updated ?? meta?.latest_update ?? meta?.last_updated ?? "Okänt";
  const source = meta?.source ?? meta?.data_source ?? "Kolada";
  const apiUrl = `${KOLADA_BASE}/kpi/${encodeURIComponent(kpiId)}`;

  const metadataHtml = `
    <details class="kpi-meta" style="margin-top:0.6rem;">
      <summary style="cursor:pointer;font-weight:600;color:#1f2937;">Visa metadata</summary>
      <div style="margin-top:0.35rem;font-size:0.9rem;line-height:1.4;color:#1f2937;">
        <div style="margin-bottom:0.4rem;"><strong>Vad mäts?</strong><br>${escapeHtml(metaTitle)}</div>
        <div style="margin-bottom:0.4rem;"><strong>Hur tolkas?</strong><br>${escapeHtml(interpret)}</div>
        <div style="margin-bottom:0.4rem;"><strong>Beskrivning</strong><br>${escapeHtml(metaDesc)}</div>
        <div style="margin-bottom:0.25rem;opacity:0.85;">Senast uppdaterad: ${escapeHtml(String(updated))}</div>
        <div style="margin-bottom:0.25rem;opacity:0.85;">Datakälla: ${escapeHtml(String(source))}</div>
        <div style="margin-bottom:0.1rem;opacity:0.85;">NID: ${escapeHtml(kpiId)}</div>
        <div style="opacity:0.85;">URL: <a href="${escapeHtml(apiUrl)}" target="_blank" rel="noreferrer">${escapeHtml(apiUrl)}</a></div>
      </div>
    </details>`;
  const isMiniBarTarget =
    ["N15505", "N15504", "U15011", "U15401", "U15402"].includes(kpiId) ||
    /meritvärde|yrkesprogram|kostnad per elev|kvalitetsindex|elevenkätsindex/i.test(label || "");
  let miniBarsHtml = "";
  if (!isMiniBarTarget && MINI_TREND_KPI_IDS.has(kpiId) && previousValue !== null && value !== null) {
    const prevVal = numberOrNull(previousValue);
    const curVal = numberOrNull(value);
    if (prevVal !== null && curVal !== null) {
      const maxVal = Math.max(prevVal, curVal);
      const denom = Math.max(1, maxVal);
      const hPrev = Math.max(5, Math.round((prevVal / denom) * 100));
      const hCur = Math.max(5, Math.round((curVal / denom) * 100));
      miniBarsHtml = `
        <div style="display:flex;gap:1rem;margin-top:0.5rem;font-size:0.85rem;opacity:0.85;justify-content:center;">
          <div style="text-align:center;">
            <div style="font-weight:bold;font-size:0.95rem;">${prevVal.toFixed(1)}</div>
            <div style="font-size:0.7rem;opacity:0.75;margin-top:2px;">${previousYear ?? ""}</div>
          </div>
          <div style="text-align:center;">
            <div style="font-weight:bold;font-size:0.95rem;color:#667eea;">${curVal.toFixed(1)}</div>
            <div style="font-size:0.7rem;opacity:0.75;margin-top:2px;">${year ?? ""}</div>
          </div>
        </div>`;
    }
  }
  let barChartHtml = "";
  let trendLineHtml = "";

  // 5-year trend line for configured KPIs (optionally with reference series)
  // Show trend with >= 1 datapoint (municipal data might be sparse)
  if (Array.isArray(trendData5Years) && trendData5Years.length >= 1) {
    const own = trendData5Years;
    const ref = Array.isArray(trendReference5Years) && trendReference5Years.length >= 1 ? trendReference5Years : null;
    const allValues = [...own, ...(ref ?? [])].map((d) => d.value);
    const minVal = Math.min(...allValues);
    const maxVal = Math.max(...allValues);
    const range = maxVal - minVal || 1;
    const padding = { top: 20, bottom: 30, left: 10, right: 10 };
    const w = 300;
    const h = 120;
    const chartWidth = w - padding.left - padding.right;
    const chartHeight = h - padding.top - padding.bottom;
    const xScale = (i, len) => padding.left + (i / Math.max(1, len - 1)) * chartWidth;
    const yScale = (val) => padding.top + chartHeight - ((val - minVal) / range) * chartHeight;

    const makePolyline = (series, color, width) => series.map((d, i) => `${xScale(i, series.length)},${yScale(d.value)}`).join(" ");
    const ownPolyline = makePolyline(own, "#667eea", 2);
    const refPolyline = ref ? makePolyline(ref, "#000", 2) : "";
    
    console.log(`[kommunbild] trend rendering for ${kpiId}:`, { own: own.length, ref: ref?.length, refPolyline: refPolyline.substring(0, 50) });

    const ownCircles = own
      .map((d, i) => {
        const cx = xScale(i, own.length);
        const cy = yScale(d.value);
        return `
          <circle cx="${cx}" cy="${cy}" r="4" fill="#667eea" stroke="white" stroke-width="2"/>
          <text x="${cx}" y="${cy - 8}" text-anchor="middle" font-size="9" font-weight="bold" fill="#334155">${d.value.toFixed(1)}</text>
          <text x="${cx}" y="${h - 5}" text-anchor="middle" font-size="10" fill="#64748b">${d.year}</text>`;
      })
      .join("");

    const refCircles = ref
      ? ref
          .map((d, i) => {
            const cx = xScale(i, ref.length);
            const cy = yScale(d.value);
            return `<circle cx="${cx}" cy="${cy}" r="4" fill="#000" stroke="white" stroke-width="1.5" opacity="0.8"/>`;
          })
          .join("")
      : "";

    // Build export payload per request definition
    const allYears = Array.from(new Set([...
      own.map(d => d.year), ...(ref ? ref.map(d => d.year) : [])
    ])).sort((a,b)=>a-b);
    const missingYears = ref
      ? allYears.filter(y => ref.find(r=>r.year===y) == null)
      : allYears; // if no ref, all years missing for benchmark
    const exportPayload = {
      kpi_id: kpiId,
      method: 'A',
      municipality_series: own.map(d => ({ year: d.year, value: d.value })),
      benchmark_series: ref ? ref.map(d => ({ year: d.year, value: d.value })) : [],
      missing_benchmark_years: missingYears
    };

    const isRiketKpi = ["N15505", "N15419", "N15436", "N15540"].includes(kpiId);
    const benchmarkLabel = isRiketKpi ? "Riket" : "Alla kommuner (median)";
    const legend = ref
      ? `<div class="kpi-trend-chart-legend"><span class="legend-swatch" style="background:#667eea"></span>Egen kommun <span class="legend-swatch" style="background:#000"></span>${benchmarkLabel}</div>`
      : `<div class="kpi-trend-chart-legend"><span class="legend-swatch" style="background:#667eea"></span>Egen kommun</div>`;

    const mockWarningBadge = usedMockData 
      ? `<div style="display:inline-block;background:#ff9800;color:#fff;font-size:0.7rem;padding:2px 6px;border-radius:3px;margin-left:8px;">⚠️ Mock-data</div>` 
      : '';

    const exportButton = `<button class="kpi-export-btn" data-export='${escapeHtml(JSON.stringify(exportPayload))}' style="margin-top:6px;font-size:.8rem;">Kopiera trenddata</button>`;

    // Build comparison values for latest year (compact horizontal layout)
    let trendComparisonBars = "";
    const latestOwnValue = own.length > 0 ? own[own.length - 1].value : null;
    const latestRefValue = ref && ref.length > 0 ? ref[ref.length - 1].value : null;
    const latestYear = own.length > 0 ? own[own.length - 1].year : null;
    if (latestOwnValue !== null && latestRefValue !== null && latestYear !== null) {
      trendComparisonBars = `
        <div style="display:flex;gap:1.5rem;margin-top:0.5rem;font-size:0.85rem;opacity:0.85;">
          <div style="text-align:center;">
            <div style="font-weight:bold;font-size:1rem;">${latestRefValue.toFixed(1)}</div>
            <div style="font-size:0.75rem;opacity:0.75;margin-top:2px;">${benchmarkLabel}</div>
          </div>
          <div style="text-align:center;">
            <div style="font-weight:bold;font-size:1rem;color:#667eea;">${latestOwnValue.toFixed(1)}</div>
            <div style="font-size:0.75rem;opacity:0.75;margin-top:2px;">Egen kommun</div>
          </div>
        </div>`;
    }

    trendLineHtml = `
      <div class="kpi-trend-chart">
        <div class="kpi-trend-chart-title">5-års trend${mockWarningBadge}</div>
        ${legend}
        <svg width="100%" height="120" viewBox="0 0 ${w} ${h}" style="display:block;">
          ${ref ? `<polyline points="${refPolyline}" fill="none" stroke="#000" stroke-width="2" opacity="0.85"/>` : ""}
          <polyline points="${ownPolyline}" fill="none" stroke="#667eea" stroke-width="2"/>
          ${refCircles}
          ${ownCircles}
        </svg>
        ${trendComparisonBars}
        ${exportButton}
      </div>`;
  }

  if (isMiniBarTarget) {
    const dataPoints = [];
    const prevVal = numberOrNull(previousValue);
    const curVal = numberOrNull(value);
    const refVal = numberOrNull(referenceValue);
    if (prevVal !== null) dataPoints.push({ label: String(previousYear ?? "2023"), value: prevVal });
    if (curVal !== null) dataPoints.push({ label: String(year ?? "2024"), value: curVal });
    if (kpiId === "N15505" && refVal !== null) dataPoints.push({ label: "Riket", value: refVal });
    if (kpiId === "N15505" && curVal !== null) dataPoints.push({ label: "Egen kommun", value: curVal });
    if (kpiId !== "N15505" && refVal !== null) dataPoints.push({ label: "Referens", value: refVal });

    if (dataPoints.length) {
      const vals = dataPoints.map((d) => d.value);
      const minVal = Math.min(...vals);
      const maxVal = Math.max(...vals);
      const span = Math.max(1, maxVal - minVal);
      const palette = ["#cbd5e1", "#94a3b8", "#0f172a", "#2563eb"];

      const bars = dataPoints
        .map((d, idx) => {
          const h = Math.max(6, Math.round(((d.value - minVal) / span) * 100));
          const color = palette[Math.min(idx, palette.length - 1)];
          return `
            <div class="bar-chart-col">
              <div class="bar-chart-value">${d.value.toFixed(1)}</div>
              <div class="bar-chart-bar" style="height:${h}%; background:${color};"></div>
              <div class="bar-chart-label">${escapeHtml(d.label)}</div>
            </div>`;
        })
        .join("");

      const axisLabel = kpiId === "N15505" ? "Meritvärde (poäng)" : escapeHtml(label);
      barChartHtml = `
        <div class="bar-chart">
          <div class="bar-chart-axis-label">${axisLabel}</div>
          <div class="bar-chart-bars">${bars}</div>
          <div class="bar-chart-baseline"></div>
        </div>`;
    }
  }

  // For U15401/U15456: show median value as compact text even if no trend chart
  let medianTextHtml = "";
  if (["U15401", "U15456"].includes(kpiId) && referenceValue !== null && !trendLineHtml) {
    const medVal = numberOrNull(referenceValue);
    if (medVal !== null) {
      medianTextHtml = `
        <div style="margin-top:0.5rem;font-size:0.85rem;opacity:0.85;text-align:center;">
          <span style="font-weight:bold;">${medVal.toFixed(1)}</span>
          <span style="font-size:0.75rem;opacity:0.75;margin-left:4px;">Alla kommuner (median)</span>
        </div>`;
    }
  }

  let compareBarsHtml = "";
  if (kpiId === "N15505" && !barChartHtml) {
    const latest = numberOrNull(value);
    const ref = numberOrNull(referenceValue);
    if (latest !== null && ref !== null) {
    const maxVal = Math.max(latest, ref);
    const denom = Math.max(1, maxVal);
    const hRef = Math.max(5, Math.round((ref / denom) * 100));
    const hLatest = Math.max(5, Math.round((latest / denom) * 100));
    compareBarsHtml = `
      <div class="kpi-mini-bars kpi-mini-bars-vertical" style="margin-top:0.4rem;">
        <div class="kpi-mini-bar-col">
          <div class="kpi-mini-bar-value">${ref.toFixed(1)}</div>
          <div class="kpi-mini-bar-track vertical"><div class="kpi-mini-bar" style="background:#000;height:${hRef}%"></div></div>
          <div class="kpi-mini-bar-year">Riket</div>
        </div>
        <div class="kpi-mini-bar-col">
          <div class="kpi-mini-bar-value">${latest.toFixed(1)}</div>
          <div class="kpi-mini-bar-track vertical"><div class="kpi-mini-bar" style="background:#1976d2;height:${hLatest}%"></div></div>
          <div class="kpi-mini-bar-year">Egen kommun</div>
        </div>
      </div>`;
    }
  }

  return `
    <div class="kpi-item ${statusClass ?? ""}" data-kpi-id="${escapeHtml(kpiId)}">
      <div class="kpi-label">${unitIcon ? unitIcon + " " : ""}${safeLabel} ${infoBadge}</div>
      <div class="kpi-value">${escapeHtml(formatValue(value, unit))}</div>
      ${trendLineHtml}
      ${barChartHtml || miniBarsHtml}
      ${medianTextHtml}
      ${barChartHtml ? "" : compareBarsHtml}
      <div class="kpi-analysis" style="margin-top:.25rem; opacity:.7;"><strong>År:</strong> ${escapeHtml(String(year ?? "–"))}</div>
      <div class="kpi-trend ${deltaClass}">${escapeHtml(deltaText)} (Δ mot föregående)</div>
      ${showComparison ? `<div class="kpi-comparison">${safeComp}${gapText ? escapeHtml(gapText) : ""}</div>` : ""}
      ${showComparison ? `<div class="kpi-analysis"><strong>Rank:</strong> ${safeRank}</div>` : ""}
      ${metadataHtml}
    </div>
  `;
}

function deriveCardStatus({ higherIsBetter, value, reference }) {
  // Enkel start: grön om bättre än referens, röd om sämre, lightgreen om nära.
  const v = numberOrNull(value);
  const r = numberOrNull(reference);
  if (v === null || r === null) return null;

  const diff = v - r;
  const dir = higherIsBetter ? diff : -diff;
  const abs = Math.abs(diff);
  const near = Math.abs(r) > 0 ? abs / Math.abs(r) < 0.03 : abs < 0.03; // ~3%

  if (near) return "status-lightgreen";
  return dir >= 0 ? "status-green" : "status-red";
}

async function computeKpiForMunicipality({ kpi, municipalityId, forcedYear }) {
  try {
    const meta = await fetchKpiMeta(kpi.id);
    const year = Number.isFinite(Number(forcedYear)) ? Number(forcedYear) : DEFAULTS.year;

    const currentResult = await fetchMunicipalityValueWithFallback(kpi.id, municipalityId, year);
    const actualYear = currentResult.year;
    const current = currentResult.value;
    const previous = await fetchMunicipalityValueForYear(kpi.id, municipalityId, actualYear - 1);

    // Comparison is handled separately (and only for rankable KPIs).
    let refMedian = null;
    let rank = { rank: null, total: 0 };
    let total = 0;
    let comparisonError = null;

    if (kpi.rankable === true) {
      try {
        // Use server-side analysis when possible
        const analysis = await analyzeKpiAcrossMunicipalities(kpi.id, actualYear, { gender: 'T', municipality_type: 'K' });
        // Expected-ish shape: { median, total_count, ranks: [{municipality_id, rank}], ... }
        refMedian = numberOrNull(analysis?.median ?? analysis?.stats?.median ?? analysis?.statistics?.median);
        total = Number(analysis?.total ?? analysis?.total_count ?? analysis?.stats?.count ?? analysis?.statistics?.count ?? 0) || 0;
        const rankEntry =
          Array.isArray(analysis?.ranks) ? analysis.ranks.find((x) => String(x?.municipality_id ?? x?.municipality) === String(municipalityId)) : null;
        const computedRank = Number(rankEntry?.rank);
        if (Number.isFinite(computedRank) && total) {
          rank = { rank: computedRank, total };
        } else {
          // If rank list not present, but top/bottom present, fall back to client-side rank from values if provided.
          const values = Array.isArray(analysis?.values) ? analysis.values : null;
          if (values) {
            const allValues = values.map((v) => numberOrNull(v?.value)).filter((v) => v !== null);
            refMedian = refMedian ?? median(allValues);
            const rnk = rankOfValue(allValues, current, kpi.higherIsBetter);
            rank = rnk;
            total = rnk.total;
          }
        }
      } catch (err) {
        comparisonError = err;
        console.warn("[kommunbild] comparison analysis failed", kpi.id, err);
      }

      // Fallback: client-side median if server median saknas
      if (refMedian === null) {
        try {
          const all = await fetchAllMunicipalitiesForYear(kpi.id, actualYear);
          const vals = all.map((x) => numberOrNull(x.value)).filter((v) => v !== null);
          if (vals.length) {
            refMedian = median(vals);
          }
        } catch (err) {
          console.warn("[kommunbild] median fallback failed", kpi.id, err);
        }
      }
    }

    // Special: for N15505, N15419, N15436, N15540 use riket (0000) as reference
    if (["N15505", "N15419", "N15436", "N15540"].includes(kpi.id)) {
      try {
        const riketRef = await fetchMunicipalityValueForYear(kpi.id, "0000", actualYear);
        if (riketRef !== null && riketRef !== undefined) {
          refMedian = numberOrNull(riketRef);
          console.log(`[kommunbild] Using riket (0000) as refMedian for ${kpi.id}: ${refMedian}`);
        }
      } catch (err) {
        console.warn(`[kommunbild] Riket (0000) fetch failed for ${kpi.id}`, err);
      }
    }

    // Fetch 5-year trend for configured KPIs
    let trendData5Years = null;
    let trendReference5Years = null;
    let usedMockData = false;
    if (TREND_KPI_IDS.has(kpi.id)) {
      try {
        const years = [];
        for (let y = actualYear - 4; y <= actualYear; y++) {
          years.push(y);
        }
        const trendPromises = years.map((y) => fetchMunicipalityValueForYear(kpi.id, municipalityId, y));
        const trendValues = await Promise.all(trendPromises);
        trendData5Years = years
          .map((y, idx) => ({ year: Number(y), value: numberOrNull(trendValues[idx]) }))
          .filter((d) => d.value !== null);
        console.log(`[kommunbild] trend own data for ${kpi.id}:`, trendData5Years);

        // Build reference series (black line):
        // Check if we have an override that means "fetch per-municipality from another KPI" or "fetch median"
        const refSourceKpi = REFERENCE_MEDIAN_OVERRIDE[kpi.id];
        
        if (["N15505", "N15419", "N15436", "N15540"].includes(kpi.id)) {
          // Special: These KPIs use national average (municipality 0000 = riket)
          const refPromises = years.map((y) => fetchMunicipalityValueForYear(kpi.id, "0000", y));
          const refValues = await Promise.all(refPromises);
          trendReference5Years = years
            .map((y, idx) => ({ year: Number(y), value: numberOrNull(refValues[idx]) }))
            .filter((d) => d.value !== null);
          console.log(`[kommunbild] trend benchmark (riket 0000) for ${kpi.id}:`, trendReference5Years);
        } else if (refSourceKpi && refSourceKpi !== kpi.id) {
          // Mode: per-municipality reference KPI (for other KPIs if configured)
          const refPromises = years.map((y) => fetchMunicipalityValueForYear(refSourceKpi, municipalityId, y));
          const refValues = await Promise.all(refPromises);
          trendReference5Years = years
            .map((y, idx) => ({ year: Number(y), value: numberOrNull(refValues[idx]) }))
            .filter((d) => d.value !== null);
          console.log(`[kommunbild] trend benchmark (per-muni from ${refSourceKpi}) for ${kpi.id}:`, trendReference5Years);
        } else {
          // Mode: median across all municipalities (kommuntyp K, kön T) per year
          const medianKpi = refSourceKpi ?? kpi.id;
          const refPromises = years.map((y) => fetchAllMunicipalitiesMedianForYear(medianKpi, y));
          const refResults = await Promise.all(refPromises);
          trendReference5Years = refResults
            .map((r) => ({ year: Number(r.year), value: numberOrNull(r.median) }))
            .filter((d) => d.value !== null && Number.isFinite(d.value));
          
          // Fallback: om inga referensvärden, använd mockdata
          if (!trendReference5Years.length && MOCK_REFERENCE_DATA[kpi.id]) {
            console.warn(`[kommunbild] ⚠️ MOCK DATA används för svart linje (Alla kommuner) på ${kpi.id}`);
            showAnalyzeWarning(`⚠️ Mock-data används för ${kpi.id} trendlinje (Alla kommuner)`);
            usedMockData = true;
            trendReference5Years = years
              .map((y) => ({ year: Number(y), value: numberOrNull(MOCK_REFERENCE_DATA[kpi.id][y]) }))
              .filter((d) => d.value !== null && Number.isFinite(d.value));
          }
          
          if (!trendReference5Years.length) {
            showAnalyzeWarning(`Saknar referensdata (Alla kommuner median) för ${kpi.id} ${years[0]}-${years[years.length - 1]}`);
          }
          console.log(`[kommunbild] trend benchmark (median) for ${kpi.id}:`, trendReference5Years);
        }
      } catch (err) {
        console.warn("[kommunbild] 5-year trend fetch failed", err);
      }
    }

    return {
      kpi,
      meta,
      municipalityId,
      year: actualYear,
      current,
      previous,
      previousYear: actualYear - 1,
      refMedian,
      rank,
      total: total || rank.total,
      comparisonError,
      trendData5Years,
      trendReference5Years,
      usedMockData,
    };
  } catch (err) {
    console.error("[kommunbild] computeKpiForMunicipality error", kpi?.id, err);
    return {
      kpi,
      meta: null,
      municipalityId,
      year: Number.isFinite(Number(forcedYear)) ? Number(forcedYear) : DEFAULTS.year,
      current: null,
      previous: null,
      previousYear: null,
      refMedian: null,
      rank: { rank: null, total: 0 },
      total: 0,
      error: err,
    };
  }
}

function renderIndexTable(indexRows) {
  console.log('[kommunbild] renderIndexTable called with:', indexRows);
  if (!indexRows || indexRows.length === 0) {
    console.log('[kommunbild] renderIndexTable returning empty (no rows)');
    return "";
  }

  const header = `
    <div style="margin-bottom: 2rem;">
      <h3 style="color: #1e40af; margin-bottom: 1rem; font-size: 1.3rem;">📊 Index-översikt</h3>
      <table style="width:100%; border-collapse: collapse; background: white; border-radius: 10px; overflow:hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <thead>
          <tr style="background:#667eea; color: white; text-align:left;">
            <th style="padding:12px 16px; font-weight: 600;">Nyckeltal</th>
            <th style="padding:12px 16px; font-weight: 600;">Värde</th>
            <th style="padding:12px 16px; font-weight: 600;">Analys</th>
            <th style="padding:12px 16px; font-weight: 600;">År</th>
            <th style="padding:12px 16px; font-weight: 600;">Δ</th>
            <th style="padding:12px 16px; font-weight: 600;">Rank</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  const body = indexRows
    .map((r, idx) => {
      const delta = formatDelta(r.current, r.previous, r.kpi.unit);
      const rankText = r.rank.rank === null ? "–" : `${r.rank.rank} av ${r.rank.total}`;
      const level = classifyLevel(r.current);
      const trend = classifyTrend(r.current, r.previous);
      const interpretation = buildInterpretation(level.band, trend.dir, trend.strength);
      const analysisText = `${level.label} • ${trend.label} • ${interpretation}`;
      const analysisColor = trend.dir === "down" ? "#dc2626" : trend.dir === "up" ? "#16a34a" : level.color;
      
      const rowBg = idx % 2 === 0 ? "#f8fafc" : "white";
      const deltaColor = delta.className === "trend-improving" ? "#16a34a" : 
                         delta.className === "trend-declining" ? "#dc2626" : "#64748b";
      
      return `
        <tr style="background:${rowBg}; border-bottom: 1px solid #e2e8f0;">
          <td style="padding:12px 16px; font-weight: 500;">${escapeHtml(r.kpi.label)}</td>
          <td style="padding:12px 16px; font-weight: 700; color: #667eea;">${escapeHtml(formatValue(r.current, r.kpi.unit))}</td>
          <td style="padding:12px 16px; color:${analysisColor}; font-weight:600;">${escapeHtml(analysisText)}</td>
          <td style="padding:12px 16px;">${escapeHtml(String(r.year ?? "–"))}</td>
          <td style="padding:12px 16px; color: ${deltaColor}; font-weight: 600;">${escapeHtml(delta.text)}</td>
          <td style="padding:12px 16px;">${escapeHtml(rankText)}</td>
        </tr>
      `;
    })
    .join("");
  
  const footer = "</tbody></table></div>";
  const result = header + body + footer;
  console.log('[kommunbild] renderIndexTable HTML length:', result.length);
  return result;
}

function renderBlocks(blockResults, indexRows) {
  console.log('[kommunbild] renderBlocks called with indexRows:', indexRows);
  const container = document.getElementById("qualityBlocks");
  if (!container) return;

  const sections = blockResults
    .filter((br) => br.kpis.length > 0)
    .map((br, blockIndex) => {
      // Add index table before the first block's KPI cards
      const indexTableHtml = blockIndex === 0 && indexRows ? renderIndexTable(indexRows) : "";
      console.log(`[kommunbild] Block ${blockIndex} (${br.block.title}): indexTableHtml length = ${indexTableHtml.length}`);
      const cards = br.kpis
        .map((r) => {
          const delta = formatDelta(r.current, r.previous, r.kpi.unit, r.trendData5Years);
          const showComparison = r.kpi.rankable === true;
          const isIndexKpi = r.kpi.unit === "index";
          const isNKpi = r.kpi.kpi_type === "N";
          const isRiketKpi = ["N15505", "N15419", "N15436", "N15540"].includes(r.kpi.id);
          const refLabel = isRiketKpi ? "Riket" : "Alla kommuner (median)";
          const refText = r.refMedian === null 
            ? (isNKpi ? `Jämförelse mot ${refLabel}` : isIndexKpi ? `Jämförelse visas som median för alla kommuner. Ej rangordningsbart.` : "Ingen jämförelse möjlig för detta nyckeltal")
            : `${refLabel}: ${formatValue(r.refMedian, r.kpi.unit)}`;
          
          // Compute gap to median if both values exist
          let gapText = "";
          if (r.refMedian !== null && r.current !== null) {
            const gap = numberOrNull(r.current) - numberOrNull(r.refMedian);
            if (gap !== null && !isNaN(gap)) {
              const sign = gap > 0 ? "+" : "";
              const gapFormatted = gap.toFixed(1);
              gapText = ` (${sign}${gapFormatted} ${r.kpi.unit === "%" ? "p.p" : r.kpi.unit} mot median)`;
            }
          }
          
          const rankText = r.rank.rank === null ? "–" : `${r.rank.rank} av ${r.rank.total}`;
          const statusClass = deriveCardStatus({ higherIsBetter: r.kpi.higherIsBetter, value: r.current, reference: r.refMedian });
          const debugUrl = r?.municipalityId ? buildMunicipalitySeriesUrl({ kpiId: r.kpi.id, municipalityId: r.municipalityId }) : null;
          return renderKpiCard({
            label: r.kpi.label,
            value: r.current,
            unit: r.kpi.unit,
            year: r.year ?? "–",
            previousValue: r.previous,
            previousYear: r.previousYear,
            deltaText: delta.text,
            deltaClass: delta.className,
            rankText,
            comparisonText: refText,
            gapText,
            showComparison,
            statusClass,
            kpiId: r.kpi.id,
            debugUrl,
            meta: r.meta,
            referenceValue: r.refMedian ?? (r.rank && r.rank.median != null ? r.rank.median : null),
            trendData5Years: r.trendData5Years,
            trendReference5Years: r.trendReference5Years,
            usedMockData: r.usedMockData,
          });
        })
        .join("");

      return `
        <div class="dashboard-section" style="padding: 1.5rem; margin: 1.25rem 0;">
          <h2>${escapeHtml(br.block.title)}</h2>
          ${indexTableHtml}
          <div class="kpi-grid">${cards}</div>
        </div>`;
    })
    .join("");

  container.innerHTML = sections;
}

function renderOrgTable(rows) {
  const container = document.getElementById("orgTableContainer");
  if (!container) return;

  if (!rows.length) {
    container.innerHTML = `<div class="panel-description">Inga organisations-KPI:er är konfigurerade ännu.</div>`;
    return;
  }

  const header = `
    <table style="width:100%; border-collapse: collapse; background: white; border-radius: 10px; overflow:hidden;">
      <thead>
        <tr style="background:#f1f5f9; text-align:left;">
          <th style="padding:10px 12px;">Nyckeltal</th>
          <th style="padding:10px 12px;">Värde</th>
          <th style="padding:10px 12px;">Riket</th>
          <th style="padding:10px 12px;">Analys</th>
          <th style="padding:10px 12px;">År</th>
          <th style="padding:10px 12px;">Δ</th>
          <th style="padding:10px 12px;">Rank</th>
          <th style="padding:10px 12px;">NID</th>
        </tr>
      </thead>
      <tbody>
  `;

  const body = rows
    .map((r) => {
      const delta = formatDelta(r.current, r.previous, r.kpi.unit, r.trendData5Years);
      const rankText = r.rank.rank === null ? "–" : `${r.rank.rank} av ${r.rank.total}`;
      const deltaTooltip = delta.isLargeChange ? "title=\"Större än normal variation\"" : "";
      const riketValue = r.riketValue !== null && r.riketValue !== undefined ? formatValue(r.riketValue, r.kpi.unit) : "–";
      // Prefer riket-based analysis when available; otherwise fallback to level/trend interpretation
      let analysisText = "–";
      let analysisColor = "#94a3b8";
      if (r.current !== null && r.riketValue !== null) {
        const diff = r.current - r.riketValue;
        const tolerance = Math.abs(r.riketValue) * 0.05;
        if (Math.abs(diff) <= tolerance) {
          analysisText = "Nivå med riket";
          analysisColor = "#0284c7";
        } else if ((r.kpi.higherIsBetter && diff > 0) || (!r.kpi.higherIsBetter && diff < 0)) {
          analysisText = "Över riket";
          analysisColor = "#16a34a";
        } else {
          analysisText = "Under riket";
          analysisColor = "#dc2626";
        }
      } else {
        const level = classifyLevel(r.current);
        const trend = classifyTrend(r.current, r.previous);
        const interpretation = buildInterpretation(level.band, trend.dir, trend.strength);
        analysisText = `${level.label} • ${trend.label} • ${interpretation}`;
        analysisColor = trend.dir === "down" ? "#dc2626" : trend.dir === "up" ? "#16a34a" : level.color;
      }

      return `
        <tr style="border-top: 1px solid #e2e8f0;">
          <td style="padding:10px 12px; font-weight:600; color:#0f172a;">${escapeHtml(r.kpi.label)}</td>
          <td style="padding:10px 12px;">${escapeHtml(formatValue(r.current, r.kpi.unit))}</td>
          <td style="padding:10px 12px; color:#64748b;">${escapeHtml(riketValue)}</td>
          <td style="padding:10px 12px; color:${analysisColor}; font-weight:600;">${escapeHtml(analysisText)}</td>
          <td style="padding:10px 12px;">${escapeHtml(String(r.year ?? "–"))}</td>
          <td style="padding:10px 12px;" class="${delta.className}" ${deltaTooltip}>${escapeHtml(delta.text)}</td>
          <td style="padding:10px 12px;">${escapeHtml(rankText)}</td>
          <td style="padding:10px 12px; opacity:.8;">${escapeHtml(r.kpi.id)}</td>
        </tr>
      `;
    })
    .join("");

  const footer = "</tbody></table>";
  container.innerHTML = header + body + footer;
}

function renderSectionReference(blockResults) {
  const container = document.getElementById("sectionReference");
  if (!container) return;

  const titles = [];
  // Add block titles
  for (const br of blockResults || []) {
    if (br?.block?.title) titles.push(br.block.title);
  }
  // Add explicit table sections
  titles.push("Index (tabell)");
  titles.push("Organisation & struktur (tabell)");

  const listHtml = titles
    .map((t) => `<li>${escapeHtml(t)}</li>`)
    .join("");
  container.innerHTML = `<ul class="narrative-bullets">${listHtml}</ul>`;
}



async function renderKommunbildForMunicipality(municipalityId, forcedYear) {
  const status = document.getElementById("kommunbildStatus");
  if (status) {
    status.style.display = "block";
    status.innerHTML = "<h4>Laddar</h4><ul class=\"narrative-bullets\"><li><strong>Hämtar</strong>: kommunvärden, jämförelse och rank.</li></ul>";
  }

  // 1) Compute KPI results for each configured block
  const blockResults = await mapWithConcurrency(
    KPI_BLOCKS,
    1, // Reduced from 2 to 1 for better mobile performance
    async (block) => {
      const kpis = await mapWithConcurrency(block.kpis, DEFAULTS.maxParallelFetches, async (kpi) => {
        return computeKpiForMunicipality({ kpi, municipalityId, forcedYear });
      });
      return { block, kpis };
    }
  );

  // 2) Org table
  const orgRows = await mapWithConcurrency(ORG_KPIS, DEFAULTS.maxParallelFetches, async (kpi) => {
    const result = await computeKpiForMunicipality({ kpi, municipalityId, forcedYear });
    // Fetch riket value for comparison in org table
    try {
      const riketValue = await fetchMunicipalityValueForYear(kpi.id, "0000", result.year);
      result.riketValue = numberOrNull(riketValue);
    } catch (err) {
      console.warn(`[kommunbild] Could not fetch riket value for ${kpi.id}:`, err);
      result.riketValue = null;
    }
    return result;
  });

  // 3) Index table
  const indexRows = await mapWithConcurrency(INDEX_KPIS, DEFAULTS.maxParallelFetches, async (kpi) => {
    const result = await computeKpiForMunicipality({ kpi, municipalityId, forcedYear });
    return result;
  });

  // Generate and render executive summary before blocks
  const summary = generateExecutiveSummary(blockResults);
  renderExecutiveSummary(summary);

  // Render section titles reference
  renderSectionReference(blockResults);

  renderBlocks(blockResults, indexRows);
  renderOrgTable(orgRows);

  // 4) Status text
  const year = Number.isFinite(Number(forcedYear)) ? Number(forcedYear) : DEFAULTS.year;
  if (status) {
    status.style.display = "block";
    status.innerHTML = `
      <h4>Klart</h4>
      <ul class="narrative-bullets">
        <li><strong>Kommun</strong>: ${escapeHtml(municipalityId)}</li>
        <li><strong>År</strong>: ${escapeHtml(String(year))}</li>
      </ul>
    `;
  }
}

async function onMunicipalityChange() {
  clearKommunbildContainers();
  clearDataCache(); // Clear cache when changing municipality
  const municipalityId = getSelectedMunicipalityId();

  if (!municipalityId) {
    setYearSelectState({ disabled: true });
    return;
  }

  try {
    // Erbjud ett fåtal år bakåt, men inkludera även aktuellt år.
    // OBS: Kolada publicerar inte alltid data för senaste år direkt, men användaren ska kunna välja det.
    const nowYear = new Date().getFullYear();
    const suggestedYears = Array.from(new Set([nowYear + 1, nowYear, 2024, 2023, 2022, 2021, 2020])).sort((a, b) => b - a);
    const yearSelect = $("qualityYearSelect");
    const selectedYear = yearSelect && yearSelect.value ? Number(yearSelect.value) : DEFAULTS.year;
    setYearSelectState({ disabled: false, options: suggestedYears, selected: selectedYear });

    await renderKommunbildForMunicipality(municipalityId, selectedYear);
  } catch (err) {
    throw err;
  }
}

async function main() {
  clearKommunbildContainers();
  setYearSelectState({ disabled: true });

  // Initialize kommun dropdown immediately (fast, uses local data)
  await initKommunSelect();

  // Setup event listeners
  requireEl("kommunSelect").addEventListener("change", onMunicipalityChange);
  requireEl("qualityYearSelect").addEventListener("change", () => {
    onMunicipalityChange();
  });

  // Load data for default municipality (this can take time, but UI is already interactive)
  await onMunicipalityChange();

  // Preload KPI metadata in background (non-blocking, improves subsequent loads)
  preloadKpiMetadata();
}

// Non-blocking background preload of KPI metadata
function preloadKpiMetadata() {
  const allKpiIds = [
    ...KPI_BLOCKS.flatMap((b) => b.kpis.map((k) => k.id)),
    ...ORG_KPIS.map((k) => k.id),
  ];
  const uniq = Array.from(new Set(allKpiIds));
  
  // Run in background without blocking
  mapWithConcurrency(uniq, 6, async (kpiId) => {
    try {
      await fetchKpiMeta(kpiId);
    } catch (err) {
      console.warn(`[kommunbild] Failed to preload meta for ${kpiId}`, err);
    }
  }).catch((err) => {
    console.warn("[kommunbild] KPI meta preload failed", err);
  });
}

console.log("[kommunbild] module loaded");

main().catch((err) => {
  console.error("[kommunbild] fatal error", err);
  clearKommunbildContainers();
  const status = document.getElementById("kommunbildStatus");
  if (status) {
    status.style.display = "block";
    status.textContent = `Fel: ${err?.message ?? String(err)}`;
  }
});
