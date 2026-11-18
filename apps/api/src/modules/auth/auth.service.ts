import { createHash, randomBytes } from 'node:crypto';
import type { Credentials, LoginInput, PublicUser } from '@libify/shared';
import type { Clock } from '../../core/clock';
import { InvalidCredentialsError } from '../../core/errors';
import type { SessionUser } from '../../core/http';
import type { PasswordHasher } from './password-hasher';
import type { SessionRepository } from './session.repository';
import { toPublicUser, type UserRepository, type UserRow } from './user.repository';

export interface IssuedSession {
  user: PublicUser;
  token: string;
  expiresAt: Date;
}

export interface AuthenticatedSession {
  user: SessionUser;
  /** Set when the session was extended and the cookie must be re-issued. */
  renewedUntil: Date | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export class AuthService {
  static readonly SESSION_TTL_MS = 30 * DAY_MS;
  private static readonly RENEW_WHEN_REMAINING_MS = 15 * DAY_MS;
  private static readonly LAST_SEEN_GRANULARITY_MS = 5 * 60 * 1000;

  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly hasher: PasswordHasher,
    private readonly clock: Clock,
  ) {}

  async register(input: Credentials, userAgent: string | null): Promise<IssuedSession> {
    const passwordHash = await this.hasher.hash(input.password);
    const user = await this.users.create(input.nickname, passwordHash);
    return this.issueSession(user, userAgent);
  }

  async login(input: LoginInput, userAgent: string | null): Promise<IssuedSession> {
    const user = await this.users.findByNickname(input.nickname);
    const valid = user
      ? await this.hasher.verify(user.passwordHash, input.password)
      : await this.hasher.verifyAgainstDummy(input.password);
    if (!user || !valid) throw new InvalidCredentialsError();
    return this.issueSession(user, userAgent);
  }

  async logout(token: string): Promise<void> {
    await this.sessions.delete(AuthService.hashToken(token));
  }

  async authenticate(token: string): Promise<AuthenticatedSession | null> {
    const id = AuthService.hashToken(token);
    const session = await this.sessions.findWithUser(id);
    if (!session) return null;

    const now = this.clock.now();
    if (session.expiresAt <= now) {
      await this.sessions.delete(id);
      return null;
    }

    let renewedUntil: Date | null = null;
    if (session.expiresAt.getTime() - now.getTime() < AuthService.RENEW_WHEN_REMAINING_MS) {
      renewedUntil = new Date(now.getTime() + AuthService.SESSION_TTL_MS);
      await this.sessions.extend(id, renewedUntil);
    }
    if (now.getTime() - session.user.lastSeenAt.getTime() > AuthService.LAST_SEEN_GRANULARITY_MS) {
      await this.users.touchLastSeen(session.user.id, now);
    }

    return { user: { ...toPublicUser(session.user), sessionId: id }, renewedUntil };
  }

  purgeExpiredSessions(): Promise<number> {
    return this.sessions.deleteExpired(this.clock.now());
  }

  private async issueSession(user: UserRow, userAgent: string | null): Promise<IssuedSession> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(this.clock.now().getTime() + AuthService.SESSION_TTL_MS);
    await this.sessions.create(AuthService.hashToken(token), user.id, expiresAt, userAgent?.slice(0, 300) ?? null);
    return { user: toPublicUser(user), token, expiresAt };
  }

  /** Only the hash is stored, so a leaked sessions table cannot be replayed. */
  private static hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
