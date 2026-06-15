import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS } from './defaults';

describe('DEFAULT_SETTINGS', () => {
  it('includes baseCarrier price defaulting to 10000', () => {
    expect(DEFAULT_SETTINGS.prices.baseCarrier).toBe(10000);
  });

  it('includes costOptimizer feature toggle defaulting to false', () => {
    expect(DEFAULT_SETTINGS.features.costOptimizer).toBe(false);
  });
});
