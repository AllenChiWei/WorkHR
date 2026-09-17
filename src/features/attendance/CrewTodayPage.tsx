import { useState } from 'react';
import { LogIn, LogOut, UserX } from 'lucide-react';
import type { RosterRow } from '@/lib/attendance';
import { selectBatchTargets } from '@/lib/attendance';
import { todayWorkDate } from '@/lib/date';
import { isAppError, toErrorMessage } from '@/lib/errors';
import { can } from '@/lib/permissions';
import { useAuthStore } from '@/features/auth/authStore';
import { useCrew } from '@/features/crews/queries';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/Feedback';
import { useToast } from '@/components/toast';
import { DateSwitcher } from './DateSwitcher';
import { EditPunchSheet } from './EditPunchSheet';
import { RosterRowItem } from './RosterRowItem';
import { RosterSummaryBar } from './RosterSummary';
import { useBatchPunch, usePunch } from './queries';
import { useRoster } from './useRoster';

type PunchKind = 'in' | 'out';

interface PendingConfirm {
  row: RosterRow;
  kind: PunchKind;
  message: string;
}

export function CrewTodayPage() {
  const user = useAuthStore((state) => state.user);
  const crewId = user?.crewId ?? undefined;

  const [workDate, setWorkDate] = useState(todayWorkDate());
  const [detailRow, setDetailRow] = useState<RosterRow | null>(null);
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const [batchConfirm, setBatchConfirm] = useState<PunchKind | null>(null);

  const crewQuery = useCrew(crewId);
  const { rows, summary, isLoading, isError, error, refetch, isPast } = useRoster(crewId, workDate);
  const punch = usePunch();
  const batchPunch = useBatchPunch();
  const toast = useToast();

  const readOnly = isPast;
  // 實際打卡時間點只有管理員看得到；領班只知道有沒有打卡
  const showTimes = can(user, 'attendance:viewPunchTime', { crewId });

  const runPunch = async (row: RosterRow, kind: PunchKind, overwrite = false) => {
    if (!crewId) return;
    try {
      await punch.mutateAsync({
        workerId: row.worker.id,
        crewId,
        workDate,
        kind,
        overwrite,
      });
      toast.success(`${row.worker.name} ${kind === 'in' ? '上班' : '下班'}打卡完成`);
    } catch (mutationError) {
      // 重複打卡：先問過使用者再覆蓋
      if (isAppError(mutationError) && mutationError.code === 'CONFLICT' && !overwrite) {
        setConfirm({ row, kind, message: mutationError.message });
        return;
      }
      toast.error(toErrorMessage(mutationError), {
        label: '重試',
        onClick: () => void runPunch(row, kind, overwrite),
      });
    }
  };

  const runBatch = async (kind: PunchKind) => {
    if (!crewId) return;
    const targets = selectBatchTargets(rows, kind);
    if (targets.length === 0) {
      toast.show({ message: kind === 'in' ? '沒有待上班打卡的人' : '沒有待下班打卡的人' });
      return;
    }
    try {
      const result = await batchPunch.mutateAsync({
        crewId,
        workDate,
        kind,
        workerIds: targets.map((target) => target.worker.id),
      });
      toast.success(`已為 ${result.length} 人完成${kind === 'in' ? '上班' : '下班'}打卡`);
    } catch (mutationError) {
      toast.error(toErrorMessage(mutationError), {
        label: '重試',
        onClick: () => void runBatch(kind),
      });
    }
  };

  if (!crewId) {
    return (
      <EmptyState
        icon={<UserX size={36} strokeWidth={1.5} />}
        title="你尚未被指派到任何工班"
        description="請聯絡管理員把你加入工班後，才能使用打卡功能。"
      />
    );
  }

  const batchTargets = batchConfirm ? selectBatchTargets(rows, batchConfirm) : [];

  return (
    <div className="pb-36">
      <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <DateSwitcher workDate={workDate} onChange={setWorkDate} />
        <p className="text-sm font-semibold text-ink">
          {crewQuery.data?.name ?? '本班'}
          {crewQuery.data?.siteName ? (
            <span className="ml-2 font-normal text-ink-soft">{crewQuery.data.siteName}</span>
          ) : null}
        </p>
        <RosterSummaryBar summary={summary} />
        {readOnly ? (
          <p className="rounded-xl bg-leave-soft px-3 py-2 text-sm font-semibold text-leave">
            這是過去的日期，僅管理員可修改
          </p>
        ) : null}
      </section>

      <section className="mt-4">
        {isLoading ? (
          <ListSkeleton rows={5} />
        ) : isError ? (
          <ErrorState message={toErrorMessage(error)} onRetry={refetch} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="這個工班還沒有成員"
            description="請聯絡管理員把師傅加入工班，加入後就會出現在這份清單裡。"
          />
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <RosterRowItem
                key={row.worker.id}
                row={row}
                readOnly={readOnly}
                showTimes={showTimes}
                pending={punch.isPending && punch.variables?.workerId === row.worker.id}
                onPunch={(target, kind) => void runPunch(target, kind)}
                onOpenDetail={setDetailRow}
              />
            ))}
          </ul>
        )}
      </section>

      {/* 主要操作固定在螢幕下半部，單手拇指可及 */}
      {!readOnly && rows.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface px-4 pt-3 pb-safe">
          <div className="mx-auto flex max-w-5xl gap-3">
            <Button
              size="lg"
              variant="success"
              fullWidth
              icon={<LogIn size={20} />}
              loading={batchPunch.isPending && batchPunch.variables?.kind === 'in'}
              onClick={() => setBatchConfirm('in')}
            >
              全班上班
            </Button>
            <Button
              size="lg"
              fullWidth
              icon={<LogOut size={20} />}
              loading={batchPunch.isPending && batchPunch.variables?.kind === 'out'}
              onClick={() => setBatchConfirm('out')}
            >
              全班下班
            </Button>
          </div>
        </div>
      ) : null}

      {detailRow ? (
        <EditPunchSheet
          row={detailRow}
          crewId={crewId}
          workDate={workDate}
          readOnly={readOnly}
          showTimes={showTimes}
          onClose={() => setDetailRow(null)}
        />
      ) : null}

      <ConfirmDialog
        open={confirm !== null}
        title="重複打卡"
        message={confirm ? `${confirm.row.worker.name} ${confirm.message}` : ''}
        confirmLabel="覆蓋"
        tone="danger"
        loading={punch.isPending}
        onConfirm={() => {
          if (!confirm) return;
          const pending = confirm;
          setConfirm(null);
          void runPunch(pending.row, pending.kind, true);
        }}
        onCancel={() => setConfirm(null)}
      />

      <ConfirmDialog
        open={batchConfirm !== null}
        title={batchConfirm === 'in' ? '全班上班打卡' : '全班下班打卡'}
        message={
          batchTargets.length === 0
            ? batchConfirm === 'in'
              ? '目前沒有待上班打卡的人。'
              : '目前沒有待下班打卡的人。'
            : `將為 ${batchTargets.length} 人打卡：${batchTargets.map((target) => target.worker.name).join('、')}。已打卡與請假、未到的人不會被更動。`
        }
        confirmLabel="確定打卡"
        loading={batchPunch.isPending}
        onConfirm={() => {
          const kind = batchConfirm;
          setBatchConfirm(null);
          if (kind) void runBatch(kind);
        }}
        onCancel={() => setBatchConfirm(null)}
      />
    </div>
  );
}
