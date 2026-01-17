# Architecture Diagram: Two-Layer KPI Data System

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        KOMMUNBILD PAGE LIFECYCLE                            │
└─────────────────────────────────────────────────────────────────────────────┘

USER SELECTS KOMMUN & ÅR
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: FAST LOAD (UI Interactive in ~1s)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ORG_KPIS (5 KPIs)          INDEX_KPIS (5 KPIs)                           │
│  ↓                           ↓                                             │
│  computeKpiSnapshot()        computeKpiSnapshot()                         │
│  ├─ fetch current            ├─ fetch current                             │
│  ├─ fetch previous           ├─ fetch previous                            │
│  ├─ fetch riket/median       ├─ analyze rank                              │
│  └─ analyze rank             └─ (NO TRENDS)                               │
│  (NO TRENDS)                                                               │
│  │                            │                                            │
│  ├─ renderOrgTable()         ├─ renderIndexTable()                         │
│  │  (Org & Structure Table)  │  (Index Table)                             │
│  │  ✓ Ready in ~3s           │  ✓ Ready in ~3s                            │
│  └──────────────┬────────────┘                                             │
│                 │                                                          │
│  [UI INTERACTIVE] ◀─ User can navigate, see data                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: TABLE BLOCKS (Lazy Trends Ready in ~15s)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  KPI_BLOCKS (15 KPIs across 3 blocks)                                     │
│  ├─ Kunskapsresultat (5 KPIs)                                             │
│  ├─ Tidiga signaler (2 KPIs)                                              │
│  └─ Trygghet och studiero (4 KPIs)                                        │
│       │                                                                   │
│       ▼                                                                   │
│       For each block:                                                    │
│       ├─ computeKpiSnapshot() for each KPI [NO TRENDS]                   │
│       └─ renderBlockTables()                                              │
│          ├─ Table with columns:                                          │
│          │  ┌─────────────────────────────────────────────┐             │
│          │  │ Nyckeltal │ Värde │ År │ Δ │ Jämför │ Rank │ Fördjupa │  │
│          │  ├─────────────────────────────────────────────┤             │
│          │  │ [KPI 1]   │ 42.5  │ 24 │↑3%│  40.2 │ 5/290│    ▸      │  │
│          │  ├─────────────────────────────────────────────┤             │
│          │  │ [Details] (hidden, data-loaded=0)          │             │
│          │  │ "Laddar trend…" ← on click Fördjupa        │             │
│          │  └─────────────────────────────────────────────┘             │
│          │  ├─────────────────────────────────────────────┤             │
│          │  │ [KPI 2]   │ 68.1  │ 24 │▼2%│  71.0 │12/290│    ▸      │  │
│          │  └─────────────────────────────────────────────┘             │
│          │                                                              │
│          └─ setupExpandableRowListeners()                               │
│             Attach click handlers to all Fördjupa buttons               │
│                                                                        │
│  ✓ Page fully loaded in ~15s                                           │
│                                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ ON-DEMAND PHASE: LAZY TREND LOADING (When user expands)                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  USER CLICKS "Fördjupa ▸"                                                 │
│         │                                                                 │
│         ▼                                                                 │
│  Details row hidden? → Show it                                            │
│  Details row visible? → Hide it                                           │
│                                                                           │
│  IF first time (data-loaded="0"):                                         │
│         │                                                                 │
│         ▼                                                                 │
│  loadAndRenderTrendChart(btn, detailRow)                                  │
│         │                                                                 │
│         ├─ Cache key: "kpiId_municipalityId_year"                        │
│         │                                                                 │
│         ├─ trendBundleCache.get(key)?                                    │
│         │  └─ YES: Return cached data (~0ms)                             │
│         │  └─ NO:  fetchKpiTrendBundle()                                 │
│         │          ├─ For each of 5 years (y-4 to y):                   │
│         │          │  └─ fetch municipality value                       │
│         │          ├─ For each of 5 years:                              │
│         │          │  ├─ Riket KPIs: fetch 0000 value                  │
│         │          │  └─ Others: fetch median over all 290 communes     │
│         │          └─ trendBundleCache.set(key, bundle)                 │
│         │                                                                │
│         ▼                                                                │
│  renderTrendChart({ label, unit, trendData5Years, refData5Years })      │
│         │                                                                │
│         ├─ Build SVG 600×300px:                                         │
│         │  ├─ Blue line: Kommune trend                                  │
│         │  ├─ Black dashed: Reference (Riket/Median)                   │
│         │  ├─ Data circles, year labels, value labels                   │
│         │  └─ Legend + unit info                                        │
│         │                                                                │
│         ▼                                                                │
│  trendContainer.innerHTML = chartHtml                                    │
│  detailRow.dataset.loaded = "1"  ← Prevents re-fetch                   │
│                                                                           │
│  Chart visible in details row ✓                                          │
│                                                                           │
│  IF user clicks Fördjupa again:                                          │
│  └─ data-loaded="1" → Skip fetch, just toggle visibility                │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                          CACHE MANAGEMENT                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CACHE LAYERS:                                                             │
│                                                                             │
│  1. municipalityValueCache                                                │
│     ├─ Key: "kpiId_municipalityId_year"                                  │
│     ├─ Value: Single KPI value                                           │
│     └─ Shared across all data layers                                     │
│                                                                             │
│  2. allMunicipalitiesCache                                                │
│     ├─ Key: "kpiId_year"                                                 │
│     ├─ Value: { municipality, value } array for all 290 communes         │
│     └─ Used for median calculation                                       │
│                                                                             │
│  3. trendBundleCache (NEW)                                               │
│     ├─ Key: "kpiId_municipalityId_year"                                  │
│     ├─ Value: { trendData5Years, trendReference5Years, usedMockData }   │
│     └─ Lazy loaded, shared between users                                 │
│                                                                             │
│  CACHE CLEARING:                                                           │
│                                                                             │
│  clearDataCache()                                                          │
│  ├─ ON: Municipality change                                              │
│  ├─ ON: Year change                                                      │
│  ├─ ON: onMunicipalityChange() call                                      │
│  └─ Clears all three caches                                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                       PERFORMANCE TIMELINE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  0ms    User selects kommun & år                                          │
│  │                                                                        │
│  300ms  ORG_KPIS & INDEX_KPIS snapshots loaded                            │
│  │      └─ Tables rendered (Org & Index visible)                         │
│  │      └─ UI becomes interactive                                        │
│  │                                                                        │
│  ├─ [PHASE 1 COMPLETE - USER CAN INTERACT] ◄────────────────────────────┤
│  │                                                                        │
│  1000ms KPI_BLOCKS snapshots loaded                                      │
│  │      └─ Tables rendered (Fördjupa buttons ready)                      │
│  │                                                                        │
│  ├─ [MAIN PAGE LOAD COMPLETE] ◄─────────────────────────────────────────┤
│  │                                                                        │
│  3000ms Background: Executive summary, narrativ text ready                │
│  │                                                                        │
│  ├─ [FULL PAGE INTERACTIVE] ◄─────────────────────────────────────────────┤
│  │                                                                        │
│  ON-DEMAND:                                                               │
│  │  User clicks Fördjupa ▸                                               │
│  │  ├─ First time: ~800ms to fetch bundle + render chart                │
│  │  └─ Cache hit: ~10ms to show details                                  │
│  │                                                                        │
│  [CHART VISIBLE] ◄───────────────────────────────────────────────────────┤
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                    REFERENCE DATA SOURCES                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  For snapshot refMedian:                                                   │
│  ├─ N15505, N15419, N15436, N15540                                        │
│  │  └─ Riket (municipality 0000)                                          │
│  └─ Others                                                                 │
│     └─ Median over all 290 municipalities                                │
│                                                                             │
│  For trend reference line:                                                │
│  ├─ Special KPIs (N15505, etc.)                                           │
│  │  └─ 5-year riket series                                               │
│  └─ Others                                                                 │
│     ├─ Fetch median for each year separately                             │
│     └─ Fallback: MOCK_REFERENCE_DATA                                      │
│                                                                             │
│  Fallback strategy:                                                        │
│  1. Try server-side analysis (analyzeKpiAcrossMunicipalities)             │
│  2. Fall back to fetchAllMunicipalitiesForYear + client-side median       │
│  3. Final fallback: MOCK_REFERENCE_DATA (hardcoded)                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
