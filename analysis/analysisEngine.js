// analysis/analysisEngine.js
export function analyzePrerequisites(data, groupStats) {
  const { N15807, N15034, N15813 } = data;
  const sentences = [];
  if (N15807 && N15034 && N15807.trend === 'up' && N15034.trend === 'up') {
    sentences.push('Elevantal och elever per lärare ökar – risk för större grupper och högre arbetsbelastning.');
  }
  if (N15807 && N15034 && N15807.trend === 'down' && N15034.trend !== 'down') {
    sentences.push('Elevantalet minskar men gruppstorleken är oförändrad – möjlig omorganisation eller resursjustering.');
  }
  if (N15813 && N15813.value < groupStats.N15813.mean * 0.95) {
    sentences.push('Andel behöriga lärare är klart under snittet – kompetensförsörjning bör prioriteras.');
  } else if (N15813) {
    sentences.push('Lärarbehörigheten är stabil.');
  }
  return sentences;
}

export function analyzeOutcomes(stage, data, groupStats) {
  const sentences = [];
  if (stage === 'F-6') {
    if (data.N15544 && data.N15544.value < groupStats.N15544.mean * 0.95) {
      sentences.push('Resultaten i svenska/matte/engelska är under snittet – risk för breda kunskapsluckor.');
    }
    if (data.N15543 && data.N15543.value < groupStats.N15543.mean * 0.95) {
      sentences.push('Andel godkända i alla ämnen är låg – bred utmaning.');
    }
  } else if (stage === '7-9') {
    if (data.N15418 && data.N15504) {
      const gap = data.N15504.value - data.N15418.value;
      if (gap > 10) {
        sentences.push('Meritvärdet är högt men få godkända i alla ämnen – smalt riskområde, några elever missar många ämnen.');
      } else {
        sentences.push('Meritvärde och godkända i alla ämnen följs åt – bred utmaning.');
      }
    }
    if (data.U15414 && data.U15414.value > groupStats.U15414.mean) {
      sentences.push('SALSA: Skolan lyfter elever över förväntan.');
    } else if (data.U15414 && data.U15414.value < groupStats.U15414.mean) {
      sentences.push('SALSA: Resultaten under förväntan – troligen process/stödproblem.');
    }
  }
  return sentences;
}
