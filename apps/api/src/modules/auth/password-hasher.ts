import { hash, verify } from '@node-rs/argon2';

/** Argon2id with OWASP-recommended minimums (19 MiB, t=2, p=1). */
export class PasswordHasher {
  private static readonly OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;
  private dummyHash: Promise<string> | null = null;

  hash(password: string): Promise<string> {
    return hash(password, PasswordHasher.OPTIONS);
  }

  verify(passwordHash: string, password: string): Promise<boolean> {
    return verify(passwordHash, password);
  }

  /** Burns the same CPU as a real check, so unknown nicknames are not detectable by timing. */
  async verifyAgainstDummy(password: string): Promise<false> {
    this.dummyHash ??= this.hash('libify-timing-equaliser');
    await verify(await this.dummyHash, password);
    return false;
  }
}
