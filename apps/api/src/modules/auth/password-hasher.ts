import { hash, verify } from '@node-rs/argon2';
import { Semaphore } from '../../core/semaphore';

/**
 * Argon2id with OWASP-recommended minimums (19 MiB, t=2, p=1).
 * Every hash allocates 19 MiB outside the JS heap, so concurrent hashes are capped to keep
 * the API inside its 160 MiB container limit; extra logins wait instead of OOM-killing it.
 */
export class PasswordHasher {
  private static readonly OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;
  private readonly slots: Semaphore;
  private dummyHash: Promise<string> | null = null;

  constructor(maxConcurrent = 2) {
    this.slots = new Semaphore(maxConcurrent);
  }

  hash(password: string): Promise<string> {
    return this.slots.run(() => hash(password, PasswordHasher.OPTIONS));
  }

  verify(passwordHash: string, password: string): Promise<boolean> {
    return this.slots.run(() => verify(passwordHash, password));
  }

  /** Burns the same CPU as a real check, so unknown nicknames are not detectable by timing. */
  async verifyAgainstDummy(password: string): Promise<false> {
    this.dummyHash ??= this.hash('libify-timing-equaliser');
    await this.verify(await this.dummyHash, password);
    return false;
  }
}
