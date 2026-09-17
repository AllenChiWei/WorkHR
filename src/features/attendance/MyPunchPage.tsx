import { LogIn, LogOut, CheckCircle2, UserX } from 'lucide-react';
import { buildRosterRow } from '@/lib/attendance';
import { formatClock, formatWorkDateLabel, todayWorkDate } from '@/lib/date';
import { formatWorkedDuration } from '@/lib/hours';
import { holidayName } from '@/lib/calendar';
import { isAppError, toErrorMessage } from '@/lib/errors';
import { useAuthStore } from '@/features/auth/authStore';
import { useWorker } from '@/features/workers/queries';
import { Button } from '@/components/Button';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/Feedback';
import { StatusChip } from '@/components/StatusChip';
import { useToast } from '@/components/toast';
import { useDailyAttendance, usePunch } from './queries';

/** 個人打卡頁：限已開通自行打卡者。 */
export function MyPunchPage() {
  const user = useAuthStore((state) => state.user);
  const workDate = todayWorkDate();

  const workerQuery = useWorker(user?.workerId ?? undefined);
  const attendanceQuery = useDailyAttendance(user?.crewId ?? undefined, workDate);
  const punch = usePunch();
  const toast = useToast();

  if (!user?.workerId || !user.crewId) {
    return (
      <EmptyState
        icon={<UserX size={36} strokeWidth={1.5} />}
        title="你尚未被指派到任何工班"
        description="請聯絡管理員把你加入工班後，才能使用打卡功能。"
      />
    );
  }

  if (workerQuery.isLoading || attendanceQuery.isLoading) return <ListSkeleton rows={2} />;

  if (workerQuery.isError || attendanceQuery.isError) {
    return (
      <ErrorState
        message={toErrorMessage(workerQuery.error ?? attendanceQuery.error)}
        onRetry={() => {
          void workerQuery.refetch();
          void attendanceQuery.refetch();
        }}
      />
    );
  }

  const worker = workerQuery.data;
  if (!worker) {
    return <EmptyState title="找不到你的人員資料" description="請聯絡管理員確認帳號設定。" />;
  }

  const record = (attendanceQuery.data ?? []).find((item) => item.workerId === worker.id) ?? null;
  const row = buildRosterRow(worker, record);
  const holiday = holidayName(workDate);

  const runPunch = async (kind: 'in' | 'out', overwrite = false) => {
    try {
      await punch.mutateAsync({
        workerId: worker.id,
        crewId: user.crewId!,
        workDate,
        kind,
        overwrite,
      });
      toast.success(kind === 'in' ? '上班打卡完成' : '下班打卡完成');
    } catch (mutationError) {
      if (isAppError(mutationError) && mutationError.code === 'CONFLICT') {
        toast.error(mutationError.message, {
          label: '覆蓋',
          onClick: () => void runPunch(kind, true),
        });
        return;
      }
      toast.error(toErrorMessage(mutationError), {
        label: '重試',
        onClick: () => void runPunch(kind, overwrite),
      });
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-4">
      <section className="rounded-2xl border border-line bg-surface p-5 text-center">
        <p className="text-sm font-semibold text-ink-soft">{formatWorkDateLabel(workDate)}</p>
        {holiday ? <p className="text-xs font-semibold text-leave">{holiday}</p> : null}
        <p className="mt-1 text-2xl font-bold text-ink">{worker.name}</p>
        <div className="mt-2 flex justify-center">
          <StatusChip status={row.status} />
        </div>

        <div className="tnum mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-surface-sunken py-3">
            <p className="text-xs font-semibold text-ink-soft">上班</p>
            <p className="text-2xl font-bold text-ink">{formatClock(row.checkInAt)}</p>
          </div>
          <div className="rounded-xl bg-surface-sunken py-3">
            <p className="text-xs font-semibold text-ink-soft">下班</p>
            <p className="text-2xl font-bold text-ink">{formatClock(row.checkOutAt)}</p>
          </div>
        </div>

        {row.workedMinutes !== null ? (
          <p className="mt-3 text-sm font-semibold text-present">
            今日工時 {formatWorkedDuration(row.workedMinutes)}
          </p>
        ) : null}
      </section>

      {row.punchState === 'blocked' ? (
        <p className="rounded-xl bg-leave-soft px-4 py-3 text-center text-sm font-semibold text-leave">
          今日狀態為「{row.status === 'leave' ? '請假' : '未到'}」，無法打卡。如需更正請聯絡領班。
        </p>
      ) : row.punchState === 'done' ? (
        <div className="flex items-center justify-center gap-2 rounded-xl bg-present-soft px-4 py-4 text-present">
          <CheckCircle2 size={22} />
          <span className="font-bold">今日打卡已完成</span>
        </div>
      ) : (
        <Button
          size="lg"
          fullWidth
          variant={row.punchState === 'idle' ? 'success' : 'primary'}
          loading={punch.isPending}
          icon={row.punchState === 'idle' ? <LogIn size={22} /> : <LogOut size={22} />}
          onClick={() => void runPunch(row.punchState === 'idle' ? 'in' : 'out')}
        >
          {row.punchState === 'idle' ? '上班打卡' : '下班打卡'}
        </Button>
      )}

      <p className="text-center text-xs text-ink-mute">
        打卡時間以系統時間（台北）為準，如需修改請聯絡領班或管理員。
      </p>
    </div>
  );
}
