import type { PayrollRow } from './usePayrollMonth';
import { formatMoney } from '@/lib/payroll';
import { formatServiceLength } from '@/lib/labor';
import { formatWorkedDuration } from '@/lib/hours';
import { Sheet } from '@/components/Sheet';
import { AdvanceSection } from './AdvanceSection';
import { ExtraPaySection } from './ExtraPaySection';
import { ComplianceList } from './ComplianceList';

interface PayrollDetailSheetProps {
  row: PayrollRow;
  month: string;
  onClose: () => void;
}

function Line({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-sm text-ink-soft">{label}</span>
      <span className={`tnum ${strong ? 'text-lg font-bold' : 'text-sm font-semibold'} ${tone ?? 'text-ink'}`}>
        {value}
      </span>
    </div>
  );
}

export function PayrollDetailSheet({ row, month, onClose }: PayrollDetailSheetProps) {
  const { worker, tally, breakdown, leaveYear, annualLeaveUsed } = row;
  const remainingLeave = leaveYear ? Math.max(0, leaveYear.entitledDays - annualLeaveUsed) : 0;

  return (
    <Sheet open title={`${worker.name}\u3000${month}`} onClose={onClose}>
      <div className="space-y-5">
        {/* 年資與特休（勞基法 §38） */}
        <section className="rounded-xl border border-line bg-surface-sunken p-3">
          <h3 className="mb-2 font-bold text-ink">年資與特別休假</h3>
          {worker.hireDate && leaveYear ? (
            <>
              <p className="tnum text-sm text-ink-soft">
                到職日 <span className="font-semibold text-ink">{worker.hireDate}</span>
                <span className="ml-3">
                  年資{' '}
                  <span className="font-semibold text-ink">
                    {formatServiceLength(worker.hireDate, `${month}-01`)}
                  </span>
                </span>
              </p>
              <div className="tnum mt-2 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-surface py-2">
                  <p className="text-lg font-bold text-ink">{leaveYear.entitledDays}</p>
                  <p className="text-xs text-ink-soft">本年度應給</p>
                </div>
                <div className="rounded-lg bg-surface py-2">
                  <p className="text-lg font-bold text-leave">{annualLeaveUsed}</p>
                  <p className="text-xs text-ink-soft">已休</p>
                </div>
                <div className="rounded-lg bg-surface py-2">
                  <p className="text-lg font-bold text-present">{remainingLeave}</p>
                  <p className="text-xs text-ink-soft">剩餘</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-ink-mute">
                特休年度 {leaveYear.from} ～ {leaveYear.to}（{leaveYear.basis}）。
                年度終結或契約終止時未休完的日數，依 §38 應發給工資。
              </p>
            </>
          ) : (
            <p className="text-sm text-leave">尚未填寫到職日，無法計算年資與特休。</p>
          )}
        </section>

        {/* 出勤統計 */}
        <section>
          <h3 className="mb-2 font-bold text-ink">當月出勤</h3>
          <div className="tnum grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
            {[
              { label: '出勤', value: tally.presentDays, tone: 'text-present' },
              { label: '特休', value: tally.annualLeaveDays, tone: 'text-brand' },
              { label: '病假', value: tally.sickLeaveDays, tone: 'text-leave' },
              { label: '事假', value: tally.personalLeaveDays, tone: 'text-ink-soft' },
              { label: '其他假', value: tally.otherLeaveDays, tone: 'text-ink-soft' },
              { label: '未到', value: tally.absentDays, tone: 'text-absent' },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-surface-sunken py-2">
                <p className={`text-lg font-bold ${item.tone}`}>{item.value}</p>
                <p className="text-xs text-ink-soft">{item.label}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-mute">
            實際工時合計 {formatWorkedDuration(tally.workedMinutes || null)}（僅供參考，不參與薪資計算）
          </p>
        </section>

        {/* 薪資試算 */}
        <section className="rounded-xl border border-line bg-surface p-3">
          <h3 className="mb-1 font-bold text-ink">月薪試算</h3>
          <Line
            label={`出勤工資（${formatMoney(breakdown.dailyWage)} × ${tally.presentDays} 天）`}
            value={formatMoney(breakdown.attendancePay)}
          />
          <Line
            label={`特休工資（全薪 × ${tally.annualLeaveDays} 天）`}
            value={formatMoney(breakdown.annualLeavePay)}
          />
          <Line
            label={`病假工資（半薪 × ${tally.sickLeaveDays} 天）`}
            value={formatMoney(breakdown.sickLeavePay)}
          />
          <div className="my-1 border-t border-line" />
          <Line label="工資小計" value={formatMoney(breakdown.basePay)} />
          <Line
            label="額外派遣加給"
            value={`+ ${formatMoney(breakdown.extraPayTotal)}`}
            tone="text-present"
          />
          <Line
            label="借支還款"
            value={`− ${formatMoney(breakdown.advanceDeductionTotal)}`}
            tone="text-absent"
          />
          <div className="my-1 border-t-2 border-line-strong" />
          <Line label="實領金額" value={formatMoney(breakdown.netPay)} strong tone="text-brand" />
          <p className="mt-2 text-xs text-ink-mute">
            事假與未到不計薪。本試算不含加班費、勞健保與稅務扣繳。
          </p>
        </section>

        <ExtraPaySection workerId={worker.id} month={month} items={row.extraPays} />

        <AdvanceSection
          workerId={worker.id}
          workerName={worker.name}
          month={month}
          items={row.advances}
        />

        <section>
          <h3 className="mb-2 font-bold text-ink">勞基法檢核</h3>
          <ComplianceList issues={row.issues} />
        </section>
      </div>
    </Sheet>
  );
}
