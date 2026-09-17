import { useMemo, useState } from 'react';
import { AlertOctagon, AlertTriangle, ChevronLeft, ChevronRight, Download, Wallet } from 'lucide-react';
import { formatMoney, payMonthOf, shiftPayMonth } from '@/lib/payroll';
import { todayWorkDate } from '@/lib/date';
import { countByLevel } from '@/lib/compliance';
import { buildExportFileName, downloadCsv, payrollToCsv, type PayrollCsvRow } from '@/lib/export';
import { toErrorMessage } from '@/lib/errors';
import { Button } from '@/components/Button';
import { Select } from '@/components/Form';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/Feedback';
import { useToast } from '@/components/toast';
import { useCrews } from '@/features/crews/queries';
import { PayrollDetailSheet } from './PayrollDetailSheet';
import { usePayrollMonth, type PayrollRow } from './usePayrollMonth';

const thisMonth = payMonthOf(todayWorkDate());

/** 薪資頁：月薪試算、借支、額外派遣加給與勞基法檢核，僅管理員可見。 */
export function PayrollPage() {
  const [month, setMonth] = useState(thisMonth);
  const [crewId, setCrewId] = useState('');
  const [detail, setDetail] = useState<PayrollRow | null>(null);

  const toast = useToast();
  const crewsQuery = useCrews();
  const { rows, range, isLoading, isError, error, refetch } = usePayrollMonth(month, crewId);

  const crewNameById = useMemo(
    () => new Map((crewsQuery.data ?? []).map((crew) => [crew.id, crew.name])),
    [crewsQuery.data],
  );

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          netPay: acc.netPay + row.breakdown.netPay,
          extraPay: acc.extraPay + row.breakdown.extraPayTotal,
          deduction: acc.deduction + row.breakdown.advanceDeductionTotal,
          violations: acc.violations + countByLevel(row.issues).violation,
          warnings: acc.warnings + countByLevel(row.issues).warning,
        }),
        { netPay: 0, extraPay: 0, deduction: 0, violations: 0, warnings: 0 },
      ),
    [rows],
  );

  // 詳情面板的資料要跟著查詢結果更新，否則新增借支後看到的是舊值
  const activeDetail = detail
    ? (rows.find((row) => row.worker.id === detail.worker.id) ?? detail)
    : null;

  const handleExport = () => {
    if (rows.length === 0) {
      toast.error('這個月沒有資料可以匯出');
      return;
    }
    const csvRows: PayrollCsvRow[] = rows.map((row) => ({
      month,
      crewName: row.worker.crewId ? (crewNameById.get(row.worker.crewId) ?? '') : '（未指派）',
      workerName: row.worker.name,
      employeeNo: row.worker.employeeNo ?? '',
      hireDate: row.worker.hireDate ?? '',
      dailyWage: row.worker.dailyWage ?? 0,
      presentDays: row.tally.presentDays,
      annualLeaveDays: row.tally.annualLeaveDays,
      sickLeaveDays: row.tally.sickLeaveDays,
      personalLeaveDays: row.tally.personalLeaveDays,
      absentDays: row.tally.absentDays,
      attendancePay: row.breakdown.attendancePay,
      annualLeavePay: row.breakdown.annualLeavePay,
      sickLeavePay: row.breakdown.sickLeavePay,
      extraPayTotal: row.breakdown.extraPayTotal,
      advanceDeductionTotal: row.breakdown.advanceDeductionTotal,
      netPay: row.breakdown.netPay,
    }));

    downloadCsv(buildExportFileName('payroll', range.from, range.to), payrollToCsv(csvRows));
    toast.success(`已匯出 ${rows.length} 位人員的薪資試算`);
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink">薪資試算</h1>
        <Button variant="secondary" icon={<Download size={16} />} onClick={handleExport}>
          匯出 CSV
        </Button>
      </header>

      <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="上個月"
            onClick={() => setMonth((current) => shiftPayMonth(current, -1))}
            className="tap flex items-center justify-center rounded-xl border border-line-strong text-ink-soft hover:bg-surface-sunken"
          >
            <ChevronLeft size={22} />
          </button>
          <p className="tnum flex-1 text-center text-lg font-bold text-ink">
            {month.replace('-', " 年 ")} 月
          </p>
          <button
            type="button"
            aria-label="下個月"
            onClick={() => setMonth((current) => shiftPayMonth(current, 1))}
            className="tap flex items-center justify-center rounded-xl border border-line-strong text-ink-soft hover:bg-surface-sunken"
          >
            <ChevronRight size={22} />
          </button>
        </div>

        <Select aria-label="依工班篩選" value={crewId} onChange={(event) => setCrewId(event.target.value)}>
          <option value="">全部工班</option>
          {(crewsQuery.data ?? []).map((crew) => (
            <option key={crew.id} value={crew.id}>
              {crew.name}
            </option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : isError ? (
        <ErrorState message={toErrorMessage(error)} onRetry={refetch} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Wallet size={36} strokeWidth={1.5} />}
          title="沒有可試算的人員"
          description="請先建立人員並設定日薪，或換一個工班與月份。"
        />
      ) : (
        <>
          <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-line bg-surface p-3">
              <p className="tnum text-xl font-bold text-brand">{formatMoney(totals.netPay)}</p>
              <p className="text-xs font-semibold text-ink-soft">實領合計</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-3">
              <p className="tnum text-xl font-bold text-present">{formatMoney(totals.extraPay)}</p>
              <p className="text-xs font-semibold text-ink-soft">額外加給</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-3">
              <p className="tnum text-xl font-bold text-absent">{formatMoney(totals.deduction)}</p>
              <p className="text-xs font-semibold text-ink-soft">借支扣款</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-3">
              <p className="tnum text-xl font-bold text-ink">
                {totals.violations + totals.warnings}
              </p>
              <p className="text-xs font-semibold text-ink-soft">待檢核項目</p>
            </div>
          </section>

          <ul className="space-y-2">
            {rows.map((row) => {
              const levels = countByLevel(row.issues);
              return (
                <li key={row.worker.id}>
                  <button
                    type="button"
                    onClick={() => setDetail(row)}
                    className="tap flex w-full items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left hover:bg-surface-sunken"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-bold text-ink">{row.worker.name}</span>
                        {levels.violation > 0 ? (
                          <span className="flex items-center gap-1 rounded-md bg-absent-soft px-1.5 py-0.5 text-[11px] font-bold text-absent">
                            <AlertOctagon size={11} />
                            {levels.violation}
                          </span>
                        ) : null}
                        {levels.warning > 0 ? (
                          <span className="flex items-center gap-1 rounded-md bg-leave-soft px-1.5 py-0.5 text-[11px] font-bold text-leave">
                            <AlertTriangle size={11} />
                            {levels.warning}
                          </span>
                        ) : null}
                      </div>
                      <p className="tnum mt-1 text-xs text-ink-soft">
                        出勤 {row.tally.presentDays} 天 × {formatMoney(row.breakdown.dailyWage)}
                        {row.breakdown.extraPayTotal > 0
                          ? `\u3000+ 加給 ${formatMoney(row.breakdown.extraPayTotal)}`
                          : ''}
                        {row.breakdown.advanceDeductionTotal > 0
                          ? `\u3000− 借支 ${formatMoney(row.breakdown.advanceDeductionTotal)}`
                          : ''}
                      </p>
                    </div>
                    <span className="tnum shrink-0 text-lg font-bold text-brand">
                      {formatMoney(row.breakdown.netPay)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <p className="text-xs text-ink-mute">
            實領 = 日薪 × 出勤天數 + 特休全薪 + 病假半薪 + 額外加給 − 借支還款。
            事假與未到不計薪；不含加班費、勞健保與稅務扣繳。檢核結果僅供提醒，不構成法律意見。
          </p>
        </>
      )}

      {activeDetail ? (
        <PayrollDetailSheet row={activeDetail} month={month} onClose={() => setDetail(null)} />
      ) : null}
    </div>
  );
}
