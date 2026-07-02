// Engine public surface. UI and app glue import from here; the engine itself
// imports only from core (docs/ARCHITECTURE.md dependency rule).

export { analyzeCorpus, resolveTopicConcept } from './corpus';
export { annotatePassages, annotationCoverage, dominantLayer, heuristicTags } from './annotate';
export { buildProfile } from './profile';
export { LAYER_INFO, TEACHABLE_LAYERS, WORKING_STACK, layerName } from './layers';
export { applyEvidence, effectiveMastery, initMastery, masteryConfidence, weakestLayers } from './mastery';
export {
  DOMAIN_WEIGHTS,
  ENTRY_SEQUENCE,
  buildDiagnostic,
  chooseTargetLayer,
  inferDomainFamily,
  moveForLayer,
} from './diagnose';
export { buildPracticePool, itemsForLayer } from './exertion';
export { dueItems, newReviewItem, reviewDebt, schedule } from './review';
export {
  answerDiagnostic,
  applyResponse,
  gradeResponse,
  next,
  reviewSeeds,
  startSession,
} from './tutor';
export type { Feedback, PracticeResponse, TutorOptions, TutorState } from './tutor';
