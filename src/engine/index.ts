// Engine public API — foundation modules
export * from './types';
export * from './pyramid';
export * from './validation';
export * from './inheritance';
export * from './cost';

// Planner
export * from './planner';

// Full plan builder
export { buildFullPlan } from './fullPlan';

// Optimal plan builder
export { buildOptimalPlan, computePlanCost, OPTIMIZER_NODE_CAP } from './optimalPlan';

// Compatible pool
export { getCompatibleSpecies, computeCoverage } from './compatiblePool';
export type { AttributeCoverage } from './compatiblePool';
