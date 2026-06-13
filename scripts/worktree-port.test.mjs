import { describe, it, expect } from 'vitest';
import { portsForWorktree } from './worktree-port.mjs';

describe('portsForWorktree', () => {
  it('is deterministic for the same name', () => {
    expect(portsForWorktree('feature-x')).toEqual(portsForWorktree('feature-x'));
  });

  it('returns an even dev port and the next odd preview port', () => {
    const { devPort, previewPort } = portsForWorktree('feature-x');
    expect(devPort % 2).toBe(0);
    expect(previewPort).toBe(devPort + 1);
  });

  it('keeps ports inside the reserved worktree range', () => {
    for (const name of ['a', 'feature-x', 'worktree-port-isolation', 'zzz-very-long-name']) {
      const { devPort, previewPort } = portsForWorktree(name);
      expect(devPort).toBeGreaterThanOrEqual(3002);
      expect(devPort).toBeLessThanOrEqual(3180);
      expect(previewPort).toBeGreaterThanOrEqual(3003);
      expect(previewPort).toBeLessThanOrEqual(3181);
    }
  });

  it('never collides with the main checkout ports (3000/3001)', () => {
    const { devPort, previewPort } = portsForWorktree('any-name');
    expect(devPort).not.toBe(3000);
    expect(previewPort).not.toBe(3001);
  });
});
