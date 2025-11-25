// KPI packs and stage mapping
// This module defines all KPI IDs organized by prerequisite/outcome and stage

// Default municipality code for Sävsjö
export const DEFAULT_MUNICIPALITY_CODE = "0684";

// Common municipalities in the region
export const MUNICIPALITIES = [
  { code: "0680", name: "Jönköping" },
  { code: "0682", name: "Nässjö" },
  { code: "0683", name: "Värnamo" },
  { code: "0684", name: "Sävsjö" },
  { code: "0685", name: "Vetlanda" },
  { code: "0686", name: "Eksjö" },
  { code: "0687", name: "Tranås" },
  { code: "0760", name: "Uppvidinge" },
  { code: "0761", name: "Lessebo" },
  { code: "0763", name: "Tingsryd" },
  { code: "0764", name: "Alvesta" },
  { code: "0765", name: "Älmhult" },
  { code: "0767", name: "Markaryd" },
  { code: "0780", name: "Växjö" },
  { code: "0781", name: "Ljungby" }
];

// Stage definitions
export const STAGES = [
  { id: "F-6", name: "F-6" },
  { id: "7-9", name: "7-9" },
  { id: "F-9", name: "F-9" }
];

// ===== PREREQUISITE KPIs (always shown for all school stages) =====
// These provide context about resources and teacher qualifications
export const PREREQ_KPIS = [
  { 
    id: "N15033", 
    name: "Antal elever i grundskolan (åk 1-9)",
    description: "Totalt antal elever i årskurs 1-9",
    unit: "antal"
  },
  { 
    id: "N15438", 
    name: "Elever per lärare i grundskolan",
    description: "Genomsnittligt antal elever per heltidstjänst lärare",
    unit: "antal"
  },
  { 
    id: "N15447", 
    name: "Andel lärare med pedagogisk högskoleexamen",
    description: "Andel lärare med pedagogisk högskoleutbildning",
    unit: "procent"
  }
];

// ===== F-6 OUTCOME KPIs =====
// Grade 6 measures - NO grade 9 measures should be included here
// ⚠️ TO ADD MORE F-6 KPIs: Simply add new objects to this array below ⚠️
export const OUTCOME_F6_KPIS = [
  { 
    id: "N15561", 
    name: "Andel elever åk 6 med lägst betyget E i svenska",
    description: "Elever som uppnått kunskapskraven (minst E) i svenska, årskurs 6",
    unit: "procent"
  },
  { 
    id: "N15559", 
    name: "Andel elever åk 6 med lägst betyget E i matematik",
    description: "Elever som uppnått kunskapskraven (minst E) i matematik, årskurs 6",
    unit: "procent"
  },
  { 
    id: "N15560", 
    name: "Andel elever åk 6 med lägst betyget E i engelska",
    description: "Elever som uppnått kunskapskraven (minst E) i engelska, årskurs 6",
    unit: "procent"
  }
  // ⬇️ ADD MORE F-6 KPI IDs HERE ⬇️
  // Example:
  // { 
  //   id: "N15562", 
  //   name: "Andel elever åk 6 med lägst betyget E i SO",
  //   description: "Elever som uppnått kunskapskraven i SO, årskurs 6",
  //   unit: "procent"
  // }
];

// ===== 7-9 OUTCOME KPIs =====
// Grade 9 measures and SALSA deviation measures
export const OUTCOME_79_KPIS = [
  { 
    id: "N15419", 
    name: "Andel elever åk 9 behöriga till yrkesprogram",
    description: "Elever som är behöriga till yrkesprogram på gymnasiet",
    unit: "procent"
  },
  { 
    id: "N15421", 
    name: "Genomsnittligt meritvärde åk 9",
    description: "Genomsnittligt meritvärde för elever i årskurs 9",
    unit: "poäng"
  },
  { 
    id: "N15414", 
    name: "Genomsnittlig betygspoäng i matematik åk 9",
    description: "Genomsnittlig betygspoäng i matematik för elever i årskurs 9",
    unit: "poäng"
  },
  { 
    id: "U15423", 
    name: "SALSA: Avvikelse behörighet yrkesprogram",
    description: "SALSA-värde: Skolans resultat jämfört med förväntat värde baserat på elevsammansättning",
    unit: "procentenheter"
  },
  { 
    id: "U15424", 
    name: "SALSA: Avvikelse genomsnittligt meritvärde",
    description: "SALSA-värde: Skolans resultat jämfört med förväntat värde baserat på elevsammansättning",
    unit: "poäng"
  }
];

// ===== F-9 OUTCOME KPIs =====
// Union of F-6 and 7-9 outcomes (schools with both stages)
export const OUTCOME_F9_KPIS = [...OUTCOME_F6_KPIS, ...OUTCOME_79_KPIS];

/**
 * Detect stage automatically from OU name
 * Looks for common patterns in school names
 * @param {Object} ou - The OU object with name property
 * @returns {string|null} Stage ID or null if cannot be detected
 */
export function detectStage(ou) {
  if (!ou || !ou.title) return null;
  
  const name = ou.title.toLowerCase();
  
  // Check for explicit stage markers in name
  if (name.includes("f-6") || name.includes("f - 6") || name.includes("förskoleklass-6")) {
    return "F-6";
  }
  if (name.includes("7-9") || name.includes("7 - 9")) {
    return "7-9";
  }
  if (name.includes("f-9") || name.includes("f - 9") || name.includes("förskoleklass-9")) {
    return "F-9";
  }
  
  // Check for school type keywords
  if (name.includes("lågstadie") || name.includes("mellanstadie")) {
    return "F-6";
  }
  if (name.includes("högstadie")) {
    return "7-9";
  }
  
  // Default: cannot auto-detect
  return null;
}

/**
 * Get outcome KPIs for a specific stage
 * @param {string} stage - Stage ID ("F-6", "7-9", or "F-9")
 * @returns {Array} Array of KPI definitions
 */
export function getOutcomeKPIs(stage) {
  switch (stage) {
    case "F-6":
      return OUTCOME_F6_KPIS;
    case "7-9":
      return OUTCOME_79_KPIS;
    case "F-9":
      return OUTCOME_F9_KPIS;
    default:
      return [];
  }
}

/**
 * Get all KPI IDs for a stage (prerequisites + outcomes)
 * @param {string} stage - Stage ID
 * @returns {Array<string>} Array of KPI IDs
 */
export function getAllKPIIds(stage) {
  const prereqIds = PREREQ_KPIS.map(k => k.id);
  const outcomeIds = getOutcomeKPIs(stage).map(k => k.id);
  return [...prereqIds, ...outcomeIds];
}
