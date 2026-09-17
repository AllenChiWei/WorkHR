import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Crown, Pencil, Trash2, UserMinus, UserPlus } from 'lucide-react';
import { toErrorMessage } from '@/lib/errors';
import { Button } from '@/components/Button';
import { Chip } from '@/components/StatusChip';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/Feedback';
import { useToast } from '@/components/toast';
import { useAssignCrew, useWorkers } from '@/features/workers/queries';
import { AddMemberSheet } from './AddMemberSheet';
import { CrewFormSheet } from './CrewFormSheet';
import { useCrew, useRemoveCrew, useUpdateCrew } from './queries';

export function CrewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removingCrew, setRemovingCrew] = useState(false);
  const [removingMember, setRemovingMember] = useState<{ id: string; name: string } | null>(null);

  const crewQuery = useCrew(id);
  const membersQuery = useWorkers(id ? { crewId: id } : undefined);
  const updateCrew = useUpdateCrew();
  const removeCrew = useRemoveCrew();
  const assign = useAssignCrew();

  if (crewQuery.isLoading) return <ListSkeleton rows={4} />;
  if (crewQuery.isError) {
    return (
      <ErrorState message={toErrorMessage(crewQuery.error)} onRetry={() => void crewQuery.refetch()} />
    );
  }

  const crew = crewQuery.data;
  if (!crew || !id) {
    return <EmptyState title="找不到這個工班" description="它可能已經被刪除了。" />;
  }

  const members = membersQuery.data ?? [];

  const handleSetForeman = async (workerId: string, name: string) => {
    try {
      await updateCrew.mutateAsync({ id, input: { foremanId: workerId } });
      toast.success(`已指派 ${name} 為領班`);
    } catch (error) {
      toast.error(toErrorMessage(error));
    }
  };

  const handleRemoveMember = async () => {
    if (!removingMember) return;
    try {
      await assign.mutateAsync({ workerId: removingMember.id, crewId: null });
      toast.success(`已把 ${removingMember.name} 移出本班`);
      setRemovingMember(null);
    } catch (error) {
      toast.error(toErrorMessage(error));
    }
  };

  const handleRemoveCrew = async () => {
    try {
      await removeCrew.mutateAsync(id);
      toast.success('工班已刪除');
      navigate('/admin/crews', { replace: true });
    } catch (error) {
      toast.error(toErrorMessage(error));
      setRemovingCrew(false);
    }
  };

  return (
    <div className="space-y-4">
      <Link to="/admin/crews" className="tap inline-flex items-center gap-1 text-sm font-semibold text-brand">
        <ArrowLeft size={16} />
        返回工班列表
      </Link>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-ink">{crew.name}</h1>
              {!crew.active ? <Chip>已停用</Chip> : null}
            </div>
            {crew.siteName ? <p className="mt-1 text-sm text-ink-soft">{crew.siteName}</p> : null}
            {crew.note ? <p className="mt-1 text-sm text-ink-mute">{crew.note}</p> : null}
          </div>
          <Button size="sm" variant="secondary" icon={<Pencil size={16} />} onClick={() => setEditing(true)}>
            編輯
          </Button>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">成員（{members.length}）</h2>
          <Button size="sm" icon={<UserPlus size={16} />} onClick={() => setAdding(true)}>
            加入成員
          </Button>
        </div>

        {membersQuery.isLoading ? (
          <ListSkeleton rows={3} />
        ) : members.length === 0 ? (
          <EmptyState
            title="這個工班還沒有成員"
            description="加入成員後才能指派領班並開始打卡。"
            action={
              <Button icon={<UserPlus size={18} />} onClick={() => setAdding(true)}>
                加入成員
              </Button>
            }
          />
        ) : (
          <ul className="space-y-2">
            {members.map((worker) => {
              const isForeman = crew.foremanId === worker.id;
              return (
                <li
                  key={worker.id}
                  className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-bold text-ink">{worker.name}</span>
                      {isForeman ? <Chip tone="brand">領班</Chip> : null}
                      {!worker.active ? <Chip>已停用</Chip> : null}
                    </div>
                    <p className="truncate text-xs text-ink-mute">
                      {worker.employeeNo ?? '無員工編號'}
                      {worker.phone ? ` · ${worker.phone}` : ''}
                      {worker.canSelfCheckIn ? ' · 可自行打卡' : ''}
                    </p>
                  </div>

                  {!isForeman ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Crown size={15} />}
                      loading={updateCrew.isPending && updateCrew.variables?.input.foremanId === worker.id}
                      onClick={() => void handleSetForeman(worker.id, worker.name)}
                    >
                      設為領班
                    </Button>
                  ) : null}

                  <button
                    type="button"
                    aria-label={`把 ${worker.name} 移出工班`}
                    onClick={() => setRemovingMember({ id: worker.id, name: worker.name })}
                    className="tap flex items-center justify-center rounded-xl border border-line-strong text-ink-soft hover:bg-surface-sunken"
                  >
                    <UserMinus size={18} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-danger bg-danger-soft p-4">
        <h2 className="font-bold text-ink">刪除工班</h2>
        <p className="mt-1 text-sm text-ink-soft">
          僅在工班沒有任何成員時可以刪除。已經開工過的工班建議改為「停用」，以保留歷史紀錄。
        </p>
        <div className="mt-3">
          <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => setRemovingCrew(true)}>
            刪除這個工班
          </Button>
        </div>
      </section>

      {editing ? <CrewFormSheet crew={crew} onClose={() => setEditing(false)} /> : null}
      <AddMemberSheet open={adding} crewId={id} onClose={() => setAdding(false)} />

      <ConfirmDialog
        open={removingMember !== null}
        title="移出工班"
        message={`確定要把 ${removingMember?.name ?? ''} 移出本班嗎？歷史打卡紀錄會保留。`}
        confirmLabel="移出"
        tone="danger"
        loading={assign.isPending}
        onConfirm={() => void handleRemoveMember()}
        onCancel={() => setRemovingMember(null)}
      />

      <ConfirmDialog
        open={removingCrew}
        title="刪除工班"
        message={`確定要刪除「${crew.name}」嗎？這個動作無法復原。`}
        confirmLabel="刪除"
        tone="danger"
        loading={removeCrew.isPending}
        onConfirm={() => void handleRemoveCrew()}
        onCancel={() => setRemovingCrew(false)}
      />
    </div>
  );
}
