import { AlertOctagon, AlertTriangle, Info } from 'lucide-react';
import type { ComplianceIssue, ComplianceLevel } from '@/lib/compliance';

const LEVEL_STYLE: Record<ComplianceLevel, { box: string; icon: React.ReactNode; label: string }> = {
  violation: {
    box: 'border-absent bg-absent-soft',
    icon: <AlertOctagon size={16} className="text-absent" />,
    label: '可能違法',
  },
  warning: {
    box: 'border-leave bg-leave-soft',
    icon: <AlertTriangle size={16} className="text-leave" />,
    label: '待確認',
  },
  info: {
    box: 'border-line bg-surface-sunken',
    icon: <Info size={16} className="text-ink-soft" />,
    label: '提醒',
  },
};

/** 勞基法檢核結果清單。只做提醒，不自動調整任何資料。 */
export function ComplianceList({ issues }: { issues: ComplianceIssue[] }) {
  if (issues.length === 0) {
    return (
      <p className="rounded-xl bg-present-soft px-3 py-2 text-sm font-semibold text-present">
        這個月沒有發現需要注意的項目。
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {issues.map((issue) => {
        const style = LEVEL_STYLE[issue.level];
        return (
          <li key={issue.code} className={`rounded-xl border px-3 py-2 ${style.box}`}>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0">{style.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-ink">
                  <span className="mr-1.5 rounded bg-white/70 px-1.5 py-0.5 text-[11px]">
                    {style.label}
                  </span>
                  {issue.title}
                </p>
                <p className="mt-1 text-xs text-ink-soft">{issue.detail}</p>
                <p className="mt-1 text-[11px] text-ink-mute">依據：{issue.basis}</p>
                {issue.workDates && issue.workDates.length > 0 ? (
                  <p className="tnum mt-1 text-[11px] text-ink-mute">
                    日期：{issue.workDates.slice(0, 8).join('、')}
                    {issue.workDates.length > 8 ? ` 等 ${issue.workDates.length} 天` : ''}
                  </p>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
