import { describe, expect, it } from 'vitest';
import { Semaphore } from '../src/core/semaphore';

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

describe('Semaphore', () => {
  it('never runs more than the limit at once and runs everything', async () => {
    const semaphore = new Semaphore(2);
    let running = 0;
    let peak = 0;
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        semaphore.run(async () => {
          running += 1;
          peak = Math.max(peak, running);
          await tick();
          running -= 1;
          return i;
        }),
      ),
    );
    expect(peak).toBe(2);
    expect(results).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('releases the slot when the task throws', async () => {
    const semaphore = new Semaphore(1);
    await expect(semaphore.run(async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(await semaphore.run(async () => 'next')).toBe('next');
  });
});
