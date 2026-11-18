import { describe, expect, it } from 'vitest';
import { FixedWindowRateLimiter } from '../src/core/rate-limiter';
import { FakeClock } from './helpers';

describe('FixedWindowRateLimiter', () => {
  it('allows up to the limit, then blocks with retry-after', () => {
    const clock = new FakeClock();
    const limiter = new FixedWindowRateLimiter(2, 60_000, clock);
    expect(limiter.consume('k').allowed).toBe(true);
    expect(limiter.consume('k').allowed).toBe(true);
    const third = limiter.consume('k');
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSec).toBe(60);
  });
  it('resets after the window', () => {
    const clock = new FakeClock();
    const limiter = new FixedWindowRateLimiter(1, 1_000, clock);
    limiter.consume('k');
    expect(limiter.consume('k').allowed).toBe(false);
    clock.advance(1_000);
    expect(limiter.consume('k').allowed).toBe(true);
  });
  it('tracks keys independently', () => {
    const limiter = new FixedWindowRateLimiter(1, 60_000, new FakeClock());
    limiter.consume('a');
    expect(limiter.consume('b').allowed).toBe(true);
  });
  it('peek reports a block without counting, reset clears the key', () => {
    const limiter = new FixedWindowRateLimiter(2, 60_000, new FakeClock());
    expect(limiter.peek('k').allowed).toBe(true);
    limiter.consume('k');
    limiter.consume('k');
    expect(limiter.peek('k')).toEqual({ allowed: false, retryAfterSec: 60 });
    expect(limiter.peek('k').allowed).toBe(false);
    limiter.reset('k');
    expect(limiter.peek('k').allowed).toBe(true);
  });
});
