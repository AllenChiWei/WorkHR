import type { AttendanceRecord, Worker } from '@/types';
import { computeWorkedMinutes, isMissingCheckOut } from './hours';
import {
  DAILY_WAGE_FLOOR,
  MAX_DAILY_HOURS,
  MAX_MONTHLY_OVERTIME_HOURS,
  MINIMUM_WAGE,
  NORMAL_DAILY_HOURS,
  longestConsecutiveWorkDays,
} from './labor';
import { formatMoney } from './payroll';

/**
 * 勞基法法遵檢核：在管理員審閱資料時把可能違法或資料不完整的地方標出來。
 *
 * 這裡只做「提醒」，不自動調整薪資或工時。
 * 檢核結果不構成法律意見，實際認定以主管機關為準。
 */

export type ComplianceLevel = 'violation' | 'warning' | 'info';

export interface ComplianceIssue {
  code: string;
  level: ComplianceLevel;
  title: string;
  detail: string;
  /** 條文依據，顯示在提示旁邊。 */
  basis: string;
  /** 相關的工作日，方便管理員直接去查。 */
  workDates?: string[];
}

/** 單日延長工時（分鐘）：超過法定正常工時 8 小時的部分。 */
function overtimeMinutes(record: AttendanceRecord): number {
  const worked = computeWorkedMinutes(record);
  if (worked === null) return 0;
  return Math.max(0, worked - NORMAL_DAILY_HOURS * 60);
}

/** 檢核某位人員在某個月份的出勤資料。 */
export function checkWorkerMonth(records: AttendanceRecord[]): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];

  // §30：出勤紀錄應逐日記載至分鐘為止，缺下班時間即屬紀錄不完整
  const incomplete = records.filter(isMissingCheckOut);
  if (incomplete.length > 0) {
    issues.push({
      code: 'INCOMPLETE_RECORD',
      level: 'warning',
      title: `${incomplete.length} 天只有上班、沒有下班時間`,
      detail: '出勤紀錄不完整，無法核算工時，請補登下班時間。',
      basis: '勞基法 §30 出勤紀錄應逐日記載至分鐘為止',
      workDates: incomplete.map((record) => record.workDate),
    });
  }

  // §32：單日正常工時加延長工時不得超過 12 小時
  const overLongDays = records.filter((record) => {
    const worked = computeWorkedMinutes(record);
    return worked !== null && worked > MAX_DAILY_HOURS * 60;
  });
  if (overLongDays.length > 0) {
    issues.push({
      code: 'DAILY_HOURS_EXCEEDED',
      level: 'violation',
      title: `${overLongDays.length} 天單日工時超過 ${MAX_DAILY_HOURS} 小時`,
      detail: '單日正常工時加延長工時合計不得超過 12 小時，請確認打卡時間是否正確。',
      basis: '勞基法 §32 第 2 項',
      workDates: overLongDays.map((record) => record.workDate),
    });
  }

  // §32：每月延長工時不得超過 46 小時
  const monthlyOvertime = records.reduce((total, record) => total + overtimeMinutes(record), 0);
  const monthlyOvertimeHours = Math.round((monthlyOvertime / 60) * 10) / 10;
  if (monthlyOvertimeHours > MAX_MONTHLY_OVERTIME_HOURS) {
    issues.push({
      code: 'MONTHLY_OVERTIME_EXCEEDED',
      level: 'violation',
      title: `當月延長工時 ${monthlyOvertimeHours} 小時，超過 ${MAX_MONTHLY_OVERTIME_HOURS} 小時上限`,
      detail:
        '一個月延長工時不得超過 46 小時；經工會或勞資會議同意者得放寬為每月 54 小時、每三個月 138 小時。',
      basis: '勞基法 §32 第 2 項',
    });
  }

  // §36：每七日應有二日之休息，連續出勤超過 6 日即需檢視
  const presentDates = records
    .filter((record) => record.status === 'present' && record.checkInAt)
    .map((record) => record.workDate);
  const consecutive = longestConsecutiveWorkDays(presentDates);
  if (consecutive > 6) {
    issues.push({
      code: 'CONSECUTIVE_DAYS',
      level: 'warning',
      title: `最長連續出勤 ${consecutive} 天`,
      detail: '每七日中應有二日休息（一日例假、一日休息日），請確認排班是否符合規定。',
      basis: '勞基法 §36',
    });
  }

  return issues;
}

/** 檢核人員的基本資料是否足以合法計算年資與工資。 */
export function checkWorkerProfile(worker: Worker): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];

  if (!worker.hireDate) {
    issues.push({
      code: 'MISSING_HIRE_DATE',
      level: 'warning',
      title: '未填到職日',
      detail: '沒有到職日就無法計算年資與特別休假天數，請補上。',
      basis: '勞基法 §38 特別休假依年資給假',
    });
  }

  if (!worker.dailyWage || worker.dailyWage <= 0) {
    issues.push({
      code: 'MISSING_DAILY_WAGE',
      level: 'info',
      title: '未設定日薪',
      detail: '未設定日薪時無法試算月薪。',
      basis: '—',
    });
  } else if (worker.dailyWage < DAILY_WAGE_FLOOR) {
    issues.push({
      code: 'BELOW_MINIMUM_WAGE',
      level: 'warning',
      title: `日薪 ${formatMoney(worker.dailyWage)} 低於基本工資換算值`,
      detail: `以 ${MINIMUM_WAGE.effectiveYear} 年基本工資時薪 ${MINIMUM_WAGE.hourly} 元 × 每日 ${NORMAL_DAILY_HOURS} 小時計算為 ${formatMoney(DAILY_WAGE_FLOOR)}。日薪制如何對照基本工資實務上有不同見解，請與勞保投保薪資一併確認。`,
      basis: `勞動部公告 ${MINIMUM_WAGE.effectiveYear} 年基本工資：月薪 ${MINIMUM_WAGE.monthly.toLocaleString('zh-Hant-TW')} 元、時薪 ${MINIMUM_WAGE.hourly} 元`,
    });
  }

  return issues;
}

export function countByLevel(issues: ComplianceIssue[]): Record<ComplianceLevel, number> {
  return issues.reduce<Record<ComplianceLevel, number>>(
    (acc, issue) => {
      acc[issue.level] += 1;
      return acc;
    },
    { violation: 0, warning: 0, info: 0 },
  );
}
