import { useMemo, useState } from 'react';
import { Pencil, Plus, Users } from 'lucide-react';
import type { Worker } from '@/types';
import { toErrorMessage } from '@/lib/errors';
import { Button } from '@/components/Button';
import { Chip } from '@/components/StatusChip';
import { Select } from '@/components/Form';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/Feedback';
import { useCrews } from '@/features/crews/queries';
import { WorkerFormSheet } from './WorkerFormSheet';
import { useWorkers } from './queries';

type CrewFilter = 'all' | 'none' | string;
type ActiveFilter = 'all' | 'active' | 'inactive';

export function WorkersPage() {
  const [crewFilter, setCrewFilter] = useState<CrewFilter>('all');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('active');
  const [editing, setEditing] = useState<Worker | null>(null);
  const [creating, setCreating] = useState(false);

  const crewsQuery = useCrews();
  const workersQuery = useWorkers();

  const crewNameById = useMemo(
    () => new Map((crewsQuery.data ?? []).map((crew) => [crew.id, crew.name])),
    [crewsQuery.data],
  );

  const visible = useMemo(() => {
    return (workersQuery.data ?? []).filter((worker) => {
      if (crewFilter === 'none' && worker.crewId !== null) return false;
      if (crewFilter !== 'all' && crewFilter !== 'none' && worker.crewId !== crewFilter) return false;
      if (activeFilter === 'active' && !worker.active) return false;
      if (activeFilter === 'inactive' && worker.active) return false;
      return true;
    });
  }, [workersQuery.data, crewFilter, activeFilter]);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink">人員</h1>
        <Button icon={<Plus size={18} />} onClick={() => setCreating(true)}>
          新增人員
        </Button>
      </header>

      <div className="flex gap-2">
        <Select
          aria-label="依工班篩選"
          value={crewFilter}
          onChange={(event) => setCrewFilter(event.target.value)}
        >
          <option value="all">全部工班</option>
          <option value="none">未指派</option>
          {(crewsQuery.data ?? []).map((crew) => (
            <option key={crew.id} value={crew.id}>
              {crew.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="依狀態篩選"
          value={activeFilter}
          onChange={(event) => setActiveFilter(event.target.value as ActiveFilter)}
        >
          <option value="active">在職</option>
          <option value="inactive">已停用</option>
          <option value="all">全部狀態</option>
        </Select>
      </div>

      {workersQuery.isLoading ? (
        <ListSkeleton rows={5} />
      ) : workersQuery.isError ? (
        <ErrorState
          message={toErrorMessage(workersQuery.error)}
          onRetry={() => void workersQuery.refetch()}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Users size={36} strokeWidth={1.5} />}
          title={
            (workersQuery.data ?? []).length === 0 ? '尚未建立任何人員' : '沒有符合條件的人員'
          }
          description={
            (workersQuery.data ?? []).length === 0
              ? '先建立師傅與領班，再把他們指派到工班。'
              : '調整上方的篩選條件試試看。'
          }
          action={
            <Button icon={<Plus size={18} />} onClick={() => setCreating(true)}>
              新增人員
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {visible.map((worker) => (
            <li
              key={worker.id}
              className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-base font-bold text-ink">{worker.name}</span>
                  {worker.role === 'foreman' ? <Chip tone="brand">領班</Chip> : null}
                  {!worker.active ? <Chip>已停用</Chip> : null}
                  {worker.canSelfCheckIn ? <Chip tone="brand">可自行打卡</Chip> : null}
                </div>
                <p className="mt-0.5 truncate text-xs text-ink-soft">
                  {worker.crewId ? (crewNameById.get(worker.crewId) ?? '未知工班') : '未指派工班'}
                  {worker.employeeNo ? ` · ${worker.employeeNo}` : ''}
                  {worker.phone ? ` · ${worker.phone}` : ''}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                icon={<Pencil size={15} />}
                onClick={() => setEditing(worker)}
              >
                編輯
              </Button>
            </li>
          ))}
        </ul>
      )}

      {creating ? <WorkerFormSheet onClose={() => setCreating(false)} /> : null}
      {editing ? <WorkerFormSheet worker={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}
