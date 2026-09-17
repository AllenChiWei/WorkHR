import { authUserSchema } from '@/schemas/auth';
import type { AuthUser } from '@/types';
import { STORAGE_KEYS } from './db';

/** session 存 sessionStorage：關閉分頁即失效，且不會跨瀏覽器分頁污染。 */
export function readSession(): AuthUser | null {
  const raw = sessionStorage.getItem(STORAGE_KEYS.session);
  if (!raw) return null;
  try {
    const parsed = authUserSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function writeSession(user: AuthUser): void {
  sessionStorage.setItem(STORAGE_KEYS.session, JSON.stringify(user));
}

export function clearSession(): void {
  sessionStorage.removeItem(STORAGE_KEYS.session);
}
