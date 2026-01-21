// Simple mutex for preventing concurrent sync operations
class SyncMutex {
    private locked = false;
    private queue: Array<() => void> = [];

    async acquire(): Promise<() => void> {
        return new Promise((resolve) => {
            const tryAcquire = () => {
                if (!this.locked) {
                    this.locked = true;
                    resolve(() => {
                        this.locked = false;
                        const next = this.queue.shift();
                        if (next) next();
                    });
                } else {
                    this.queue.push(tryAcquire);
                }
            };
            tryAcquire();
        });
    }

    isLocked(): boolean {
        return this.locked;
    }
}

export const syncMutex = new SyncMutex();
