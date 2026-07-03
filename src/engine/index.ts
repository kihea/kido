// Engine public surface. UI and app glue import from here; the engine itself
// imports only from core (docs/ARCHITECTURE.md dependency rule).

export { analyzeCorpus, resolveTopicConcept } from './corpus';
export { annotatePassages, annotationCoverage, dominantLayer, heuristicTags } from './annotate';
export { buildProfile, mergeStructuredRelations } from './profile';
export {
  LAYER_INFO,
  MIRROR_PAIRS,
  MIRROR_STACK,
  TEACHABLE_LAYERS,
  WORKING_STACK,
  layerName,
  mirrorLayer,
  mirrorPairOf,
} from './layers';
export {
  KIND_DIRECTION,
  applyDirectionalEvidence,
  applyEvidence,
  detectCollapse,
  effectiveMastery,
  initDirection,
  initMastery,
  masteryConfidence,
  weakestLayers,
} from './mastery';
export {
  DIRECTION_GAP,
  DIRECTION_MIN_EVIDENCE,
  DIRECTION_STRONG_DAMP,
  DIRECTION_WEAK_BOOST,
  DOMAIN_WEIGHTS,
  ENTRY_SEQUENCE,
  LAYER_DIRECTION,
  buildDiagnostic,
  buildGauge,
  chooseTargetLayer,
  describeImbalance,
  detectImbalance,
  inferDomainFamily,
  moveForLayer,
} from './diagnose';
export { buildPracticePool, itemsForLayer } from './exertion';
export { dueItems, newReviewItem, reviewDebt, schedule } from './review';
export { applyResponse, gradeResponse, next, reviewSeeds, startSession } from './tutor';
export { l0Unlocked, nextSocraticTurn, nineQuestionSurvey } from './socratic';
export type { SocraticTurn } from './socratic';
export type { Feedback, PracticeResponse, TutorOptions, TutorState } from './tutor';
