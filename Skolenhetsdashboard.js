// Skolenhetsdashboard.js
// Minimal testable dashboard: fetches OUs and shows their names in a list
const MUNICIPALITY_ID = '0684';
const BASE = 'https://api.kolada.se/v3';

async function fetchOUsByMunicipality(municipalityId) {
  const url = `${BASE}/ou?municipality=${municipalityId}&per_page=500`;
  const res = await fetch(url);
  const json = await res.json();
  return json.results || [];
}

function createDashboard() {
  const root = document.createElement('div');
  root.className = 'skolenhetsdashboard';
  root.innerHTML = '<h2>Enheter i Sävsjö kommun</h2><ul id="ouList">Laddar...</ul>';
  document.body.innerHTML = '';
  document.body.appendChild(root);

  fetchOUsByMunicipality(MUNICIPALITY_ID).then(ous => {
    const ul = document.getElementById('ouList');
    ul.innerHTML = ous.map(ou => `<li>${ou.title} (${ou.id})</li>`).join('');
  }).catch(err => {
    document.getElementById('ouList').innerHTML = 'Kunde inte hämta enheter.';
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', createDashboard);
}
