/**

 * Phase 2 — Cold-start analysis backed by unified complexity scoring.

 */



import type { DifficultyLevel } from "@/lib/adaptive-study-time";

import {

  analyzeTopicComplexity,

  type ComplexityAnalysis,

} from "@/lib/topic-complexity";



export interface ColdStartInput {

  title: string;

  subtopics?: string[];

  unitTitle?: string;

  unitTopicCount?: number;

  hierarchyDepth?: number;

}



export interface ColdStartResult {

  difficultyLevel: DifficultyLevel;

  difficultyScore: number;

  complexityScore: number;

  baselineEstimatedMinutes: number;

  subtopicCount: number;

  hierarchyDepth: number;

  technicalTermDensity: number;

  algorithmCount: number;

  formulaCount: number;

  programmingConceptCount: number;

}



export function analyzeColdStartDifficulty(

  input: ColdStartInput

): ColdStartResult {

  const analysis: ComplexityAnalysis = analyzeTopicComplexity({

    title: input.title,

    subtopics: input.subtopics,

    hierarchyDepth: input.hierarchyDepth,

  });



  const { features, complexityScore, difficultyLevel, baselineEstimatedMinutes } =

    analysis;



  let adjustedBaseline = baselineEstimatedMinutes;

  const unitTopicCount = input.unitTopicCount ?? 1;

  if (unitTopicCount > 12) {

    adjustedBaseline = Math.min(120, adjustedBaseline + 5);

  }



  const technicalTermDensity = Math.min(

    1,

    features.technicalTermCount / Math.max(features.topicLength, 1)

  );



  return {

    difficultyLevel,

    difficultyScore: complexityScore,

    complexityScore,

    baselineEstimatedMinutes: adjustedBaseline,

    subtopicCount: features.subtopicCount,

    hierarchyDepth: analysis.hierarchyDepth,

    technicalTermDensity,

    algorithmCount: features.algorithmCount,

    formulaCount: features.formulaCount,

    programmingConceptCount: features.programmingConceptCount,

  };

}



export function getBaselineRange(difficulty: DifficultyLevel): {

  min: number;

  max: number;

} {

  const ranges: Record<DifficultyLevel, { min: number; max: number }> = {

    easy: { min: 15, max: 35 },

    medium: { min: 30, max: 60 },

    hard: { min: 45, max: 90 },

    very_hard: { min: 60, max: 120 },

  };

  return ranges[difficulty];

}

