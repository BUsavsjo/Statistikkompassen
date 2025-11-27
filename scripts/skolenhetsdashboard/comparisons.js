/**
 * JÄMFÖRELSESYSTEM FÖR STYRANDE SKOLBILD
 * 
 * Implementerar strukturerade jämförelseregler per indikatortyp enligt specifikation:
 * - PRIMÄR JÄMFÖRELSE: Kommungenomsnitt inom samma skolform (F-6, 7-9, F-9)
 * - SEKUNDÄR REFERENS: Riksgenomsnitt inom samma skolform (endast visning, ej för färger/badges)
 * - Resultatindikatorer: Kommungenomsnitt samma skolform + Riket som referens + Trend (3 år)
 * - Förutsättningar: Kommungenomsnitt samma skolform + Riket som referens + Trend (3 år)  
 * - Trygghet/studiero: Kommungenomsnitt samma skolform + Riket som referens + Trend (3 år)
 * - SALSA: Förväntat vs faktiskt + Kommun som kontext
 * 
 * OBS: Om kommungruppen är för liten (<3 enheter), använd neutral status och visa endast riket som referens.
 */

import { API_BASE, SKOLENHET_DATA_BASE, SKOLENHET_SEARCH_API } from '../constants.js';

const RIKET_ID = '0000';
const CACHE = new Map();
const MIN_GROUP_SIZE = 3; // Minsta antal enheter för stabil jämförelse

/**
 * Detekterar skolform från OU-data
 * @param {string} ouId - OU-ID för skolenheten
 * @returns {Promise<string>} - 'F-6', '7-9', 'F-9', eller null
 */
export async function detectSchoolType(ouId) {
  const cacheKey = `schooltype_${ouId}`;
  if (CACHE.has(cacheKey)) {
    return CACHE.get(cacheKey);
  }
  
  try {
    // Hämta skolenhetens information från Kolada API
    const response = await fetch(`${SKOLENHET_SEARCH_API}?id=${ouId}`, {
      headers: { Accept: 'application/json' }
    });
    
    if (!response.ok) {
      console.warn(`Could not fetch school info for ${ouId}`);
      return null;
    }
    
    const data = await response.json();
    const results = data.results || data.values || [];
    
    if (results.length === 0) return null;
    
    const school = results[0];
    const typeName = (school.type || school.type_name || '').toLowerCase();
    
    // Mappa typer till skolform
    let schoolType = null;
    if (typeName.includes('f-6') || typeName.includes('f6') || typeName.includes('förskoleklass och grundskola f-6')) {
      schoolType = 'F-6';
    } else if (typeName.includes('7-9') || typeName.includes('79') || typeName.includes('grundskola 7-9')) {
      schoolType = '7-9';
    } else if (typeName.includes('f-9') || typeName.includes('f9') || typeName.includes('förskoleklass och grundskola f-9')) {
      schoolType = 'F-9';
    }
    
    CACHE.set(cacheKey, schoolType);
    return schoolType;
    
  } catch (error) {
    console.error(`Error detecting school type for ${ouId}:`, error);
    return null;
  }
}

/**
 * Hämtar alla skolenheter i kommunen med samma skolform
 * @param {string} municipalityCode - Kommunkod
 * @param {string} schoolType - Skolform ('F-6', '7-9', 'F-9')
 * @returns {Promise<Array>} - Lista med OU-ID för enheter med samma skolform
 */
async function fetchSchoolsInMunicipalityByType(municipalityCode, schoolType) {
  const cacheKey = `schools_${municipalityCode}_${schoolType}`;
  if (CACHE.has(cacheKey)) {
    return CACHE.get(cacheKey);
  }
  
  try {
    let url = `${SKOLENHET_SEARCH_API}?municipality=${municipalityCode}&per_page=500`;
    const schools = [];
    
    while (url) {
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) break;
      
      const data = await response.json();
      const results = data.results || data.values || [];
      
      results.forEach(school => {
        const typeName = (school.type || school.type_name || '').toLowerCase();
        let matchType = null;
        
        if (typeName.includes('f-6') || typeName.includes('f6')) matchType = 'F-6';
        else if (typeName.includes('7-9') || typeName.includes('79')) matchType = '7-9';
        else if (typeName.includes('f-9') || typeName.includes('f9')) matchType = 'F-9';
        
        if (matchType === schoolType) {
          schools.push(school.id);
        }
      });
      
      url = data.next_page || data.next || null;
    }
    
    CACHE.set(cacheKey, schools);
    return schools;
    
  } catch (error) {
    console.error(`Error fetching schools in ${municipalityCode} of type ${schoolType}:`, error);
    return [];
  }
}

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
 * Beräknar kommungenomsnitt för skolenheter med samma skolform
 * @param {string} kpiId - KPI-ID
 * @param {string} municipalityCode - Kommunkod
 * @param {string} schoolType - Skolform ('F-6', '7-9', 'F-9')
 * @param {number} year - Vilket år (senaste om null)
 * @returns {Promise<Object>} - { average: number|null, count: number, schoolIds: Array }
 */
async function calculateMunicipalityAverageBySchoolType(kpiId, municipalityCode, schoolType, year = null) {
  // Hämta alla skolenheter i kommunen med samma skolform
  const schoolIds = await fetchSchoolsInMunicipalityByType(municipalityCode, schoolType);
  
  if (schoolIds.length < MIN_GROUP_SIZE) {
    return { average: null, count: schoolIds.length, schoolIds, insufficient: true };
  }
  
  // Hämta KPI-data för alla skolenheter
  const dataPromises = schoolIds.map(ouId => 
    fetchKoladaData(kpiId, ouId, 'ou', 4)
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
  
  if (values.length === 0) {
    return { average: null, count: 0, schoolIds, insufficient: true };
  }
  
  // Kontrollera om vi har tillräckligt med data
  if (values.length < MIN_GROUP_SIZE) {
    return { average: null, count: values.length, schoolIds, insufficient: true };
  }
  
  // Beräkna medelvärde
  const average = values.reduce((sum, val) => sum + val, 0) / values.length;
  
  return { average, count: values.length, schoolIds, insufficient: false };
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
 * UPPDATERAD: Använder kommungenomsnitt inom samma skolform som primär jämförelse
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
      available: false,
      schoolType: null,
      groupInsufficient: false
    };
  }
  
  const latestYear = mainData.years[mainData.years.length - 1];
  const latestValue = mainData.values[mainData.values.length - 1];
  
  // Detektera skolform för OU
  let schoolType = null;
  if (entityType === 'ou') {
    schoolType = await detectSchoolType(entityId);
  }
  
  const result = {
    kpi_id: kpiId,
    years: mainData.years,
    values: {
      main: mainData.values
    },
    deltas: {},
    trend: calculateTrend(mainData.values),
    rule_bucket: rule,
    available: true,
    schoolType: schoolType,
    groupInsufficient: false
  };
  
  // Hämta riksdata som sekundär referens (visas alltid men används ej för färger)
  const riketData = await fetchKoladaData(kpiId, RIKET_ID, 'municipality', 4);
  result.values.riket_reference = riketData.values;
  
  if (riketData.values.length > 0) {
    const riketLatest = riketData.values[riketData.values.length - 1];
    if (riketLatest !== null && latestValue !== null) {
      result.deltas.main_vs_riket_reference = latestValue - riketLatest;
    }
  }
  
  // Hämta kommungenomsnitt inom samma skolform (PRIMÄR JÄMFÖRELSE)
  if (entityType === 'ou' && schoolType) {
    const municipalityAvg = await calculateMunicipalityAverageBySchoolType(
      kpiId, 
      municipalityCode, 
      schoolType, 
      latestYear
    );
    
    if (municipalityAvg.insufficient) {
      // För liten grupp - använd neutral status
      result.groupInsufficient = true;
      result.values.kommun_schooltype = null;
      result.municipalityGroupSize = municipalityAvg.count;
    } else {
      // Tillräcklig gruppstorlek - använd som primär jämförelse
      result.values.kommun_schooltype = [municipalityAvg.average];
      result.municipalityGroupSize = municipalityAvg.count;
      
      if (latestValue !== null) {
        result.deltas.main_vs_kommun_schooltype = latestValue - municipalityAvg.average;
      }
    }
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
