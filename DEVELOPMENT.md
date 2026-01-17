# Development Guide

## Code Organization

### File Structure

```
scripts/
├── kommunbild/
│   └── page.js (2376 lines) - Main kommunbild controller
│       ├── KPI Block Definitions
│       ├── Helper Functions (formatValue, classifyLevel, etc.)
│       ├── Data Fetching (Kolada API integration)
│       ├── KPI Computation (snapshot & trend layers)
│       ├── Rendering Functions (table, cards, SVG charts)
│       └── Event Handlers (expandable rows, etc.)
├── test-data-validation.js (275 lines) - Automated test suite
├── kommuner.js - Municipality definitions
└── chartHelpers.js - Chart.js utilities

styles/
├── skolenhetsdashboard.css - Main stylesheet
├── theme.css - Color and design tokens
├── main.css - Base styles
└── executive-summary.css - Executive summary styles

html/
├── skolenhetsdashboard kommun.html - Entry point (gemeente dashboard)
├── test-data-validation.html - Test GUI
└── ... (other views)
```

## Key Functions and Responsibilities

### Data Fetching Layer

**Fast Path (Snapshot):**
```javascript
computeKpiSnapshot({ kpi, municipalityId, forcedYear })
↓
- Fetch current year value
- Fetch previous year value
- Fetch comparison reference (median or riket)
- Compute ranking
- No trend data
```

**Detailed Path (Full Computation):**
```javascript
computeKpiForMunicipality({ kpi, municipalityId, forcedYear })
↓
- Everything from snapshot PLUS
- Fetch 5-year trend data
- Fetch 5-year reference data
- Detect mock data usage
```

**Lazy-Loaded Trend Bundle (On Demand):**
```javascript
fetchKpiTrendBundle({ kpi, municipalityId, year })
↓
- Cached per KPI × municipality × year
- Loads only when user expands a row
- Returns trendData5Years, trendReference5Years, usedMockData
```

### Rendering Layer

**Table Rendering with Expandable Rows:**
```javascript
renderBlockTables(blockResults, forcedYear)
↓
- Creates table structure with KPI rows
- Adds detail rows (hidden by default)
- Sets up event listeners for expand buttons
↓
setupExpandableRowListeners()
↓
loadAndRenderTrendChart(btn, detailRow)
↓
renderTrendChart({ kpiId, label, unit, ... })
```

### Analysis Functions

**Level Classification:**
```javascript
classifyLevel(value)
→ Returns: { label, color, band }
  - "Stark nivå" (90+) - Green
  - "Acceptabel nivå" (80-89) - Blue
  - "Risknivå" (70-79) - Orange
  - "Problemnivå" (<70) - Red
```

**Trend Classification:**
```javascript
classifyTrend(current, previous)
→ Returns: { label, color, dir, strength, delta }
  - Considers magnitude (kraftig, tydlig, svag, stabil)
  - Considers direction (up, down, none)
  - Returns user-friendly label
```

**Interpretation:**
```javascript
buildInterpretation(levelBand, trendDir, trendStrength)
→ Returns narrative text like:
  - "Försämring från hög nivå" (high + down)
  - "Positiv utveckling" (low + up)
  - "Robust läge" (high + stable)
```

## Adding New Features

### Add a New KPI

**Step 1: Define the KPI**
```javascript
// In page.js, add to appropriate KPI_BLOCKS array:
{
  id: 'NEW_KPI_ID',
  label: 'Human readable label',
  unit: '%|kr|index|p|antal',
  higherIsBetter: true|false,  // IMPORTANT for outcome-based labels
  rankable: true|false,         // Whether to show ranking
  kpi_type: 'N|U|...',
}
```

**Step 2: Add Test Data (if testing)**
```javascript
// In test-data-validation.js, update EXPECTED_VALUES:
'NEW_KPI_ID-0684-2024': expectedValue,
'NEW_KPI_ID-0684-2023': expectedValue,
// ... add for all municipalities and years
```

**Step 3: Configure Trend Display (if needed)**
```javascript
// In page.js, add to TREND_YEARS_5 or TREND_YEARS_3:
const TREND_YEARS_5 = new Set([
  // ... existing KPIs
  'NEW_KPI_ID',  // Add here for 5-year trend
]);
```

**Step 4: Test in Kommunbild**
1. Run tests: `node scripts/test-data-validation.js`
2. Open dashboard: `skolenhetsdashboard kommun.html`
3. Verify KPI displays with correct:
   - Values from Kolada
   - Unit formatting
   - Comparison labels (outcome-based)
   - Trend rendering

### Modify Outcome-Based Labels

**For Cost Metrics (Lägre är Bättre):**
```javascript
{ id: 'U15011', label: '...', unit: 'kr', higherIsBetter: false }
// Will render: "Sämre än riket" when cost is HIGHER (bad)
// Will render: "Bättre än riket" when cost is LOWER (good)
```

**For Quality Metrics (Högre är Bättre):**
```javascript
{ id: 'N15505', label: '...', unit: 'poäng', higherIsBetter: true }
// Will render: "Bättre än riket" when value is HIGHER (good)
// Will render: "Sämre än riket" when value is LOWER (bad)
```

The `comparisonLabel()` function (page.js line ~2072) handles this automatically.

## Code Comments and Documentation

### When to Add Comments

**DO comment:**
- Complex algorithms (e.g., scale functions in SVG rendering)
- Non-obvious business logic (e.g., why certain KPIs use riket vs median)
- Integration points with external systems (Kolada API)
- Configuration decisions (tolerance levels, trend spans)
- Workarounds and edge cases

**DON'T comment:**
- Obvious code: `const year = Number(y);`
- Self-documenting names: `formatDeltaText()`
- Repeated info from function signature

### Example Comments

**Good:**
```javascript
// Convert difference to "better" direction based on KPI polarity
// For higherIsBetter KPIs: positive diff = improvement
// For lowerIsBetter KPIs: negative diff = improvement
function orientedDiff(current, reference, higherIsBetter) {
```

**Bad:**
```javascript
// Subtract reference from current
const diff = c - r;
```

## Testing Guidelines

### Running Tests

**Automated Test Suite:**
```bash
# All tests
node scripts/test-data-validation.js

# Specific municipality
node scripts/test-data-validation.js --municipality=0684

# Specific year
node scripts/test-data-validation.js --year=2024

# Specific KPI
node scripts/test-data-validation.js --kpis=N15505,N15031
```

**Interactive Test GUI:**
```bash
# Open in browser
open test-data-validation.html
```

### Test Coverage

**Current Tests:** 36 cases (6 KPIs × 3 municipalities × 2 years)
- **Coverage:** ~92% pass rate (33/36 typically)
- **Expected failures:** U15401 2023 (not yet published)

**When to Update Tests:**
- Add/modify KPI definitions
- Kolada publishes new data
- Change dashboard values for other reasons

## Performance Considerations

### Caching Strategy

**In-Memory Caches:**
- `kpiMetaCache` - KPI metadata (stable, cached per session)
- `municipalityValueCache` - Single-point values (keyed by KPI-municipality-year)
- `allMunicipalitiesCache` - All municipalities for a KPI-year (large, reused often)
- `trendBundleCache` - 5-year trends (keyed by KPI-municipality-year, lazy-loaded)

**Clear caches when:**
- User changes municipality or year
- Suspected stale data
- Session ends

### Lazy Loading

**Snapshot (Fast):**
- Loads immediately when municipality/year selected
- Shows main table without trends

**Trend Bundle (Lazy):**
- Loads only when user clicks expand button
- Cached for subsequent expands
- Reduces initial page load time

## Common Tasks

### Update Test Data

1. Check Kolada for new publications: https://www.kolada.se
2. Update `EXPECTED_VALUES` in test-data-validation.js
3. Run test suite: `node scripts/test-data-validation.js`
4. Verify all tests pass

### Debug a Failing KPI

1. Check browser console (F12) for errors
2. Look for `[kommunbild]` log messages
3. Verify KPI is in correct KPI_BLOCKS
4. Check Kolada API directly: `https://api.kolada.se/v2/data/kpi/{KPI_ID}/municipality/{MUNICIPALITY}`
5. Run test suite to see if data validation passes

### Add a New Municipality

1. Municipality list in `scripts/kommuner.js`
2. Add test data to EXPECTED_VALUES
3. Test with interactive HTML view
4. Consider updating jämförelsekommuner if applicable

## Git Workflow

### Branch Naming

```
feature/add-outcome-labels
feature/improve-trend-chart
fix/tolerance-calculation
docs/update-architecture
chore/update-test-data
```

### Commit Messages

```
feat: Add outcome-based comparison labels

- Implement comparisonLabel() function
- Update all KPI comparisons to use semantic labels
- Add higherIsBetter flag to 35 KPI definitions
- Passes 92% of test suite (33/36 tests)

Fixes #23
```

```
chore: Update test data for 2024 publications

New Kolada data published for:
- N15505 (meritvärde) 2024
- N15031 (lärare examen) 2024
- U15401 (kvalitetsindex) 2024

All 36 tests now pass (was 33/36)
```

## Deployment

### Local Testing
```bash
# Development server (if available)
npm run dev
```

### Production Build
```bash
# GitHub Actions handles this automatically on main branch
# See .github/workflows/deploy.yml
```

### Rollback
```bash
git revert [commit-hash]
git push origin main
```

---

**Last Updated:** 2026-01-17
**Audience:** Developers
**Status:** Production Ready ✓
