import { systemClock, type Clock } from './clock';

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
}

/** In-memory fixed-window limiter. Single API instance, so memory is enough. */
export class FixedWindowRateLimiter {
  private static readonly SWEEP_THRESHOLD = 10_000;
  private readonly windows = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly clock: Clock = systemClock,
  ) {}

  consume(key: string): RateLimitResult {
    const now = this.clock.now().getTime();
    const current = this.windows.get(key);
    if (!current || current.resetAt <= now) {
      this.sweep(now);
      this.windows.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, retryAfterSec: 0 };
    }
    current.count += 1;
    if (current.count > this.limit) {
      return { allowed: false, retryAfterSec: Math.ceil((current.resetAt - now) / 1000) };
    }
    return { allowed: true, retryAfterSec: 0 };
  }

  /** Reports whether the key is currently blocked, without counting an attempt. */
  peek(key: string): RateLimitResult {
    const now = this.clock.now().getTime();
    const current = this.windows.get(key);
    if (!current || current.resetAt <= now || current.count < this.limit) return { allowed: true, retryAfterSec: 0 };
    return { allowed: false, retryAfterSec: Math.ceil((current.resetAt - now) / 1000) };
  }

  reset(key: string): void {
    this.windows.delete(key);
  }

  private sweep(now: number): void {
    if (this.windows.size < FixedWindowRateLimiter.SWEEP_THRESHOLD) return;
    for (const [key, w] of this.windows) if (w.resetAt <= now) this.windows.delete(key);
  }
}
