// api/koladaApi.js
const BASE = 'https://api.kolada.se/v3';
const cache = {};

export async function fetchKpiMetadata() {
  const url = `${BASE}/kpi?is_available_for_ou=true&per_page=500`;
  if (cache[url]) return cache[url];
  const res = await fetch(url);
  const json = await res.json();
  cache[url] = json.results || [];
  return cache[url];
}

export async function fetchOUsByMunicipality(municipalityId) {
  const url = `${BASE}/ou?municipality=${municipalityId}&per_page=500`;
  if (cache[url]) return cache[url];
  const res = await fetch(url);
  const json = await res.json();
  cache[url] = json.results || [];
  return cache[url];
}

export async function fetchKpiValuesForOUs(kpiId, ouIds, year) {
  // Fetch all OUs for a KPI, filter by year and OU
  const url = `${BASE}/kpi/${kpiId}/ou?year=${year}&per_page=500`;
  if (cache[url]) return cache[url];
  const res = await fetch(url);
  const json = await res.json();
  cache[url] = json.values || [];
  // Filter for requested OUs
  return cache[url].filter(v => ouIds.includes(v.ou));
}
