import { z } from 'zod';
import { NICKNAME_PATTERN, PASSWORD_MIN_LENGTH, USER_ROLES } from './constants';

export const nicknameSchema = z.string().trim().regex(NICKNAME_PATTERN, 'Nickname: 3-24 chars, letters, digits, _');
export const passwordSchema = z.string().min(PASSWORD_MIN_LENGTH, `Password: at least ${PASSWORD_MIN_LENGTH} chars`).max(128);

/** Registration: strict rules. */
export const credentialsSchema = z.object({ nickname: nicknameSchema, password: passwordSchema });
/** Login: loose rules so wrong input yields INVALID_CREDENTIALS, not a validation hint. */
export const loginSchema = z.object({
  nickname: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(128),
});

export type Credentials = z.infer<typeof credentialsSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export type UserRole = (typeof USER_ROLES)[number];

export interface PublicUser {
  id: string;
  nickname: string;
  role: UserRole;
  createdAt: string;
}

export interface AuthResponse {
  user: PublicUser;
}
