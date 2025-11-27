/**
 * JÄMFÖRELSESYSTEM FÖR STYRANDE SKOLBILD
 * 
 * Implementerar strukturerade jämförelseregler per indikatortyp enligt specifikation:
 * - Resultatindikatorer: Riket + Liknande skolor/kommuner + Trend (3 år)
 * - Förutsättningar: Kommun + Riket + Trend (3 år)  
 * - Trygghet/studiero: Riket + Kommun + Trend (3 år)
 * - SALSA: Förväntat vs faktiskt + Liknande kommuner som kontext
 */

import { API_BASE, SKOLENHET_DATA_BASE } from '../constants.js';

const RIKET_ID = '0000';
const CACHE = new Map();

/**
 * Bestämmer vilken jämförelseregel som gäller för en given KPI
 * @param {string} kpiId - KPI-ID (ex: N15482)
 * @returns {string} - 'resultat', 'forutsattningar', 'trygghet', eller 'salsa'
 */
export function getComparisonRule(kpiId) {
  // Resultatindikatorer (betyg, måluppfyllelse)
  const resultatKPIs = [
    'N15482', 'N15485', 'N15488', // Åk 6 engelska, matematik, svenska minst E
    'N15509', 'N15510', 'N15539', 'N15516', // Åk 6 betygspoäng och alla ämnen
    'N15419', 'N15436', 'N15505', 'N15503', // Åk 9 godkända, behöriga, meritvärde, betygspoäng
    'U15429', 'U15430', 'U15431', 'U15432', 'U15433', 'U15434' // Åk 9 NP-jämförelser
  ];
  
  // Förutsättningar (behörighet, resurser, elevtal)
  const forutsattningarKPIs = [
    'N11805', 'N15807', 'N15034', 'N15813', 'N15031'
  ];
  
  // Trygghet och studiero
  const trygghetsKPIs = [
    'N15613', 'N15603', 'N15614'
  ];
  
  // SALSA (förväntat vs faktiskt)
  const salsaKPIs = [
    'U15413', 'U15414', 'U15415', 'U15416'
  ];
  
  if (resultatKPIs.includes(kpiId)) return 'resultat';
  if (forutsattningarKPIs.includes(kpiId)) return 'forutsattningar';
  if (trygghetsKPIs.includes(kpiId)) return 'trygghet';
  if (salsaKPIs.includes(kpiId)) return 'salsa';
  
  return 'resultat'; // Fallback
}

/**
 * Hämtar KPI-data från Kolada API v3
 * @param {string} kpiId - KPI-ID
 * @param {string} entityId - Kommun- eller OU-ID
 * @param {string} entityType - 'municipality' eller 'ou'
 * @param {number} years - Antal år bakåt (default 4 för 3-årstrend)
 * @returns {Promise<Object>} - { years: [], values: [] }
 */
async function fetchKoladaData(kpiId, entityId, entityType = 'municipality', years = 4) {
  const cacheKey = `${kpiId}_${entityId}_${entityType}_${years}`;
  
  if (CACHE.has(cacheKey)) {
    return CACHE.get(cacheKey);
  }
  
  const base = entityType === 'ou' ? SKOLENHET_DATA_BASE : API_BASE;
  const suffix = entityType === 'ou' ? `ou/${entityId}` : `municipality/${entityId}`;
  const url = `${base}/${kpiId}/${suffix}`;
  
  try {
    const response = await fetch(url, {
      mode: 'cors',
      headers: { Accept: 'application/json' }
    });
    
    if (!response.ok) {
      console.warn(`Kolada API error for ${kpiId}/${entityId}: ${response.status}`);
      return { years: [], values: [] };
    }
    
    const json = await response.json();
    const values = json.values || [];
    
    // Extrahera de senaste N åren, sortera kronologiskt
    const sorted = values
      .sort((a, b) => parseInt(a.period) - parseInt(b.period))
      .slice(-years);
    
    const result = {
      years: sorted.map(v => parseInt(v.period)),
      values: sorted.map(v => {
        // Hitta totalt värde (gender='T' eller första tillgängliga)
        const totalVal = v.values?.find(x => x.gender === 'T');
        return totalVal?.value ?? v.values?.[0]?.value ?? null;
      })
    };
    
    CACHE.set(cacheKey, result);
    return result;
    
  } catch (error) {
    console.error(`Failed to fetch ${kpiId} for ${entityId}:`, error);
    return { years: [], values: [] };
  }
}

/**
 * Hämtar lista över liknande kommuner från Kolada/RKA-gruppering
 * @param {string} municipalityCode - Kommunkod (ex: '0684')
 * @returns {Promise<Array>} - Lista med kommunkoder för liknande kommuner
 */
async function fetchSimilarMunicipalities(municipalityCode) {
  // RKA:s kommungrupper finns i Kolada metadata
  // För grundskola används "Liknande kommuner grundskola" (7 mest lika)
  // Denna endpoint kan variera, så vi använder en generell lösning
  
  // Temporär hårdkodad mapping för demonstration
  // I produktion: hämta från Kolada metadata eller RKA API
  const similarGroups = {
    '0684': ['0680', '0685', '0686', '0682', '0665', '0687', '0764'], // Sävsjö + liknande
    '0680': ['0684', '0685', '0686', '0682', '0665', '0687', '0764'], // Jönköping + liknande
    // Lägg till fler kommuner efter behov
  };
  
  return similarGroups[municipalityCode] || [];
}

/**
 * Beräknar gruppsnitt för liknande kommuner
 * @param {string} kpiId - KPI-ID
 * @param {Array<string>} municipalityCodes - Lista med kommunkoder
 * @param {number} year - Vilket år (senaste om null)
 * @returns {Promise<number|null>} - Medelvärde eller null om data saknas
 */
async function calculateGroupAverage(kpiId, municipalityCodes, year = null) {
  const dataPromises = municipalityCodes.map(code => 
    fetchKoladaData(kpiId, code, 'municipality', 4)
  );
  
  const results = await Promise.all(dataPromises);
  
  // Hitta senaste året om inget angivet
  const targetYear = year || Math.max(...results.flatMap(r => r.years));
  
  // Samla värden för målåret
  const values = results
    .map(r => {
      const idx = r.years.indexOf(targetYear);
      return idx >= 0 ? r.values[idx] : null;
    })
    .filter(v => v !== null);
  
  if (values.length === 0) return null;
  
  // Beräkna medelvärde
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Beräknar trend från tidsseriedata
 * @param {Array<number>} values - Värden i kronologisk ordning
 * @returns {Object} - { direction: 'up'|'down'|'flat', change: number }
 */
function calculateTrend(values) {
  if (!values || values.length < 2) {
    return { direction: 'flat', change: 0 };
  }
  
  const latest = values[values.length - 1];
  const earliest = values[0];
  
  if (latest === null || earliest === null) {
    return { direction: 'flat', change: 0 };
  }
  
  const change = latest - earliest;
  
  // Tröskel för signifikant förändring: ±0.5 för procent/poäng
  const threshold = 0.5;
  
  if (Math.abs(change) < threshold) {
    return { direction: 'flat', change: 0 };
  }
  
  return {
    direction: change > 0 ? 'up' : 'down',
    change: change
  };
}

/**
 * Hämtar fullständiga jämförelsedata för en KPI enligt regelverket
 * @param {string} kpiId - KPI-ID
 * @param {string} entityId - Kommun- eller OU-ID  
 * @param {string} municipalityCode - Kommunkod (för gruppjämförelse)
 * @param {string} entityType - 'municipality' eller 'ou'
 * @returns {Promise<Object>} - Fullständigt jämförelseobjekt
 */
export async function fetchComparisonData(kpiId, entityId, municipalityCode, entityType = 'ou') {
  const rule = getComparisonRule(kpiId);
  
  // Hämta huvuddata
  const mainData = await fetchKoladaData(kpiId, entityId, entityType, 4);
  
  if (mainData.years.length === 0 || mainData.values.every(v => v === null)) {
    return {
      kpi_id: kpiId,
      years: [],
      values: {},
      deltas: {},
      trend: { direction: 'flat', change: 0 },
      rule_bucket: rule,
      available: false
    };
  }
  
  const latestYear = mainData.years[mainData.years.length - 1];
  const latestValue = mainData.values[mainData.values.length - 1];
  
  const result = {
    kpi_id: kpiId,
    years: mainData.years,
    values: {
      main: mainData.values
    },
    deltas: {},
    trend: calculateTrend(mainData.values),
    rule_bucket: rule,
    available: true
  };
  
  // Hämta jämförelsedata baserat på regel
  switch (rule) {
    case 'resultat':
      // Riket + Liknande skolor/kommuner + Trend
      const riketData = await fetchKoladaData(kpiId, RIKET_ID, 'municipality', 4);
      result.values.riket = riketData.values;
      
      if (riketData.values.length > 0) {
        const riketLatest = riketData.values[riketData.values.length - 1];
        if (riketLatest !== null && latestValue !== null) {
          result.deltas.main_vs_riket = latestValue - riketLatest;
        }
      }
      
      // Liknande kommuner
      const similarMunicipalities = await fetchSimilarMunicipalities(municipalityCode);
      if (similarMunicipalities.length > 0) {
        const groupAvg = await calculateGroupAverage(kpiId, similarMunicipalities, latestYear);
        if (groupAvg !== null) {
          result.values.liknande = [groupAvg]; // Endast senaste året för liknande
          if (latestValue !== null) {
            result.deltas.main_vs_liknande = latestValue - groupAvg;
          }
        }
      }
      
      // Kommun som sekundärt värde
      if (entityType === 'ou') {
        const kommunData = await fetchKoladaData(kpiId, municipalityCode, 'municipality', 4);
        result.values.kommun_secondary = kommunData.values;
      }
      break;
      
    case 'forutsattningar':
      // Kommun + Riket + Trend
      if (entityType === 'ou') {
        const kommunData = await fetchKoladaData(kpiId, municipalityCode, 'municipality', 4);
        result.values.kommun = kommunData.values;
        
        if (kommunData.values.length > 0) {
          const kommunLatest = kommunData.values[kommunData.values.length - 1];
          if (kommunLatest !== null && latestValue !== null) {
            result.deltas.main_vs_kommun = latestValue - kommunLatest;
          }
        }
      }
      
      const riketDataForutsattningar = await fetchKoladaData(kpiId, RIKET_ID, 'municipality', 4);
      result.values.riket = riketDataForutsattningar.values;
      
      if (riketDataForutsattningar.values.length > 0) {
        const riketLatest = riketDataForutsattningar.values[riketDataForutsattningar.values.length - 1];
        if (riketLatest !== null && latestValue !== null) {
          result.deltas.main_vs_riket = latestValue - riketLatest;
        }
      }
      break;
      
    case 'trygghet':
      // Riket + Kommun + Trend
      const riketDataTrygghet = await fetchKoladaData(kpiId, RIKET_ID, 'municipality', 4);
      result.values.riket = riketDataTrygghet.values;
      
      if (riketDataTrygghet.values.length > 0) {
        const riketLatest = riketDataTrygghet.values[riketDataTrygghet.values.length - 1];
        if (riketLatest !== null && latestValue !== null) {
          result.deltas.main_vs_riket = latestValue - riketLatest;
        }
      }
      
      if (entityType === 'ou') {
        const kommunDataTrygghet = await fetchKoladaData(kpiId, municipalityCode, 'municipality', 4);
        result.values.kommun = kommunDataTrygghet.values;
        
        if (kommunDataTrygghet.values.length > 0) {
          const kommunLatest = kommunDataTrygghet.values[kommunDataTrygghet.values.length - 1];
          if (kommunLatest !== null && latestValue !== null) {
            result.deltas.main_vs_kommun = latestValue - kommunLatest;
          }
        }
      }
      break;
      
    case 'salsa':
      // Förväntat vs faktiskt (SALSA är redan avvikelse i vissa KPIer)
      // U15414 = Avvikelse från SALSA (redan beräknad)
      // U15413 = SALSA modellberäknad andel (förväntad)
      // Hämta motsvarande faktiskt resultat för kontext
      
      if (kpiId === 'U15414' || kpiId === 'U15416') {
        // Detta är redan avvikelsen, visa som är
        result.values.avvikelse = mainData.values;
        
        // Hämta förväntat värde (U15413 för U15414, U15415 för U15416)
        const expectedKpiId = kpiId === 'U15414' ? 'U15413' : 'U15415';
        const expectedData = await fetchKoladaData(expectedKpiId, entityId, entityType, 4);
        result.values.forvantad = expectedData.values;
        
        // Hämta faktiskt värde (N15419 för U15414, N15505 för U15416)
        const actualKpiId = kpiId === 'U15414' ? 'N15419' : 'N15505';
        const actualData = await fetchKoladaData(actualKpiId, entityId, entityType, 4);
        result.values.faktisk = actualData.values;
      }
      
      // Liknande kommuner som kontext
      const similarForSalsa = await fetchSimilarMunicipalities(municipalityCode);
      if (similarForSalsa.length > 0) {
        const groupAvg = await calculateGroupAverage(kpiId, similarForSalsa, latestYear);
        if (groupAvg !== null) {
          result.values.liknande = [groupAvg];
        }
      }
      break;
  }
  
  return result;
}

/**
 * Formaterar jämförelsedata till användarvänlig text
 * @param {Object} comparisonData - Data från fetchComparisonData
 * @param {string} unit - Enhet (%, poäng, st, etc.)
 * @returns {string} - Formaterad text för UI
 */
export function formatComparisonText(comparisonData, unit = '%') {
  if (!comparisonData.available) {
    return 'Data ej tillgänglig';
  }
  
  const { values, deltas, trend, rule_bucket } = comparisonData;
  const latestValue = values.main[values.main.length - 1];
  
  if (latestValue === null) {
    return 'Data saknas för senaste året';
  }
  
  // Formatera huvudvärde
  let text = `${latestValue.toFixed(1)}${unit}`;
  
  // Lägg till jämförelser baserat på regel
  const comparisons = [];
  
  if (deltas.main_vs_riket !== undefined) {
    const diff = deltas.main_vs_riket;
    const riketValue = values.riket[values.riket.length - 1];
    const sign = diff >= 0 ? '+' : '';
    comparisons.push(`Riket ${riketValue.toFixed(1)}${unit} (${sign}${diff.toFixed(1)} procentenheter)`);
  }
  
  if (deltas.main_vs_kommun !== undefined) {
    const diff = deltas.main_vs_kommun;
    const kommunValue = values.kommun[values.kommun.length - 1];
    const sign = diff >= 0 ? '+' : '';
    comparisons.push(`Kommun ${kommunValue.toFixed(1)}${unit} (${sign}${diff.toFixed(1)} procentenheter)`);
  }
  
  if (deltas.main_vs_liknande !== undefined) {
    const diff = deltas.main_vs_liknande;
    const liknandeValue = values.liknande[0];
    const sign = diff >= 0 ? '+' : '';
    comparisons.push(`Liknande ${liknandeValue.toFixed(1)}${unit} (${sign}${diff.toFixed(1)} procentenheter)`);
  }
  
  // Lägg till trend
  let trendText = '→ stabilt';
  if (trend.direction === 'up') {
    trendText = `↗ +${trend.change.toFixed(1)} procentenheter (3 år)`;
  } else if (trend.direction === 'down') {
    trendText = `↘ ${trend.change.toFixed(1)} procentenheter (3 år)`;
  }
  
  // Kombinera allt
  if (comparisons.length > 0) {
    text += ` (${comparisons.join(', ')}) ${trendText}`;
  } else {
    text += ` ${trendText}`;
  }
  
  return text;
}

/**
 * Skapar strukturerad jämförelsedata för en KPI enligt specifikationen
 * @param {string} kpiId - KPI-ID
 * @param {string} name - KPI-namn
 * @param {string} unit - Enhet
 * @param {string} entityId - Enhet-ID
 * @param {string} municipalityCode - Kommunkod
 * @param {string} entityType - 'municipality' eller 'ou'
 * @returns {Promise<Object>} - Komplett KPI-objekt med jämförelser
 */
export async function createKPIComparison(kpiId, name, unit, entityId, municipalityCode, entityType = 'ou') {
  const comparisonData = await fetchComparisonData(kpiId, entityId, municipalityCode, entityType);
  
  return {
    kpi_id: kpiId,
    name: name,
    unit: unit,
    years: comparisonData.years,
    values: comparisonData.values,
    deltas: comparisonData.deltas,
    trend: comparisonData.trend,
    rule_bucket: comparisonData.rule_bucket,
    formattedText: formatComparisonText(comparisonData, unit),
    available: comparisonData.available
  };
}

/**
 * Rensar cache (användbart vid byte av kommun/enhet)
 */
export function clearCache() {
  CACHE.clear();
}
