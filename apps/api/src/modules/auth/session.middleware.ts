import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../../core/http';
import type { AuthService } from './auth.service';
import type { SessionCookie } from './session-cookie';

export function sessionMiddleware(auth: AuthService, cookie: SessionCookie): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const token = cookie.read(c);
    if (token) {
      const session = await auth.authenticate(token);
      if (session) {
        c.set('user', session.user);
        if (session.renewedUntil) cookie.set(c, token, session.renewedUntil);
      } else {
        cookie.clear(c);
      }
    }
    await next();
  };
}
