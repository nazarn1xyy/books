import type { AuthResponse, Credentials, LoginInput, PublicUser } from '@libify/shared';
import type { ApiClient } from './ApiClient';
import { ApiError } from './ApiError';

export class AuthApi {
  private readonly client: ApiClient;

  constructor(client: ApiClient) {
    this.client = client;
  }

  /** Current user, or null when not logged in. Network errors propagate (caller decides about offline). */
  async me(): Promise<PublicUser | null> {
    try {
      return (await this.client.get<AuthResponse>('/auth/me')).user;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return null;
      throw err;
    }
  }

  async login(input: LoginInput): Promise<PublicUser> {
    return (await this.client.post<AuthResponse>('/auth/login', input)).user;
  }

  async register(input: Credentials): Promise<PublicUser> {
    return (await this.client.post<AuthResponse>('/auth/register', input)).user;
  }

  async logout(): Promise<void> {
    await this.client.post('/auth/logout');
  }
}
