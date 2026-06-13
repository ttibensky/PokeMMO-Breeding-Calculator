// Engine public API — foundation modules
export * from './types';
export * from './pyramid';
export * from './validation';
export * from './inheritance';
export * from './cost';

// Planner
export * from './planner';

// Compatible pool
export { getCompatibleSpecies, computeCoverage } from './compatiblePool';
export type { AttributeCoverage } from './compatiblePool';
