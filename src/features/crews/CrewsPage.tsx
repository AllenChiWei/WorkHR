import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, HardHat, Plus, Users } from 'lucide-react';
import { toErrorMessage } from '@/lib/errors';
import { Button } from '@/components/Button';
import { Chip } from '@/components/StatusChip';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/Feedback';
import { useWorkers } from '@/features/workers/queries';
import { CrewFormSheet } from './CrewFormSheet';
import { useCrews } from './queries';

export function CrewsPage() {
  const [creating, setCreating] = useState(false);
  const crewsQuery = useCrews();
  const workersQuery = useWorkers();

  const memberCount = (crewId: string) =>
    (workersQuery.data ?? []).filter((worker) => worker.crewId === crewId && worker.active).length;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink">工班</h1>
        <Button icon={<Plus size={18} />} onClick={() => setCreating(true)}>
          新增工班
        </Button>
      </header>

      {crewsQuery.isLoading ? (
        <ListSkeleton rows={3} />
      ) : crewsQuery.isError ? (
        <ErrorState message={toErrorMessage(crewsQuery.error)} onRetry={() => void crewsQuery.refetch()} />
      ) : (crewsQuery.data ?? []).length === 0 ? (
        <EmptyState
          icon={<HardHat size={36} strokeWidth={1.5} />}
          title="尚未建立任何工班"
          description="先建立一個工班，接著就能把領班與師傅指派進去，開始每日打卡。"
          action={
            <Button icon={<Plus size={18} />} onClick={() => setCreating(true)}>
              建立第一個工班
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {(crewsQuery.data ?? []).map((crew) => {
            const count = memberCount(crew.id);
            return (
              <li key={crew.id}>
                <Link
                  to={`/admin/crews/${crew.id}`}
                  className="tap flex items-center gap-3 rounded-xl border border-line bg-surface p-4 hover:bg-surface-sunken"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-lg font-bold text-ink">{crew.name}</span>
                      {!crew.active ? <Chip>已停用</Chip> : null}
                      {!crew.foremanId ? <Chip tone="warn">未指派領班</Chip> : null}
                    </div>
                    {crew.siteName ? (
                      <p className="mt-0.5 truncate text-sm text-ink-soft">{crew.siteName}</p>
                    ) : null}
                    <p className="mt-1 flex items-center gap-1 text-xs text-ink-mute">
                      <Users size={13} />
                      {count} 名在職成員
                    </p>
                  </div>
                  <ChevronRight size={20} className="shrink-0 text-ink-mute" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {creating ? <CrewFormSheet onClose={() => setCreating(false)} /> : null}
    </div>
  );
}
