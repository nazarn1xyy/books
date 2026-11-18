/** Caps how many async tasks run at once; the rest wait in FIFO order. */
export class Semaphore {
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) await new Promise<void>((resolve) => this.waiting.push(resolve));
    else this.active += 1;
    try {
      return await task();
    } finally {
      const next = this.waiting.shift();
      // Hand the slot straight to the next waiter, so `active` never drops below the queue's needs.
      if (next) next();
      else this.active -= 1;
    }
  }
}
