import { can, type PermissionAction, type PermissionContext } from '@/lib/permissions';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { todayWorkDate } from '@/lib/date';
import type { AuthUser } from '@/types';
import { readSession } from './session';

/**
 * 服務層的權限閘門。規格第 4 節要求權限檢查同時做在 route guard 與 service 層，
 * 因此每個會改動或讀取敏感資料的 mock 方法都必須先過這裡。
 */
export function requireUser(): AuthUser {
  const user = readSession();
  if (!user) throw new UnauthorizedError();
  return user;
}

export function requirePermission(
  action: PermissionAction,
  ctx: PermissionContext = {},
): AuthUser {
  const user = requireUser();
  const merged: PermissionContext = { today: todayWorkDate(), ...ctx };
  if (!can(user, action, merged)) {
    throw new ForbiddenError(describeDenial(action, user, merged));
  }
  return user;
}

function describeDenial(
  action: PermissionAction,
  user: AuthUser,
  ctx: PermissionContext,
): string {
  if (action === 'attendance:edit' && user.role === 'foreman' && ctx.workDate !== ctx.today) {
    return '僅管理員可修改非當日的打卡紀錄';
  }
  if (action === 'attendance:punchSelf' && user.role === 'worker') {
    return '你尚未開通自行打卡，請聯絡管理員';
  }
  return '你沒有執行這項操作的權限';
}
