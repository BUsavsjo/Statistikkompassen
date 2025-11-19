export const KPI_GRUNDSKOLA = [
  {
    id: 'N15508',
    namn: 'Elever i åk 9 uppnått betygskriterierna i alla ämnen',
    unit: 'percent'
  },
  {
    id: 'N15543',
    namn: 'Elever i åk 6 uppnått betygskriterierna i alla ämnen',
    unit: 'percent'
  },
  {
    id: 'N15814',
    namn: 'Andel lärare med lärarlegitimation och behörighet i grundskolan åk 1–9, kommunala skolor',
    unit: 'percent'
  }
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

export const API_BASE = 'https://api.kolada.se/v3/data/municipality';
export const SKOLENHET_DATA_BASE = 'https://api.kolada.se/v3/data/ou';
export const SKOLENHET_SEARCH_API = 'https://api.kolada.se/v2/ou';
export const DEFAULT_KOMMUN_ID = '0684';
export const RIKET_ID = '0000';
export const DEFAULT_KPI = 'N15508';

export function getKpiList(skoltyp) {
  return skoltyp === 'forskola' ? KPI_FORSKOLA : KPI_GRUNDSKOLA;
}

export function getKpiMetadata(kpiId) {
  return [...KPI_GRUNDSKOLA, ...KPI_FORSKOLA].find(kpi => kpi.id === kpiId);
}
