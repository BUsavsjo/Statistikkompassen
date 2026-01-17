# Test Architecture Documentation

## Overview

The automated test suite for Kommunbild-dashboarden consists of three integrated components:

```
┌─────────────────────────────────────────────────────────────┐
│          KOMMUNBILD DATA VALIDATION SYSTEM                  │
└─────────────────────────────────────────────────────────────┘
        ↓                    ↓                    ↓
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ Node.js CLI Test │ │ Interactive HTML │ │     Test Data    │
│ (Automated)      │ │ GUI (Manual)     │ │ (Expected Values)│
└──────────────────┘ └──────────────────┘ └──────────────────┘
        ↓                    ↓                    ↓
     Kolada API          Kolada API        TEST_CONFIG
                         (on demand)       EXPECTED_VALUES
```

## Component 1: Node.js CLI Test (`scripts/test-data-validation.js`)

### Purpose
Automated validation of dashboard values against Kolada API for CI/CD pipelines.

### Architecture

```javascript
// Configuration
const TEST_CONFIG = {
  kpis: [...],           // 6 representative KPIs
  municipalities: [...], // 3 sample municipalities
  years: [2024, 2023],   // 2 years
  tolerancePercent: 0.5  // Tolerance for rounding
}

// Test Data
const EXPECTED_VALUES = {
  'KPI_ID-MUNICIPALITY-YEAR': expectedValue,
  ...
}

// Test Execution
class TestResult {
  validate(apiValue) { ... } // Compare with tolerance
  formatOutput() { ... }      // Format for display
}

// Main Process
async function runAllTests() {
  // For each combination of KPI × municipality × year:
  // 1. Fetch from Kolada API
  // 2. Validate against EXPECTED_VALUES
  // 3. Report pass/fail
}
```

### Test Cases

**36 Total Test Cases:**
- 6 KPIs (N15505, N15031, U15011, N15034, N15814, U15401)
- 3 Municipalities (0684 Sävsjö, 0180 Stockholm, 1480 Göteborg)
- 2 Years (2024, 2023)
- 6 × 3 × 2 = 36 tests

**Expected Pass Rate:**
- ~92% (33/36 pass)
- 3 expected failures: U15401 year 2023 (not yet published)

### Execution

```bash
# Run all tests
node scripts/test-data-validation.js

# Filter tests
node scripts/test-data-validation.js --municipality=0684
node scripts/test-data-validation.js --year=2024
node scripts/test-data-validation.js --kpis=N15505,N15031
```

### Output

**Console Report:**
```
═══════════════════════════════════════════════════════════════
Test Results: 33 passed, 3 warnings, 0 failed (33/36 = 92%)
════════════════════════════════════════════════════════════════
✓ SÄVSJÖ (0684): 11 passed, 1 warning
✓ STOCKHOLM (0180): 11 passed, 1 warning
✓ GÖTEBORG (1480): 11 passed, 1 warning
════════════════════════════════════════════════════════════════
```

**Exit Codes:**
- `0`: All tests passed
- `1`: One or more tests failed or warning (can be configured)

## Component 2: Interactive HTML Test View (`test-data-validation.html`)

### Purpose
Manual browser-based test interface for exploratory validation.

### Features

1. **Municipality Selector** - Choose from 290 Swedish municipalities
2. **Year Selector** - Select any available year (2020-2024)
3. **KPI Selector** - Toggle KPI sets or individual KPIs
4. **Test Cards** - Visual pass/fail indicators with exact values
5. **Status Panel** - Summary statistics (passed/failed/total)
6. **Responsive Design** - Works on desktop, tablet, mobile

### Architecture

```html
<!-- Top Controls -->
<select id="municipalitySelect">...</select>
<select id="yearSelect">...</select>
<div class="kpi-buttons">
  <button class="kpi-btn" data-kpi="N15505">...</button>
  ...
</div>

<!-- Results Grid -->
<div class="test-results">
  <div class="test-card">
    <h3>KPI Label</h3>
    <div class="status">✓ PASS</div>
    <p>Expected: 123.4</p>
    <p>Actual: 123.5</p>
    <p>Difference: +0.1 (0.08%)</p>
  </div>
  ...
</div>

<!-- Summary -->
<div class="summary">
  <div class="stat">Passed: 33</div>
  <div class="stat">Failed: 0</div>
  <div class="stat">Warnings: 3</div>
</div>
```

### Usage

1. Open in browser: `test-data-validation.html`
2. Select municipality, year, and KPIs
3. Click "Run Tests"
4. Review results with visual feedback:
   - ✓ Green border = Pass
   - ✗ Red border = Fail
   - ⚠ Yellow border = Warning

## Component 3: Test Data Management (`EXPECTED_VALUES`)

### Structure

```javascript
const EXPECTED_VALUES = {
  'N15505-0684-2024': 213.8,   // KPI-Municipality-Year format
  'N15505-0684-2023': 213.2,
  'N15031-0684-2024': 81.5,
  ...
  'U15401-0684-2023': null,    // null = not yet published
}
```

### Data Updates

**Manual Update Process:**
1. When Kolada publishes new data
2. Edit `EXPECTED_VALUES` object with new values
3. Run tests to verify

**Automated Update (Future):**
- GitHub Actions scheduled job monthly
- MCP Kolada integration fetches fresh data
- Auto-updates EXPECTED_VALUES
- Runs test suite
- Commits changes if all pass

## Tolerance Strategy

**0.5% Tolerance Rule:**

For each test:
```
difference = |API_VALUE - EXPECTED_VALUE|
tolerance = EXPECTED_VALUE × 0.005
passed = difference <= tolerance
```

**Why 0.5%?**
- Accounts for minor rounding differences in Kolada API
- Small enough to catch real data divergence
- Large enough to avoid false negatives

### Example
```
Expected: 100.0
API Value: 100.4
Tolerance: 100.0 × 0.005 = 0.5
Difference: 0.4 ≤ 0.5 ✓ PASS
```

## Integration Points

### Kolada API Integration

**Current:**
```javascript
async function fetchFromKolada(kpiId, municipality, year) {
  const url = `https://api.kolada.se/v2/data/kpi/${kpiId}/municipality/${municipality}`;
  const json = await fetch(url).then(r => r.json());
  // Extract value from response
}
```

**Future (MCP):**
```javascript
// Through MCP Kolada server
const result = await kolada.get_kpi_data({
  kpi_id: kpiId,
  municipality_id: municipality,
  years: [year],
  gender: 'T'
});
```

### CI/CD Integration

**GitHub Actions Workflow:**
```yaml
name: Data Validation

on:
  schedule:
    - cron: '0 10 1 * *'  # Monthly

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: node scripts/test-data-validation.js
      - run: git commit -am "chore: update test data" || echo "No changes"
      - run: git push
```

## Maintenance

### Monthly Tasks
- [ ] Run test suite manually
- [ ] Check Kolada for new data publications
- [ ] Update `EXPECTED_VALUES` if needed
- [ ] Verify test pass rate remains ≥ 90%

### Quarterly Tasks
- [ ] Review tolerance level appropriateness
- [ ] Update test KPI selection if dashboard changes
- [ ] Test with new municipalities if added
- [ ] Document any API changes or surprises

### Annual Tasks
- [ ] Archive old test data
- [ ] Update documentation
- [ ] Implement MCP Kolada live-validation if feasible
- [ ] Plan next generation test architecture

## Future Enhancements

### Phase 1: Live Validation (Q1 2026)
- Use MCP Kolada API instead of HTTP fetch
- Real-time data comparison
- Automatic test data updates

### Phase 2: Visual Dashboard (Q2 2026)
- Web-based test result dashboard
- Historical trend of test results
- Automated alerts on failures

### Phase 3: Smart Testing (Q3 2026)
- ML-based tolerance adjustment
- Detect patterns in data changes
- Predict publication timing

## Troubleshooting

### Test Failures

**Issue:** API timeout
- **Solution:** Check Kolada API availability at api.kolada.se

**Issue:** 404 on municipality
- **Solution:** Verify municipality ID is correct (4-digit format)

**Issue:** Unexpected tolerance breach
- **Solution:** 
  1. Verify EXPECTED_VALUES is up-to-date
  2. Check if Kolada published new data
  3. Increase tolerance if systematic drift detected

### Test Maintenance

**When test data becomes stale:**
1. Run test suite monthly
2. Check for new Kolada publications
3. Update EXPECTED_VALUES immediately
4. Document reason for change in commit message

**When adding new KPIs to dashboard:**
1. Add KPI definition to TEST_CONFIG.kpis
2. Add test data to EXPECTED_VALUES for all years/municipalities
3. Run test suite to verify
4. Document in this architecture file

---

**Last Updated:** 2026-01-17
**Maintained By:** Development Team
**Status:** Production Ready ✓
