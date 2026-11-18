import { Hono, type Context } from 'hono';
import { credentialsSchema, loginSchema, type AuthResponse } from '@libify/shared';
import { InvalidCredentialsError, RateLimitError } from '../../core/errors';
import { clientIp, currentUser, readJson, type AppEnv, type Controller } from '../../core/http';
import { rateLimit, requireAuth } from '../../core/middleware';
import type { FixedWindowRateLimiter } from '../../core/rate-limiter';
import type { AuthService, IssuedSession } from './auth.service';
import type { SessionCookie } from './session-cookie';

export interface AuthLimiters {
  /** Per IP: register + login attempts. */
  ip: FixedWindowRateLimiter;
  /**
   * Per nickname + IP: failed logins only, reset on success. Keyed by IP too, so nobody can
   * lock the owner out by failing logins for their nickname from elsewhere.
   */
  failedLogins: FixedWindowRateLimiter;
}

export class AuthController implements Controller {
  readonly basePath = '/auth';
  readonly usesSession = true;

  constructor(
    private readonly auth: AuthService,
    private readonly cookie: SessionCookie,
    private readonly limiters: AuthLimiters,
  ) {}

  routes(): Hono<AppEnv> {
    const ipLimit = rateLimit(this.limiters.ip, (c) => `auth-ip:${clientIp(c)}`);

    return new Hono<AppEnv>()
      .post('/register', ipLimit, async (c) => {
        const input = await readJson(c, credentialsSchema);
        const session = await this.auth.register(input, c.req.header('user-agent') ?? null);
        return this.respondWithSession(c, session, 201);
      })
      .post('/login', ipLimit, async (c) => {
        const input = await readJson(c, loginSchema);
        const failKey = `auth-fail:${input.nickname.toLowerCase()}:${clientIp(c)}`;
        const blocked = this.limiters.failedLogins.peek(failKey);
        if (!blocked.allowed) throw new RateLimitError(blocked.retryAfterSec);
        let session: IssuedSession;
        try {
          session = await this.auth.login(input, c.req.header('user-agent') ?? null);
        } catch (err) {
          if (err instanceof InvalidCredentialsError) this.limiters.failedLogins.consume(failKey);
          throw err;
        }
        this.limiters.failedLogins.reset(failKey);
        return this.respondWithSession(c, session, 200);
      })
      .post('/logout', async (c) => {
        const token = this.cookie.read(c);
        if (token) await this.auth.logout(token);
        this.cookie.clear(c);
        return c.body(null, 204);
      })
      .get('/me', requireAuth, (c) => {
        const { sessionId: _sessionId, ...user } = currentUser(c);
        return c.json<AuthResponse>({ user });
      });
  }

  private respondWithSession(c: Context<AppEnv>, session: IssuedSession, status: 200 | 201) {
    this.cookie.set(c, session.token, session.expiresAt);
    return c.json<AuthResponse>({ user: session.user }, status);
  }
}
