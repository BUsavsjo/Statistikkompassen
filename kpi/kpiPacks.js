// kpi/kpiPacks.js
export const PREREQUISITE_KPIS = [
  { id: 'N15807', label: 'Antal elever åk 1–9' },
  { id: 'N15034', label: 'Elever per lärare' },
  { id: 'N15813', label: 'Andel behöriga lärare' }
];

export const OUTCOME_KPIS = {
  'F-6': [
    { id: 'N15543', label: 'Andel elever åk 6 godkända i alla ämnen' },
    { id: 'N15544', label: 'Andel elever åk 6 godkända i svenska/matte/engelska' }
    // Lägg till fler F-6 KPI:er här
  ],
  '7-9': [
    { id: 'N15418', label: 'Andel elever åk 9 godkända i alla ämnen' },
    { id: 'N15504', label: 'Meritvärde åk 9' },
    { id: 'N15503', label: 'Mattebetyg åk 9' },
    { id: 'U15414', label: 'SALSA: meritvärde' },
    { id: 'U15416', label: 'SALSA: andel godkända' }
  ],
  'F-9': [] // Union av F-6 och 7-9
};

OUTCOME_KPIS['F-9'] = [...OUTCOME_KPIS['F-6'], ...OUTCOME_KPIS['7-9']];
