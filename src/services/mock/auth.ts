/**
 * ⚠️ 這整個檔案是「前端 mock」，不是可上線的驗證機制。
 *
 * 現況（僅供前端開發與展示）：
 *   - 密碼以明文存在 localStorage 的 siteclock:accounts 裡，直接字串比對。
 *   - session 只是把使用者資料寫進 sessionStorage，沒有任何簽章或有效期。
 *   - 任何人開 DevTools 都能改掉自己的角色。
 *
 * 接上後端時**必須**做到：
 *   - 密碼雜湊（bcrypt / argon2）與比對一律在後端進行，前端絕不儲存明文密碼或雜湊值。
 *   - session 由後端簽發（JWT 或 HttpOnly + Secure + SameSite cookie），前端不自行產生或解析。
 *   - 權限判斷雖然前端也有一份（src/lib/permissions.ts），但後端必須獨立再驗一次，
 *     前端那份只用來決定畫面呈現與提早攔截。
 *   - 這個檔案應被 src/services/http/auth.ts 取代，整張 accounts 表隨之刪除。
 */
import { credentialsSchema, changePasswordSchema, authUserSchema } from '@/schemas/auth';
import type { AuthUser, ChangePasswordInput, Credentials } from '@/types';
import { AppError, NotFoundError, UnauthorizedError, ValidationError } from '@/lib/errors';
import type { AuthRepository } from '../contracts';
import { commit, delay, getDb, type MockAccount } from './db';
import { DEFAULT_PASSWORD } from './seed';
import { clearSession, readSession, writeSession } from './session';

/** 帳號欄位可輸入 username、手機或員工編號。 */
function findAccount(identifier: string): MockAccount | null {
  const db = getDb();
  const needle = identifier.trim().toLowerCase();

  const byUsername = db.accounts.find((account) => account.username.toLowerCase() === needle);
  if (byUsername) return byUsername;

  const worker = db.workers.find(
    (item) =>
      (item.phone && item.phone.toLowerCase() === needle) ||
      (item.employeeNo && item.employeeNo.toLowerCase() === needle),
  );
  if (!worker) return null;

  return db.accounts.find((account) => account.workerId === worker.id) ?? null;
}

function toAuthUser(account: MockAccount): AuthUser {
  const db = getDb();
  const worker = account.workerId
    ? (db.workers.find((item) => item.id === account.workerId) ?? null)
    : null;

  return authUserSchema.parse({
    id: account.id,
    name: worker?.name ?? account.name,
    role: account.role,
    crewId: worker?.crewId ?? null,
    workerId: worker?.id ?? null,
    canSelfCheckIn: account.role === 'admin' ? false : (worker?.canSelfCheckIn ?? false),
  });
}

export const mockAuthRepository: AuthRepository = {
  async login(credentials: Credentials): Promise<AuthUser> {
    await delay();
    const parsed = credentialsSchema.safeParse(credentials);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? '帳號或密碼格式不正確');
    }

    const account = findAccount(parsed.data.identifier);
    // 一律回同一段訊息，避免洩漏帳號是否存在
    if (!account || account.password !== parsed.data.password) {
      throw new UnauthorizedError('帳號或密碼錯誤');
    }

    const worker = account.workerId
      ? getDb().workers.find((item) => item.id === account.workerId)
      : null;
    if (worker && !worker.active) {
      throw new AppError('FORBIDDEN', '此帳號已停用，請聯絡管理員');
    }

    const user = toAuthUser(account);
    writeSession(user);
    return user;
  },

  async logout(): Promise<void> {
    await delay();
    clearSession();
  },

  async getCurrentUser(): Promise<AuthUser | null> {
    const session = readSession();
    if (!session) return null;
    // 重新由資料庫組一次，確保角色／工班異動後 session 會跟上
    const account = getDb().accounts.find((item) => item.id === session.id);
    if (!account) {
      clearSession();
      return null;
    }
    const fresh = toAuthUser(account);
    writeSession(fresh);
    return fresh;
  },

  async changePassword(input: ChangePasswordInput): Promise<void> {
    await delay();
    const session = readSession();
    if (!session) throw new UnauthorizedError();

    const parsed = changePasswordSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? '密碼格式不正確');
    }

    const db = getDb();
    const index = db.accounts.findIndex((item) => item.id === session.id);
    if (index < 0) throw new NotFoundError('找不到帳號');

    const account = db.accounts[index]!;
    if (account.password !== parsed.data.currentPassword) {
      throw new ValidationError('目前密碼不正確');
    }

    const next = db.accounts.slice();
    next[index] = { ...account, password: parsed.data.newPassword };
    commit('accounts', next);
  },

  async resetPassword(workerId: string): Promise<{ password: string }> {
    await delay();
    const session = readSession();
    if (!session) throw new UnauthorizedError();
    if (session.role !== 'admin') {
      throw new AppError('FORBIDDEN', '只有管理員可以重設密碼');
    }

    const db = getDb();
    const index = db.accounts.findIndex((item) => item.workerId === workerId);
    if (index < 0) throw new NotFoundError('此人員尚未建立登入帳號');

    const next = db.accounts.slice();
    next[index] = { ...next[index]!, password: DEFAULT_PASSWORD };
    commit('accounts', next);
    return { password: DEFAULT_PASSWORD };
  },
};
