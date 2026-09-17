import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Download, Wallet } from 'lucide-react';
import type { AttendanceRecord } from '@/types';
import {
  buildMonthMatrix,
  daysInMonth,
  shiftMonth,
  todayWorkDate,
  WEEKDAY_SHORT,
} from '@/lib/date';
import { computeWorkedMinutes, minutesToHours } from '@/lib/hours';
import { formatMoney } from '@/lib/payroll';
import { attendanceToCsv, buildExportFileName, downloadCsv } from '@/lib/export';
import { toErrorMessage } from '@/lib/errors';
import { Button } from '@/components/Button';
import { Select } from '@/components/Form';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/Feedback';
import { useToast } from '@/components/toast';
import { useCrews } from '@/features/crews/queries';
import { useWorkers } from '@/features/workers/queries';
import { useAttendanceList } from '@/features/attendance/queries';
import { MonthCell } from './MonthCell';
import { usePayrollMonth } from '@/features/payroll/usePayrollMonth';
import { PayrollDetailSheet } from '@/features/payroll/PayrollDetailSheet';

const today = todayWorkDate();

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

/** 人員當月出勤月曆：僅管理員可看，可選人員與前後切換年月。 */
export function AdminCalendarPage() {
  const [workerId, setWorkerId] = useState('');
  const [editingPayroll, setEditingPayroll] = useState(false);
  const [cursor, setCursor] = useState(() => ({
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)),
  }));

  const toast = useToast();
  const crewsQuery = useCrews();
  const workersQuery = useWorkers();

  const from = `${cursor.year}-${pad(cursor.month)}-01`;
  const to = `${cursor.year}-${pad(cursor.month)}-${pad(daysInMonth(cursor.year, cursor.month))}`;

  const payMonth = `${cursor.year}-${pad(cursor.month)}`;
  const attendanceQuery = useAttendanceList({ from, to, workerId: workerId || undefined }, Boolean(workerId));

  // 薪資完全由當月出勤即時計算，沒有快照，所以打卡一改金額就跟著變
  const payroll = usePayrollMonth(payMonth, { workerId: workerId || undefined });
  const payrollRow = workerId ? (payroll.rows[0] ?? null) : null;

  const recordByDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    for (const record of attendanceQuery.data ?? []) map.set(record.workDate, record);
    return map;
  }, [attendanceQuery.data]);

  const weeks = useMemo(() => buildMonthMatrix(cursor.year, cursor.month), [cursor]);

  const summary = useMemo(() => {
    let presentDays = 0;
    let leaveDays = 0;
    let absentDays = 0;
    let minutes = 0;
    for (const record of attendanceQuery.data ?? []) {
      if (record.status === 'leave') leaveDays += 1;
      if (record.status === 'absent') absentDays += 1;
      if (record.status === 'present' && record.checkInAt) presentDays += 1;
      minutes += computeWorkedMinutes(record) ?? 0;
    }
    return { presentDays, leaveDays, absentDays, hours: minutesToHours(minutes) };
  }, [attendanceQuery.data]);

  const worker = (workersQuery.data ?? []).find((item) => item.id === workerId);

  const handleExport = () => {
    const records = attendanceQuery.data ?? [];
    if (records.length === 0) {
      toast.error('這個月沒有資料可以匯出');
      return;
    }
    downloadCsv(
      buildExportFileName(`calendar_${worker?.name ?? 'worker'}`, from, to),
      attendanceToCsv(records, workersQuery.data ?? [], crewsQuery.data ?? []),
    );
    toast.success('已匯出當月出勤明細');
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink">出勤月曆</h1>
        <Button
          variant="secondary"
          icon={<Download size={16} />}
          disabled={!workerId}
          onClick={handleExport}
        >
          匯出當月
        </Button>
      </header>

      <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <Select
          aria-label="選擇人員"
          value={workerId}
          onChange={(event) => {
            setWorkerId(event.target.value);
            setEditingPayroll(false);
          }}
        >
          <option value="">請選擇人員…</option>
          {(workersQuery.data ?? []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
              {item.employeeNo ? `（${item.employeeNo}）` : ''}
            </option>
          ))}
        </Select>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="上個月"
            onClick={() => {
              setCursor((current) => shiftMonth(current.year, current.month, -1));
              setEditingPayroll(false);
            }}
            className="tap flex items-center justify-center rounded-xl border border-line-strong text-ink-soft hover:bg-surface-sunken"
          >
            <ChevronLeft size={22} />
          </button>
          <p className="tnum flex-1 text-center text-lg font-bold text-ink">
            {cursor.year} 年 {cursor.month} 月
          </p>
          <button
            type="button"
            aria-label="下個月"
            onClick={() => {
              setCursor((current) => shiftMonth(current.year, current.month, 1));
              setEditingPayroll(false);
            }}
            className="tap flex items-center justify-center rounded-xl border border-line-strong text-ink-soft hover:bg-surface-sunken"
          >
            <ChevronRight size={22} />
          </button>
        </div>
      </div>

      {!workerId ? (
        <EmptyState
          icon={<CalendarDays size={36} strokeWidth={1.5} />}
          title="請先選擇一位人員"
          description="選擇後就會顯示該人員當月的出勤月曆，國定假日會另外標示。"
        />
      ) : attendanceQuery.isLoading ? (
        <ListSkeleton rows={4} />
      ) : attendanceQuery.isError ? (
        <ErrorState
          message={toErrorMessage(attendanceQuery.error)}
          onRetry={() => void attendanceQuery.refetch()}
        />
      ) : (
        <>
          <section className="grid grid-cols-4 gap-2">
            <div className="rounded-xl border border-line bg-surface p-3 text-center">
              <p className="tnum text-xl font-bold text-present">{summary.presentDays}</p>
              <p className="text-xs font-semibold text-ink-soft">出勤</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-3 text-center">
              <p className="tnum text-xl font-bold text-leave">{summary.leaveDays}</p>
              <p className="text-xs font-semibold text-ink-soft">請假</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-3 text-center">
              <p className="tnum text-xl font-bold text-absent">{summary.absentDays}</p>
              <p className="text-xs font-semibold text-ink-soft">未到</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-3 text-center">
              <p className="tnum text-xl font-bold text-ink">{summary.hours}</p>
              <p className="text-xs font-semibold text-ink-soft">總工時</p>
            </div>
          </section>

          <div className="overflow-x-auto rounded-2xl border border-line bg-surface p-2">
            <table className="w-full min-w-[520px] table-fixed border-collapse">
              <thead>
                <tr>
                  {WEEKDAY_SHORT.map((label, index) => (
                    <th
                      key={label}
                      className={`pb-1 text-xs font-bold ${index === 0 || index === 6 ? 'text-absent' : 'text-ink-soft'}`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((week, weekIndex) => (
                  <tr key={weekIndex}>
                    {week.map((workDate, dayIndex) => (
                      <td key={dayIndex} className="p-0.5 align-top">
                        <MonthCell
                          workDate={workDate}
                          record={workDate ? (recordByDate.get(workDate) ?? null) : null}
                          isToday={workDate === today}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {payrollRow ? (
            <section className="rounded-2xl border border-line bg-surface p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-1.5 font-bold text-ink">
                  <Wallet size={17} />
                  當月薪資試算
                </h2>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setEditingPayroll(true)}
                  disabled={payroll.isLoading}
                >
                  借支／加給
                </Button>
              </div>

              {payrollRow.worker.dailyWage ? (
                <>
                  <dl className="tnum divide-y divide-line text-sm">
                    <div className="flex justify-between py-1.5">
                      <dt className="text-ink-soft">
                        出勤工資（{formatMoney(payrollRow.breakdown.dailyWage)} ×{' '}
                        {payrollRow.tally.presentDays} 天）
                      </dt>
                      <dd className="font-semibold text-ink">
                        {formatMoney(payrollRow.breakdown.attendancePay)}
                      </dd>
                    </div>
                    {payrollRow.breakdown.annualLeavePay > 0 ? (
                      <div className="flex justify-between py-1.5">
                        <dt className="text-ink-soft">
                          特休工資（全薪 × {payrollRow.tally.annualLeaveDays} 天）
                        </dt>
                        <dd className="font-semibold text-ink">
                          {formatMoney(payrollRow.breakdown.annualLeavePay)}
                        </dd>
                      </div>
                    ) : null}
                    {payrollRow.breakdown.sickLeavePay > 0 ? (
                      <div className="flex justify-between py-1.5">
                        <dt className="text-ink-soft">
                          病假工資（半薪 × {payrollRow.tally.sickLeaveDays} 天）
                        </dt>
                        <dd className="font-semibold text-ink">
                          {formatMoney(payrollRow.breakdown.sickLeavePay)}
                        </dd>
                      </div>
                    ) : null}
                    {payrollRow.breakdown.extraPayTotal > 0 ? (
                      <div className="flex justify-between py-1.5">
                        <dt className="text-ink-soft">額外派遣加給</dt>
                        <dd className="font-semibold text-present">
                          + {formatMoney(payrollRow.breakdown.extraPayTotal)}
                        </dd>
                      </div>
                    ) : null}
                    {payrollRow.breakdown.advanceDeductionTotal > 0 ? (
                      <div className="flex justify-between py-1.5">
                        <dt className="text-ink-soft">借支還款</dt>
                        <dd className="font-semibold text-absent">
                          − {formatMoney(payrollRow.breakdown.advanceDeductionTotal)}
                        </dd>
                      </div>
                    ) : null}
                    <div className="flex items-baseline justify-between py-2">
                      <dt className="font-bold text-ink">實領金額</dt>
                      <dd className="text-2xl font-bold text-brand">
                        {formatMoney(payrollRow.breakdown.netPay)}
                      </dd>
                    </div>
                  </dl>

                  <p className="mt-1 text-xs text-ink-mute">
                    金額依當月出勤即時計算，打卡或請假一更動就會跟著變。
                    事假與未到不計薪；不含加班費、勞健保與稅務扣繳。
                  </p>
                </>
              ) : (
                <p className="rounded-xl bg-leave-soft px-3 py-2 text-sm font-semibold text-leave">
                  這位人員尚未設定日薪，無法試算月薪。請到「人員」頁補上。
                </p>
              )}
            </section>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 text-xs text-ink-soft">
            <span className="flex items-center gap-1">
              <span className="size-3 rounded bg-present-soft ring-1 ring-present" />出勤
            </span>
            <span className="flex items-center gap-1">
              <span className="size-3 rounded bg-leave-soft ring-1 ring-leave" />請假
            </span>
            <span className="flex items-center gap-1">
              <span className="size-3 rounded bg-absent-soft ring-1 ring-absent" />未到
            </span>
            <span className="flex items-center gap-1">
              <span className="size-3 rounded bg-surface-sunken ring-1 ring-line-strong" />無紀錄
            </span>
            <span>國定假日以紅字標示日期與節日名稱</span>
          </div>

          <p className="text-xs text-ink-mute">
            國定假日為系統預設值，請依行政院人事行政總處公告校正。
          </p>
        </>
      )}
      {editingPayroll && payrollRow ? (
        <PayrollDetailSheet
          row={payrollRow}
          month={payMonth}
          onClose={() => setEditingPayroll(false)}
        />
      ) : null}
    </div>
  );
}
