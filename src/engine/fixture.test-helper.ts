// Shared test fixture: a small synthetic corpus about gradient descent whose
// passages deliberately carry cues for every layer. Used by engine tests only.

import type { Corpus, Passage, SourceDoc } from '../core/types';
import { analyzeCorpus } from './corpus';
import { annotatePassages } from './annotate';

const docs: SourceDoc[] = [
  {
    id: 'doc_wiki',
    provider: 'Wikipedia',
    sourceType: 'encyclopedia',
    title: 'Gradient descent',
    url: 'https://en.wikipedia.org/wiki/Gradient_descent',
    license: 'CC BY-SA',
  },
  {
    id: 'doc_book',
    provider: 'Wikibooks',
    sourceType: 'textbook',
    title: 'Machine Learning Foundations',
    url: 'https://en.wikibooks.org/wiki/ML',
  },
  {
    id: 'doc_paper',
    provider: 'Crossref',
    sourceType: 'paper',
    title: 'On convergence of first-order methods',
    url: 'https://doi.org/10.0000/example',
  },
];

const texts: [string, string][] = [
  [
    'doc_wiki',
    'Gradient descent is an optimization algorithm for finding a local minimum of a differentiable function. The loss function measures how wrong the model currently is.',
  ],
  [
    'doc_wiki',
    'The learning rate controls the step size of each update. A learning rate that is higher than the stable range causes the loss to diverge, while a very low learning rate makes progress slower than necessary.',
  ],
  [
    'doc_wiki',
    'Unlike random search, gradient descent uses local slope information to choose its direction. It differs from Newton’s method, which also uses curvature.',
  ],
  [
    'doc_wiki',
    'For example, consider fitting a straight line to a set of data points. In this case the loss function is the squared error, and gradient descent adjusts the slope and intercept.',
  ],
  [
    'doc_wiki',
    'First the gradient of the loss function is computed. Then the parameters are updated in the negative gradient direction. After each update the loss is recalculated. Eventually the process converges toward a minimum.',
  ],
  [
    'doc_book',
    'In general, gradient descent is a form of local optimization. The idea of following the slope downhill averages over many concrete update rules.',
  ],
  [
    'doc_book',
    'A training system consists of a loss function, an optimizer, and a dataset. Gradient descent is part of the larger machine learning training pipeline.',
  ],
  [
    'doc_book',
    'The principle of local improvement governs the method: every step must decrease the loss function, and the learning rate constrains how far each step may go.',
  ],
  [
    'doc_paper',
    'We study gradient descent and prove that with a suitable learning rate the loss function decreases at every iteration. The step size depends on the curvature of the objective.',
  ],
  [
    'doc_paper',
    'Convergence emerged as the central question during the 1950s and remained debated until the 1980s, when analyses of the step size settled the basic cases.',
  ],
];

export function fixturePassages(): Passage[] {
  return texts.map(([docId, text], i) => ({
    id: `p_${i}`,
    docId,
    text,
    index: i,
  }));
}

export function fixtureCorpus(): Corpus {
  const passages = annotatePassages(fixturePassages());
  return analyzeCorpus('gradient descent', docs, passages);
}

export const fixtureDocs = docs;
