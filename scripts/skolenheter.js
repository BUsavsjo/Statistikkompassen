export const PREDEFINED_SKOLENHETER = [
  // Sävsjö kommun (0684) – grundskolor från Koladas OU‑register
  { id: 'V15E068400107', municipality: '0684', title: 'Hägneskolan', type: 'grundskola' },
  { id: 'V15E068400501', municipality: '0684', title: 'Rörviks skola', type: 'grundskola' },
  { id: 'V15E068400701', municipality: '0684', title: 'Vallsjöskolan', type: 'grundskola' },
  { id: 'V15E068401101', municipality: '0684', title: 'Vrigstad skola', type: 'grundskola' },
  { id: 'V15E068401401', municipality: '0684', title: 'Sävsjö kristna skola', type: 'grundskola' },
  { id: 'V15E068401501', municipality: '0684', title: 'Hofgårdsskolan', type: 'grundskola' },
  { id: 'V15E068401601', municipality: '0684', title: 'Stockaryds skola', type: 'grundskola' }
];

export function getPredefinedSkolenheter(kommunId) {
  return PREDEFINED_SKOLENHETER.filter(enhet => enhet.municipality === kommunId);
}
