import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';

export class SessionCookie {
  static readonly NAME = 'libify_sid';

  constructor(private readonly secure: boolean) {}

  read(c: Context): string | null {
    return getCookie(c, SessionCookie.NAME) ?? null;
  }

  set(c: Context, token: string, expiresAt: Date): void {
    setCookie(c, SessionCookie.NAME, token, {
      httpOnly: true,
      secure: this.secure,
      sameSite: 'Lax',
      path: '/',
      expires: expiresAt,
    });
  }

  clear(c: Context): void {
    deleteCookie(c, SessionCookie.NAME, { path: '/', secure: this.secure });
  }
}
