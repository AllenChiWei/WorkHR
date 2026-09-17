import type { AuthUser } from '@/types';

/**
 * 權限判斷的唯一來源。route guard 與 service 層都呼叫這裡，
 * 不依賴「把按鈕藏起來」。
 */
export type PermissionAction =
  | 'crew:manage' // 建立／編輯／停用工班、指派成員
  | 'worker:manage' // 建立／編輯／停用人員
  | 'attendance:viewAll' // 檢視全部工班打卡資料
  | 'attendance:viewCrew' // 檢視本班師傅清單與紀錄
  | 'attendance:punchOthers' // 代本班師傅打卡
  | 'attendance:punchSelf' // 為自己打卡
  | 'attendance:edit' // 修改打卡紀錄
  | 'attendance:viewHistory' // 檢視歷史出勤資料與報表（僅管理員）
  | 'report:export' // 匯出報表（僅管理員）
  | 'account:resetPassword'; // 重設他人密碼

export interface PermissionContext {
  /** 目標資料所屬工班。 */
  crewId?: string | null;
  /** 目標紀錄的工作日 'YYYY-MM-DD'。 */
  workDate?: string;
  /** 今天的工作日，預設由呼叫端帶入以利測試。 */
  today?: string;
  /** 目標人員 id（判斷是否為自己）。 */
  workerId?: string | null;
}

function isOwnCrew(user: AuthUser, ctx: PermissionContext): boolean {
  return Boolean(user.crewId) && ctx.crewId === user.crewId;
}

export function can(
  user: AuthUser | null,
  action: PermissionAction,
  ctx: PermissionContext = {},
): boolean {
  if (!user) return false;

  if (user.role === 'admin') {
    // 管理員可執行全部操作，且不受日期限制
    return true;
  }

  switch (action) {
    // 維護類操作，以及出勤歷史與報表，都只有管理員可以做；
    // 領班只負責當日打卡。
    case 'crew:manage':
    case 'worker:manage':
    case 'attendance:viewAll':
    case 'account:resetPassword':
    case 'attendance:viewHistory':
    case 'report:export':
      return false;

    case 'attendance:viewCrew':
    case 'attendance:punchOthers':
      return user.role === 'foreman' && isOwnCrew(user, ctx);

    case 'attendance:punchSelf':
      if (user.role === 'foreman') return true;
      return user.role === 'worker' && user.canSelfCheckIn;

    case 'attendance:edit': {
      // 領班僅能修改「本班」且「當日」的紀錄
      if (user.role !== 'foreman') return false;
      if (!isOwnCrew(user, ctx)) return false;
      if (!ctx.workDate || !ctx.today) return false;
      return ctx.workDate === ctx.today;
    }

    default:
      return false;
  }
}

/** 登入後應該導向的首頁。 */
export function homePathFor(user: AuthUser): string {
  if (user.role === 'admin') return '/admin';
  if (user.role === 'foreman') return '/crew';
  return '/me';
}
