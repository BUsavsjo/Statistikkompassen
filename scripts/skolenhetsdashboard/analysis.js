// Analysis engine for generating automated insights
// Generates 2-4 sentence analysis blocks for different KPI categories

/**
 * Analyze prerequisite KPIs (student count, density, teacher qualifications)
 * @param {Object} data - Current year data: {kpiId: value}
 * @param {Object} groupStats - Comparison data (municipality/group averages)
 * @param {Object} trendData - Historical data for trend analysis
 * @returns {string} Analysis text (2-4 sentences)
 */
export function analyzePrerequisites(data, groupStats, trendData) {
  const sentences = [];
  
  // Student count and density analysis
  const studentCount = data["N15033"];
  const studentsPerTeacher = data["N15438"];
  const prevStudentCount = trendData["N15033"] && trendData["N15033"][1];
  const prevDensity = trendData["N15438"] && trendData["N15438"][1];
  
  if (studentCount !== null && studentsPerTeacher !== null && prevStudentCount !== null && prevDensity !== null) {
    const countChange = studentCount - prevStudentCount;
    const densityChange = studentsPerTeacher - prevDensity;
    
    if (countChange > 5 && densityChange > 0.5) {
      sentences.push("Antalet elever och elevtätheten har ökat, vilket kan innebära större grupper och högre arbetsbelastning för lärarna.");
    } else if (countChange < -5 && densityChange <= 0) {
      sentences.push("Antalet elever har minskat utan att elevtätheten har ökat, vilket kan tyda på omorganisation eller resursjustering.");
    } else if (Math.abs(countChange) > 10) {
      sentences.push(`Antalet elever har ${countChange > 0 ? 'ökat' : 'minskat'} med ${Math.abs(Math.round(countChange))} elever jämfört med föregående år.`);
    } else {
      sentences.push("Elevantalet är relativt stabilt jämfört med föregående år.");
    }
  }
  
  // Teacher qualification analysis
  const qualification = data["N15447"];
  const groupQual = groupStats["N15447"];
  
  if (qualification !== null) {
    if (groupQual !== null && qualification < groupQual - 5) {
      sentences.push(`Andelen lärare med pedagogisk högskoleexamen (${Math.round(qualification)}%) är lägre än kommungenomsnittet (${Math.round(groupQual)}%), vilket bör prioriteras för kompetensförsörjning och kompetensutveckling.`);
    } else if (groupQual !== null && qualification > groupQual + 5) {
      sentences.push(`Andelen lärare med pedagogisk högskoleexamen (${Math.round(qualification)}%) är högre än kommungenomsnittet, vilket är positivt för undervisningskvaliteten.`);
    } else {
      sentences.push("Lärarbehörigheten ligger nära kommungenomsnittet och bedöms som stabil.");
    }
  }
  
  // Resource efficiency observation
  if (studentsPerTeacher !== null && groupStats["N15438"] !== null) {
    const groupDensity = groupStats["N15438"];
    if (studentsPerTeacher > groupDensity + 1) {
      sentences.push("Elevtätheten per lärare är högre än genomsnittet, vilket kan påverka möjligheten till individuell elevstödjande undervisning.");
    }
  }
  
  return sentences.join(" ");
}

/**
 * Analyze F-6 outcome KPIs (grade 6 results)
 * Distinguishes between subject-specific and broad challenges
 * @param {Object} data - Current year data
 * @param {Object} groupStats - Comparison data
 * @returns {string} Analysis text
 */
export function analyzeF6Outcomes(data, groupStats) {
  const sentences = [];
  
  const subjects = [
    { id: "N15561", name: "svenska" },
    { id: "N15559", name: "matematik" },
    { id: "N15560", name: "engelska" }
  ];
  
  const dips = [];
  const strengths = [];
  
  subjects.forEach(subject => {
    const value = data[subject.id];
    const groupValue = groupStats[subject.id];
    
    if (value !== null && groupValue !== null) {
      const diff = value - groupValue;
      if (diff < -5) {
        dips.push({ ...subject, diff });
      } else if (diff > 5) {
        strengths.push({ ...subject, diff });
      }
    }
  });
  
  // Analyze patterns
  if (dips.length === 3) {
    sentences.push("Resultaten i årskurs 6 är lägre än kommungenomsnittet i alla tre kärnämnena (svenska, matematik, engelska), vilket indikerar breda utmaningar som kräver systematiska insatser.");
  } else if (dips.length === 2) {
    const dipNames = dips.map(d => d.name).join(" och ");
    sentences.push(`Resultaten i ${dipNames} ligger under kommungenomsnittet i årskurs 6, vilket tyder på ämnesspecifika utmaningar.`);
  } else if (dips.length === 1) {
    const dipName = dips[0].name;
    sentences.push(`Resultaten i ${dipName} ligger något under kommungenomsnittet i årskurs 6, medan övriga ämnen är mer stabila.`);
  } else {
    sentences.push("Resultaten i årskurs 6 ligger nära eller över kommungenomsnittet i kärnämnena.");
  }
  
  // Highlight strengths if any
  if (strengths.length > 0) {
    const strengthNames = strengths.map(s => s.name).join(", ");
    sentences.push(`Skolan visar särskilt goda resultat i ${strengthNames}.`);
  }
  
  // Check for cohort size warnings
  const swedishValue = data["N15561"];
  if (swedishValue !== null && swedishValue < 15) {
    sentences.push("Observera att elevgruppen är liten, vilket innebär att resultaten kan variera kraftigt mellan år.");
  }
  
  return sentences.join(" ");
}

/**
 * Analyze 7-9 outcome KPIs (grade 9 results and SALSA)
 * Interprets gap between merit value and approval rate
 * @param {Object} data - Current year data
 * @param {Object} groupStats - Comparison data
 * @returns {string} Analysis text
 */
export function analyze79Outcomes(data, groupStats) {
  const sentences = [];
  
  const eligibility = data["N15419"]; // Behöriga till yrkesprogram
  const merit = data["N15421"]; // Meritvärde
  const mathPoints = data["N15414"]; // Matematik betygspoäng
  
  const groupEligibility = groupStats["N15419"];
  const groupMerit = groupStats["N15421"];
  
  // Analyze eligibility and merit gap
  if (eligibility !== null && merit !== null) {
    // Merit value typically ranges 0-320, eligibility is percentage
    // High merit but lower eligibility suggests a narrow at-risk group
    // Low merit and low eligibility suggests broader challenges
    
    if (groupEligibility !== null && eligibility < groupEligibility - 5) {
      if (groupMerit !== null && merit >= groupMerit - 10) {
        sentences.push("Andelen behöriga till yrkesprogram är lägre än genomsnittet trots att meritvärdet är relativt stabilt, vilket tyder på att en avgränsad elevgrupp saknar godkänt i ett eller flera ämnen.");
      } else {
        sentences.push("Både behörighet till yrkesprogram och meritvärde ligger under genomsnittet, vilket indikerar bredare utmaningar med resultatnivån som kräver systematiska åtgärder.");
      }
    } else if (groupEligibility !== null && eligibility >= groupEligibility - 2) {
      sentences.push("Andelen behöriga till yrkesprogram ligger nära eller över kommungenomsnittet, vilket visar att huvuddelen av eleverna når godkända resultat.");
    }
  }
  
  // Math-specific analysis
  if (mathPoints !== null && groupStats["N15414"] !== null) {
    const groupMath = groupStats["N15414"];
    if (mathPoints < groupMath - 1.0) {
      sentences.push("Betygspoängen i matematik ligger under kommungenomsnittet, vilket kan motivera extra stödinsatser i ämnet.");
    } else if (mathPoints > groupMath + 1.0) {
      sentences.push("Resultaten i matematik är starkare än kommungenomsnittet.");
    }
  }
  
  return sentences.join(" ");
}

/**
 * Analyze SALSA deviation measures
 * Positive = school lifts students above expected, Negative = process/support issues
 * @param {Object} data - Current year data
 * @returns {string} Analysis text
 */
export function analyzeSALSA(data) {
  const sentences = [];
  
  const salsaEligibility = data["U15423"]; // Avvikelse behörighet
  const salsaMerit = data["U15424"]; // Avvikelse meritvärde
  
  if (salsaEligibility !== null || salsaMerit !== null) {
    // SALSA measures deviation from expected results based on student background
    // Positive values = better than expected, negative = worse than expected
    
    const eligPos = salsaEligibility !== null && salsaEligibility > 2;
    const eligNeg = salsaEligibility !== null && salsaEligibility < -2;
    const meritPos = salsaMerit !== null && salsaMerit > 5;
    const meritNeg = salsaMerit !== null && salsaMerit < -5;
    
    if (eligPos || meritPos) {
      sentences.push("SALSA-analysen visar positiv avvikelse, vilket innebär att skolan lyfter eleverna över förväntat resultat baserat på elevernas bakgrund. Detta tyder på god pedagogisk kvalitet och effektiva stödstrukturer.");
    } else if (eligNeg || meritNeg) {
      sentences.push("SALSA-analysen visar negativ avvikelse, vilket innebär att resultaten ligger under vad som kan förväntas baserat på elevernas bakgrund. Detta indikerar behov av att stärka undervisningsprocesser, lärmiljö eller stödstrukturer snarare än att förklara resultaten enbart med elevsammansättning.");
    } else {
      sentences.push("SALSA-analysen visar neutral avvikelse, vilket innebär att resultaten ligger i linje med förväntningar baserat på elevernas bakgrund.");
    }
  }
  
  return sentences.join(" ");
}

/**
 * Generate complete analysis for a school unit
 * Combines all analysis components based on stage
 * @param {Object} data - All KPI data for current year
 * @param {Object} groupStats - Comparison data
 * @param {Object} trendData - Historical data
 * @param {string} stage - School stage (F-6, 7-9, F-9)
 * @returns {Object} Analysis object with sections
 */
export function generateFullAnalysis(data, groupStats, trendData, stage) {
  const analysis = {
    prerequisites: analyzePrerequisites(data, groupStats, trendData),
    outcomes: "",
    salsa: ""
  };
  
  // Add stage-specific outcome analysis
  if (stage === "F-6") {
    analysis.outcomes = analyzeF6Outcomes(data, groupStats);
  } else if (stage === "7-9") {
    analysis.outcomes = analyze79Outcomes(data, groupStats);
    analysis.salsa = analyzeSALSA(data);
  } else if (stage === "F-9") {
    // F-9 gets both F-6 and 7-9 analysis
    const f6Analysis = analyzeF6Outcomes(data, groupStats);
    const f9Analysis = analyze79Outcomes(data, groupStats);
    analysis.outcomes = f6Analysis + " " + f9Analysis;
    analysis.salsa = analyzeSALSA(data);
  }
  
  return analysis;
}
