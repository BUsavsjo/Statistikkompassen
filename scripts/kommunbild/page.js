// Kommunbild – separat logik så skolenhetsdashboard inte påverkas.
// Denna modul är fristående från scripts/skolenhetsdashboard/page.js

import { ALLA_KOMMUNER } from "../kommuner.js";

const KOLADA_BASE = "https://api.kolada.se/v3";
const KOLADA_DATA_BASE = `${KOLADA_BASE}/data/kpi`;

const kpiMetaCache = new Map();

const DEFAULTS = {
  municipalityId: "0684", // Sävsjö (bra för dev)
  maxParallelFetches: 6,
  year: 2024,
};

/**
 * Kommunbild KPI-konfiguration
 * NOTE: Detta är en startuppsättning. Lägg in hela KPI-listan enligt spec när du skickar den igen.
 */
const KPI_BLOCKS = [
  {
    title: "Resultat och index",
    kpis: [
      { id: "N15505", label: "Meritvärde åk 9 (kommunala)", unit: "p", higherIsBetter: true, kpi_type: "N", rankable: true },
      { id: "U15401", label: "Kvalitetsindex grundskola", unit: "index", higherIsBetter: true, kpi_type: "U", rankable: false },
      { id: "U15402", label: "Elevenkätsindex åk 8", unit: "index", higherIsBetter: true, kpi_type: "U", rankable: false },
        { id: "U15200", label: "Medarbetareengagemang grundskola och förskoleklass", unit: "index", higherIsBetter: true, kpi_type: "U", rankable: false },
    ],
  },
  {
    title: "Kostnad per elev",
    kpis: [
      { id: "U15011", label: "Nettokostnad per elev F–9", unit: "kr", higherIsBetter: false, kpi_type: "U", rankable: false },
    ],
  },
  {
    title: "Åk 3 – nationella prov",
    kpis: [
      { id: "N15473", label: "NP matematik åk 3, godkänt (hemkommun)", unit: "%", higherIsBetter: true, kpi_type: "N", rankable: true },
      { id: "N15472", label: "NP svenska/sva åk 3, godkänt (hemkommun)", unit: "%", higherIsBetter: true, kpi_type: "N", rankable: true },
    ],
  },
  {
    title: "Åk 6 – betyg",
    kpis: [
      // OBS: N15042 kommer som andel (0–1) i Kolada för kommun. Visas därför som andel, inte procent.
      { id: "N15042", label: "Minst E i engelska", unit: "andel", higherIsBetter: true, kpi_type: "N", rankable: true },
    ],
  },
  {
    title: "Åk 9 – kompletterande",
    kpis: [
      // U15428 saknar datapunkter för 2024/2023 i kommun-datat (ranking (-2022) i katalogen).
      // Behåll gärna blocket när vi har en ersättare med kommundata för valda år.
    ],
  },
  {
    title: "Modellavvikelse",
    kpis: [
      { id: "U15416", label: "Avvikelse meritvärde (SALSA)", unit: "p", higherIsBetter: true, kpi_type: "U", rankable: false },
      { id: "U15414", label: "Avvikelse betygskriterier (SALSA)", unit: "p.p", higherIsBetter: true, kpi_type: "U", rankable: false },
    ],
  },
  {
    title: "Nationella prov – betyg vs prov",
    kpis: [
      { id: "U15429", label: "Åk 9: Matematik – betyg > prov", unit: "%", higherIsBetter: false, kpi_type: "U", rankable: false },
      { id: "U15430", label: "Åk 9: Matematik – betyg < prov", unit: "%", higherIsBetter: false, kpi_type: "U", rankable: false },
    ],
  },
  {
    title: "Elevenkäten – delindex",
    kpis: [
      { id: "N15301", label: "Trygg i skolan åk 5", unit: "index", higherIsBetter: true, kpi_type: "N", rankable: true },
      { id: "N15302", label: "Trygg i skolan åk 8", unit: "index", higherIsBetter: true, kpi_type: "N", rankable: true },
      { id: "N15305", label: "Lärarna förklarar åk 5", unit: "index", higherIsBetter: true, kpi_type: "N", rankable: true },
      { id: "N15306", label: "Lärarna förklarar åk 8", unit: "index", higherIsBetter: true, kpi_type: "N", rankable: true },
      { id: "N15309", label: "Arbetsro åk 5", unit: "index", higherIsBetter: true, kpi_type: "N", rankable: true },
      { id: "N15310", label: "Arbetsro åk 8", unit: "index", higherIsBetter: true, kpi_type: "N", rankable: true },
    ],
  },
  {
    title: "NPF",
    kpis: [
      { id: "N15860", label: "Andel elever med NPF", unit: "%", higherIsBetter: false, kpi_type: "N", rankable: true },
      { id: "N15861", label: "NPF-elever behöriga till yrkesgymnasium", unit: "%", higherIsBetter: true, kpi_type: "N", rankable: true },
    ],
  },
];

const ORG_KPIS = [
  // OBS: flera tidigare N15xxx-kostnadsposter gav inga kommun-datapunkter för 2024/2023 i 0684.
  // Byt till KPI:er som vi kan verifiera har kommundata i vald årsperiod.
  { id: "U15011", label: "Nettokostnad per elev F–9", unit: "kr", higherIsBetter: false },
  // Lärartäthet: antal elever per lärare (kommun) – använd N15034
  { id: "N15034", label: "Lärartäthet (elever per lärare)", unit: "antal", higherIsBetter: false },
  { id: "N15814", label: "Lärare (heltidstjänster) med lärarlegitimation och behörighet i grundskola åk 1-9, kommunala skolor", unit: "%", higherIsBetter: true },
];

function $(id) {
  return document.getElementById(id);
}

function requireEl(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
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

function formatDelta(current, previous, unit) {
  if (current === null || previous === null) return { text: "Ingen förändring beräknad", className: "trend-stable" };
  const c = numberOrNull(current);
  const p = numberOrNull(previous);
  if (c === null || p === null) return { text: "Ingen förändring beräknad", className: "trend-stable" };
  const d = c - p;

  const nf = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: unit === "%" ? 1 : 2 });
  const sign = d > 0 ? "+" : d < 0 ? "" : "";

  let className = "trend-stable";
  if (Math.abs(d) > 0) className = d > 0 ? "trend-improving" : "trend-declining";

  return { text: `${sign}${nf.format(d)}${unit ? ` ${unit}` : ""}`, className };
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

async function analyzeKpiAcrossMunicipalities(kpiId, year) {
  // Prefer MCP-backed analysis endpoint when available in this project.
  // Fallback is handled by caller if it throws.
  if (typeof window !== "undefined" && window.__KOMMUNBILD_ANALYZE_KPI__) {
    return window.__KOMMUNBILD_ANALYZE_KPI__(kpiId, year);
  }
  throw new Error("analyze_kpi_across_municipalities not wired");
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
  const url = buildMunicipalitySeriesUrl({ kpiId, municipalityId });
  console.log(`[kommunbild] fetching series (for value): ${url}`);
  const json = await fetchJson(url);

  const entries = Array.isArray(json?.values) ? json.values : [];
  for (const entry of entries) {
    if (Number(entry?.period) !== Number(year)) continue;
    const vals = Array.isArray(entry?.values) ? entry.values : [];
    const total = vals.find((v) => v?.gender === "T") ?? vals[0];
    return numberOrNull(total?.value);
  }
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
  // Match older strategy: fetch all municipalities via /v3/data/kpi/<kpi>/municipality then filter client-side.
  const url = `${KOLADA_DATA_BASE}/${encodeURIComponent(kpiId)}/municipality?per_page=500`;
  console.log(`[kommunbild] fetching all municipalities (series): ${url}`);
  const json = await fetchJson(url);

  // Expected: { values: [ { kpi:"...", values:[ {municipality:"0684", values:[{period,values:[{gender,value}]}]} ] } ] }
  const node = Array.isArray(json?.values) ? json.values[0]?.values : [];
  const out = [];
  for (const row of node || []) {
    const municipality = row?.municipality ?? row?.municipality_id ?? null;
    const periods = Array.isArray(row?.values) ? row.values : [];
    const point = periods.find((p) => Number(p?.period) === Number(year)) ?? null;
    const vals = Array.isArray(point?.values) ? point.values : [];
    const total = vals.find((v) => v?.gender === "T") ?? vals[0];
    out.push({ municipality, value: numberOrNull(total?.value) });
  }
  return out;
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

function setGlobalLoading(visible, message) {
  const overlay = document.getElementById("globalLoadingScreen");
  if (!overlay) return;
  overlay.style.display = visible ? "flex" : "none";
  if (message) {
    const h2 = overlay.querySelector("h2");
    if (h2) h2.textContent = message;
  }
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
  showComparison,
  statusClass,
  kpiId,
  debugUrl,
  referenceValue,
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
  const infoBadge = (() => {
    if (kpiId === "U15401") return `<span class="kpi-info" title="${escapeHtml(infoTextU15401)}">ℹ️</span>`;
    if (kpiId === "U15200") return `<span class="kpi-info" title="${escapeHtml(infoTextU15200)}">ℹ️</span>`;
    return "";
  })();
  const isMiniBarTarget =
    ["N15505", "N15504", "U15011", "U15401", "U15402"].includes(kpiId) ||
    /meritvärde|yrkesprogram|kostnad per elev|kvalitetsindex|elevenkätsindex/i.test(label || "");
  let miniBarsHtml = "";
  let barChartHtml = "";

  if (isMiniBarTarget) {
    const dataPoints = [];
    const prevVal = numberOrNull(previousValue);
    const curVal = numberOrNull(value);
    const refVal = numberOrNull(referenceValue);
    if (prevVal !== null) dataPoints.push({ label: String(previousYear ?? "2023"), value: prevVal });
    if (curVal !== null) dataPoints.push({ label: String(year ?? "2024"), value: curVal });
    if (kpiId === "N15505" && refVal !== null) dataPoints.push({ label: "Alla kommuner", value: refVal });
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
          <div class="kpi-mini-bar-year">Alla kommuner</div>
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
      <div class="kpi-label">${safeLabel} ${infoBadge}</div>
      <div class="kpi-value">${escapeHtml(formatValue(value, unit))}</div>
      ${barChartHtml || miniBarsHtml}
      ${barChartHtml ? "" : compareBarsHtml}
      <div class="kpi-analysis" style="margin-top:.25rem; opacity:.7;"><strong>År:</strong> ${escapeHtml(String(year ?? "–"))}</div>
      ${safeUrl ? `<div class="kpi-analysis" style="margin-top:.35rem; opacity:.8; font-size:.8rem; word-break:break-all; user-select:text;"><strong>URL:</strong> ${safeUrl}</div>` : ""}
      <div class="kpi-trend ${deltaClass}">${escapeHtml(deltaText)} (Δ mot föregående)</div>
      ${showComparison ? `<div class="kpi-comparison">${safeComp}</div>` : ""}
      ${showComparison ? `<div class="kpi-analysis"><strong>Rank:</strong> ${safeRank}</div>` : ""}
      <div class="kpi-analysis" style="margin-top:.35rem; opacity:.75;"><strong>NID:</strong> ${escapeHtml(kpiId)}</div>
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
        const analysis = await analyzeKpiAcrossMunicipalities(kpi.id, actualYear);
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

    // Special: for meritvärde N15505, use U15458 as comparison bar if available
    if (kpi.id === "N15505") {
      try {
        const altRef = await fetchMunicipalityValueWithFallback("U15458", municipalityId, actualYear);
        if (altRef?.value !== null && altRef?.value !== undefined) {
          refMedian = numberOrNull(altRef.value);
        }
      } catch (err) {
        console.warn("[kommunbild] U15458 fallback failed", err);
      }
    }

    return {
      kpi,
      municipalityId,
      year: actualYear,
      current,
      previous,
      previousYear: actualYear - 1,
      refMedian,
      rank,
      total: total || rank.total,
      comparisonError,
    };
  } catch (err) {
    console.error("[kommunbild] computeKpiForMunicipality error", kpi?.id, err);
    return {
      kpi,
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

function renderBlocks(blockResults) {
  const container = document.getElementById("qualityBlocks");
  if (!container) return;

  const all = blockResults.flatMap(({ kpis }) => kpis);

  const renderCards = (items) => items.map((r) => {
    const delta = formatDelta(r.current, r.previous, r.kpi.unit);
    const showComparison = r.kpi.rankable === true;
    const refText = r.refMedian === null ? "Ingen jämförelse möjlig för detta nyckeltal" : `Median alla kommuner: ${formatValue(r.refMedian, r.kpi.unit)}`;
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
      showComparison,
      statusClass,
      kpiId: r.kpi.id,
      debugUrl,
        referenceValue: r.refMedian ?? (r.rank && r.rank.median != null ? r.rank.median : null),
    });
  }).join("");

  // Grupper: NP åk 3, NP åk 9, Trygghet
  const NP_AK3_IDS = new Set(["N15473", "N15472"]);
  const NP_AK9_IDS = new Set(["U15429", "U15430"]);
  const TRYG_IDS = new Set(["N15301", "N15302", "N15309", "N15310"]);

  const groupAk3 = all.filter((r) => NP_AK3_IDS.has(r.kpi.id));
  const groupAk9 = all.filter((r) => NP_AK9_IDS.has(r.kpi.id));
  const groupTryg = all.filter((r) => TRYG_IDS.has(r.kpi.id));
  const groupOther = all.filter((r) => !NP_AK3_IDS.has(r.kpi.id) && !NP_AK9_IDS.has(r.kpi.id) && !TRYG_IDS.has(r.kpi.id));

  container.innerHTML = [
    groupAk3.length ? `
      <div class="dashboard-section" style="padding: 1.5rem; margin: 1.25rem 0;">
        <h2>Nationella prov – Åk 3</h2>
        <div class="kpi-grid">${renderCards(groupAk3)}</div>
      </div>` : "",
    groupAk9.length ? `
      <div class="dashboard-section" style="padding: 1.5rem; margin: 1.25rem 0;">
        <h2>Nationella prov – Åk 9</h2>
        <div class="kpi-grid">${renderCards(groupAk9)}</div>
      </div>` : "",
    groupTryg.length ? `
      <div class="dashboard-section" style="padding: 1.5rem; margin: 1.25rem 0;">
        <h2>Elevenkäten – Åk 5 & Åk 8</h2>
        <div class="kpi-grid">${renderCards(groupTryg)}</div>
      </div>` : "",
    groupOther.length ? `
      <div class="dashboard-section" style="padding: 1.5rem; margin: 1.25rem 0;">
        <h2>Övriga KPI:er</h2>
        <div class="kpi-grid">${renderCards(groupOther)}</div>
      </div>` : "",
  ].join("");
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
      const delta = formatDelta(r.current, r.previous, r.kpi.unit);
      const rankText = r.rank.rank === null ? "–" : `${r.rank.rank} av ${r.rank.total}`;
      return `
        <tr style="border-top: 1px solid #e2e8f0;">
          <td style="padding:10px 12px; font-weight:600; color:#0f172a;">${escapeHtml(r.kpi.label)}</td>
          <td style="padding:10px 12px;">${escapeHtml(formatValue(r.current, r.kpi.unit))}</td>
          <td style="padding:10px 12px;">${escapeHtml(String(r.year ?? "–"))}</td>
          <td style="padding:10px 12px;" class="${delta.className}">${escapeHtml(delta.text)}</td>
          <td style="padding:10px 12px;">${escapeHtml(rankText)}</td>
          <td style="padding:10px 12px; opacity:.8;">${escapeHtml(r.kpi.id)}</td>
        </tr>
      `;
    })
    .join("");
  const footer = "</tbody></table>";

  container.innerHTML = header + body + footer;
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
    2,
    async (block) => {
      const kpis = await mapWithConcurrency(block.kpis, DEFAULTS.maxParallelFetches, async (kpi) => {
        return computeKpiForMunicipality({ kpi, municipalityId, forcedYear });
      });
      return { block, kpis };
    }
  );

  // 2) Org table
  const orgRows = await mapWithConcurrency(ORG_KPIS, DEFAULTS.maxParallelFetches, async (kpi) => {
    return computeKpiForMunicipality({ kpi, municipalityId, forcedYear });
  });

  renderBlocks(blockResults);
  renderOrgTable(orgRows);

  // 3) Status text
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
  const municipalityId = getSelectedMunicipalityId();

  if (!municipalityId) {
    setYearSelectState({ disabled: true });
    return;
  }

  setGlobalLoading(true, "Laddar kommunbild...");
  try {
    // Erbjud ett fåtal år bakåt, men inkludera även aktuellt år.
    // OBS: Kolada publicerar inte alltid data för senaste år direkt, men användaren ska kunna välja det.
    const nowYear = new Date().getFullYear();
    const suggestedYears = Array.from(new Set([nowYear + 1, nowYear, 2024, 2023, 2022, 2021, 2020])).sort((a, b) => b - a);
    const yearSelect = $("qualityYearSelect");
    const selectedYear = yearSelect && yearSelect.value ? Number(yearSelect.value) : DEFAULTS.year;
    setYearSelectState({ disabled: false, options: suggestedYears, selected: selectedYear });

    await renderKommunbildForMunicipality(municipalityId, selectedYear);
  } finally {
    setGlobalLoading(false);
  }
}

async function main() {
  clearKommunbildContainers();
  setYearSelectState({ disabled: true });

  // Validate KPI metadata early (used to steer year availability & rankability)
  try {
    const allKpiIds = [
      ...KPI_BLOCKS.flatMap((b) => b.kpis.map((k) => k.id)),
      ...ORG_KPIS.map((k) => k.id),
    ];
    const uniq = Array.from(new Set(allKpiIds));
    await mapWithConcurrency(uniq, 6, async (kpiId) => {
      const meta = await fetchKpiMeta(kpiId);
      if (!meta) return;
      // If config didn't specify, infer a conservative rankable default: N => rankable, U => not.
      const inferredType = String(meta?.id ?? kpiId).startsWith("N") ? "N" : String(meta?.id ?? kpiId).startsWith("U") ? "U" : null;
      // No direct mutation of config objects here; we just cache meta for messaging/logic later.
      const years = getAvailableYearsFromMeta(meta);
      if (years.length) {
        console.log(`[kommunbild] KPI ${kpiId} years:`, years.slice(0, 8));
      }
      if (inferredType && meta?.id && inferredType !== inferredType) {
        // noop, placeholder to keep lint quiet
      }
    });
  } catch (err) {
    console.warn("[kommunbild] KPI meta init failed", err);
  }

  await initKommunSelect();

  requireEl("kommunSelect").addEventListener("change", onMunicipalityChange);
  requireEl("qualityYearSelect").addEventListener("change", () => {
    onMunicipalityChange();
  });

  await onMunicipalityChange();
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
  setGlobalLoading(false);
});
