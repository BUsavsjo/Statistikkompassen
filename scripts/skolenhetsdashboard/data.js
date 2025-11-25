// Data access module for Kolada v3 API
// Handles fetching and caching of OU and KPI data
// Uses the same logic as betygkolada.js for consistency

const API_BASE = "https://api.kolada.se/v3/data/kpi";
const SKOLENHET_DATA_BASE = "https://api.kolada.se/v3/oudata/kpi";
const OU_API_BASE = "https://api.kolada.se/v3/ou";
const cache = {};

/**
 * Fetch all OUs (organizational units / school units) for a municipality
 * @param {string} municipalityCode - The municipality code (e.g., "0686")
 * @returns {Promise<Array>} Array of OU objects
 */
export async function fetchOUs(municipalityCode) {
  const cacheKey = `ous_${municipalityCode}`;
  if (cache[cacheKey]) {
    console.log('Returning cached OUs for', municipalityCode);
    return cache[cacheKey];
  }
  
  try {
    let url = `${OU_API_BASE}?municipality=${municipalityCode}&per_page=500`;
    const enheter = [];
    console.log('Fetching OUs from:', url);
    
    while (url) {
      const response = await fetch(url, {
        mode: 'cors',
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch OUs: ${response.status}`);
      }
      const data = await response.json();
      const resultat = data.results || data.values || [];
      console.log('Fetched', resultat.length, 'OUs from page');
      enheter.push(...resultat);
      url = data.next_page || data.next || null;
    }
    
    enheter.sort((a, b) => a.title.localeCompare(b.title, 'sv'));
    cache[cacheKey] = enheter;
    console.log('Total OUs fetched and cached:', enheter.length);
    return enheter;
  } catch (error) {
    console.error("Error fetching OUs:", error);
    return [];
  }
}

/**
 * Fetch KPI values for a specific OU and KPI
 * @param {string} ouId - The OU identifier
 * @param {string} kpiId - The KPI identifier
 * @returns {Promise<Array>} Array of value objects with year, value, etc.
 */
export async function fetchKPI(ouId, kpiId) {
  const cacheKey = `${ouId}_${kpiId}`;
  if (cache[cacheKey]) {
    return cache[cacheKey];
  }
  
  try {
    // Use OU-specific endpoint
    const url = `${SKOLENHET_DATA_BASE}/${kpiId}/ou/${ouId}`;
    console.log('Fetching KPI', kpiId, 'for OU', ouId);
    const response = await fetch(url, {
      mode: 'cors',
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) {
      console.warn(`Failed to fetch KPI ${kpiId}: ${response.status}`);
      throw new Error(`Failed to fetch KPI ${kpiId}: ${response.status}`);
    }
    const data = await response.json();
    
    // Extract values array from the nested structure
    const values = data.values && data.values.length > 0 && data.values[0].values 
      ? data.values[0].values 
      : [];
    
    console.log('KPI', kpiId, 'returned', values.length, 'data points');
    cache[cacheKey] = values;
    return values;
  } catch (error) {
    console.error(`Error fetching KPI ${kpiId} for OU ${ouId}:`, error);
    return [];
  }
}

/**
 * Fetch multiple KPIs for a single OU in parallel
 * @param {string} ouId - The OU identifier
 * @param {Array<string>} kpiIds - Array of KPI identifiers
 * @returns {Promise<Array>} Array of value arrays (one per KPI)
 */
export async function fetchKPIs(ouId, kpiIds) {
  return Promise.all(kpiIds.map(kpiId => fetchKPI(ouId, kpiId)));
}

/**
 * Fetch group statistics for comparison (municipality level)
 * This fetches municipality-level KPI data for comparison
 * @param {string} municipalityCode - The municipality code
 * @param {string} kpiId - The KPI identifier
 * @returns {Promise<Array>} Array of value objects
 */
export async function fetchMunicipalityKPI(municipalityCode, kpiId) {
  const cacheKey = `mun_${municipalityCode}_${kpiId}`;
  if (cache[cacheKey]) {
    return cache[cacheKey];
  }
  
  try {
    const url = `${API_BASE}/${kpiId}/municipality/${municipalityCode}`;
    const response = await fetch(url, {
      mode: 'cors',
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch municipality KPI: ${response.status}`);
    }
    const data = await response.json();
    
    const values = data.values && data.values.length > 0 && data.values[0].values 
      ? data.values[0].values 
      : [];
    
    cache[cacheKey] = values;
    return values;
  } catch (error) {
    console.error(`Error fetching municipality KPI ${kpiId}:`, error);
    return [];
  }
}

/**
 * Clear cache (useful for forcing refresh)
 */
export function clearCache() {
  Object.keys(cache).forEach(key => delete cache[key]);
}

/**
 * Get value for a specific year from array of year/value objects
 * @param {Array} values - Array of {year, value} objects
 * @param {number} year - The year to find
 * @returns {number|null} The value or null if not found
 */
export function getValueForYear(values, year) {
  if (!values || !Array.isArray(values)) return null;
  const item = values.find(v => v.period == year);
  return item && item.value !== undefined && item.value !== null ? item.value : null;
}

/**
 * Get trend data (last 3 years)
 * @param {Array} values - Array of {year, value} objects
 * @param {number} currentYear - The current/selected year
 * @returns {Array} Array of up to 3 values (current year and 2 previous)
 */
export function getTrendData(values, currentYear) {
  if (!values || !Array.isArray(values)) return [];
  
  const years = [currentYear, currentYear - 1, currentYear - 2];
  return years.map(year => getValueForYear(values, year)).filter(v => v !== null);
}

/**
 * Calculate trend direction from trend data
 * @param {Array} trendData - Array of values (newest first)
 * @returns {string} 'up', 'down', 'stable', or 'insufficient'
 */
export function getTrendDirection(trendData) {
  if (!trendData || trendData.length < 2) return 'insufficient';
  
  const [current, previous] = trendData;
  const change = current - previous;
  const threshold = Math.abs(current) * 0.05; // 5% threshold
  
  if (Math.abs(change) < threshold) return 'stable';
  return change > 0 ? 'up' : 'down';
}
