import { UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toErrorMessage } from '@/lib/errors';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/Button';
import { EmptyState, ListSkeleton } from '@/components/Feedback';
import { useToast } from '@/components/toast';
import { useAssignCrew, useWorkers } from '@/features/workers/queries';

interface AddMemberSheetProps {
  open: boolean;
  crewId: string;
  onClose: () => void;
}

/** 從「尚未指派工班」的人員中挑選加入本班。 */
export function AddMemberSheet({ open, crewId, onClose }: AddMemberSheetProps) {
  const workersQuery = useWorkers({ crewId: null, active: true });
  const assign = useAssignCrew();
  const toast = useToast();

  const handleAdd = async (workerId: string, name: string) => {
    try {
      await assign.mutateAsync({ workerId, crewId });
      toast.success(`已把 ${name} 加入本班`);
    } catch (error) {
      toast.error(toErrorMessage(error));
    }
  };

  const candidates = workersQuery.data ?? [];

  return (
    <Sheet open={open} title="加入成員" onClose={onClose}>
      {workersQuery.isLoading ? (
        <ListSkeleton rows={3} />
      ) : candidates.length === 0 ? (
        <EmptyState
          icon={<UserPlus size={36} strokeWidth={1.5} />}
          title="沒有待指派的人員"
          description="所有在職人員都已經有工班了。要加入新師傅，請先到人員頁建立。"
          action={
            <Link
              to="/admin/workers"
              className="tap inline-flex items-center rounded-xl bg-brand px-4 font-semibold text-ink-invert"
            >
              前往人員管理
            </Link>
          }
        />
      ) : (
        <ul className="space-y-2">
          {candidates.map((worker) => (
            <li
              key={worker.id}
              className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-ink">{worker.name}</p>
                <p className="truncate text-xs text-ink-mute">
                  {worker.employeeNo ?? '無員工編號'}
                  {worker.phone ? ` · ${worker.phone}` : ''}
                </p>
              </div>
              <Button
                size="sm"
                loading={assign.isPending && assign.variables?.workerId === worker.id}
                onClick={() => void handleAdd(worker.id, worker.name)}
              >
                加入
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
