export const KPI_GRUNDSKOLA = [
  { id: 'N15508', namn: 'Elever i åk 9 uppnått betygskriterierna i alla ämnen', unit: 'percent' },
  { id: 'U15456', namn: 'Åk 9: alla ämnen godkända (modellberäknat)', unit: 'percent' },
  { id: 'N15419', namn: 'Åk 9: alla ämnen godkända (kommunala skolor)', unit: 'percent' },
  { id: 'N15436', namn: 'Åk 9: behöriga till yrkesprogram (kommunala skolor)', unit: 'percent' },
  { id: 'N15540', namn: 'Åk 6: uppnått kunskapskraven i alla ämnen', unit: 'percent' },
  { id: 'N15543', namn: 'Elever i åk 6 uppnått betygskriterierna i alla ämnen', unit: 'percent' },
  { id: 'N15473', namn: 'Åk 3: klarat alla delar av nationella proven i matematik (hemkommun, %)', unit: 'percent' },
  { id: 'N15472', namn: 'Åk 3: klarat alla delar av nationella proven i svenska/sva (hemkommun, %)', unit: 'percent' },
  { id: 'N15613', namn: 'Trygghet i skolan åk 5', unit: 'percent' },
  { id: 'N15643', namn: 'Trygghet i skolan åk 8', unit: 'percent' },
  { id: 'N15313', namn: 'Pedagogisk personal: studiero på lektioner', unit: 'percent' },
  { id: 'N15331', namn: 'Uppföljning av elevers upplevelse av studiero', unit: 'percent' },
  { id: 'U15401', namn: 'Kvalitetsindex grundskola', unit: 'number' },
  { id: 'U15900', namn: 'Effektivitetsindex kommunal grundskola F-9', unit: 'number' },
  { id: 'U15010', namn: 'Resursindex kommunal grundskola F-9', unit: 'number' },
  { id: 'U15200', namn: 'Medarbetarengagemang grundskola och förskoleklass', unit: 'number' },
  { id: 'U15402', namn: 'Elevenkätsindex åk 8', unit: 'number' },
  { id: 'U15011', namn: 'Nettokostnad per elev grundskolan', unit: 'currency' },
  { id: 'N15006', namn: 'Kostnad grundskola åk 1-9 hemkommun, kr/elev', unit: 'currency' },
  { id: 'N15031', namn: 'Lärare med pedagogisk högskoleexamen', unit: 'percent' },
  { id: 'N15814', namn: 'Andel lärare med lärarlegitimation och behörighet i grundskolan åk 1–9, kommunala skolor', unit: 'percent' },
  { id: 'N15034', namn: 'Elever/lärare grundskola', unit: 'number' },

  // Åk 6 - andel med minst E (per skolenhet, bra tidiga signaler)
  { id: 'N15481', namn: 'Åk 6: lägst betyg E i engelska, fristående grundskola, andel (%)', unit: 'percent' },
  { id: 'N15482', namn: 'Åk 6: lägst betyg E i engelska, kommunala skolor, andel (%)', unit: 'percent' },
  { id: 'N15483', namn: 'Åk 6: lägst betyg E i matematik, lägeskommun, andel (%)', unit: 'percent' },
  { id: 'N15484', namn: 'Åk 6: lägst betyg E i matematik, fristående skolor, andel (%)', unit: 'percent' },
  { id: 'N15485', namn: 'Åk 6: lägst betyg E i matematik, kommunala skolor, andel (%)', unit: 'percent' },

  // Åk 9 - betygspoäng / meritvärde (genomsnitt per skola)
  { id: 'N15503', namn: 'Åk 9: betygspoäng i matematik, genomsnitt', unit: 'number' },
  { id: 'N15504', namn: 'Åk 9: meritvärde lägeskommun, genomsnitt (17 ämnen)', unit: 'number' },
  { id: 'N15505', namn: 'Meritvärde åk 9 (kommunala skolor)', unit: 'number' },
  { id: 'N15506', namn: 'Åk 9: meritvärde fristående skolor i kommunen, genomsnitt (17 ämnen)', unit: 'number' },
  { id: 'N15502', namn: 'Åk 9: lägst betyg E i svenska, kommunala skolor, andel (%)', unit: 'percent' },

  // SALSA-relaterade KPI:er (avvikelse / modellberäknade värden på enhetsnivå)
  { id: 'U15414', namn: 'Åk 9: uppnått betygskriterierna, avvikelse från SALSA (procentenheter)', unit: 'percent' },
  { id: 'U15415', namn: 'Åk 9: meritvärde, modellberäknat genomsnitt (SALSA)', unit: 'number' },
  { id: 'U15416', namn: 'Åk 9: meritvärde, avvikelse från SALSA på enhetsnivå (poäng)', unit: 'number' }
];

export const KPI_FORSKOLA = [
  { id: 'N11032', namn: 'Kostnad per inskrivet barn kommunal förskola', unit: 'currency' }
];

export const FILTER_DATASETS = {
  alla: [0, 1, 2, 3],
  kvinnor: [0],
  man: [1],
  totalt: [2, 3]
};

export const DATASET_CONFIG = [
  { label: 'Kvinnor', color: '#2563eb' },
  { label: 'Män', color: '#1e40af' },
  { label: 'Totalt', color: '#fbbf24' },
  { label: 'Riket', color: '#10b981', dashed: true }
];

// V3‑endpoints fungerar för både kommun‑ och skolenhetsnivå (OU) och ger enhetlig
// datastruktur över alla KPI:er.
// Kommun:   https://api.kolada.se/v3/data/kpi/<kpi>/municipality/<id>
// Skolenhet https://api.kolada.se/v3/oudata/kpi/<kpi>/ou/<id>
export const API_BASE = 'https://api.kolada.se/v3/data/kpi';
export const SKOLENHET_DATA_BASE = 'https://api.kolada.se/v3/oudata/kpi';
export const SKOLENHET_SEARCH_API = 'https://api.kolada.se/v3/ou';
export const DEFAULT_KOMMUN_ID = '0684';
export const RIKET_ID = '0000';
export const DEFAULT_KPI = 'N15508';

export function getKpiList(skoltyp) {
  return skoltyp === 'forskola' ? KPI_FORSKOLA : KPI_GRUNDSKOLA;
}

export function getKpiMetadata(kpiId) {
  return [...KPI_GRUNDSKOLA, ...KPI_FORSKOLA].find(kpi => kpi.id === kpiId);
}
