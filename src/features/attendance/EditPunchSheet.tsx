import { useState } from 'react';
import type { AttendanceStatus } from '@/types';
import type { RosterRow } from '@/lib/attendance';
import { STATUS_LABEL, validatePunchTimes } from '@/lib/attendance';
import { formatClock, workDateTimeToIso } from '@/lib/date';
import { toErrorMessage } from '@/lib/errors';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/Button';
import { Field, TextArea, TextInput } from '@/components/Form';
import { useToast } from '@/components/toast';
import { useUpsertAttendance } from './queries';

interface EditPunchSheetProps {
  row: RosterRow;
  crewId: string;
  workDate: string;
  readOnly: boolean;
  onClose: () => void;
}

const STATUS_OPTIONS: AttendanceStatus[] = ['present', 'leave', 'absent'];

/** 只取 HH:mm；沒有時間時回傳空字串讓 input 呈現未填。 */
function toTimeInput(iso: string | null): string {
  return iso ? formatClock(iso) : '';
}

/** 由呼叫端條件渲染，每次開啟都是新的實例，初始值直接取自傳入的那一列。 */
export function EditPunchSheet({ row, crewId, workDate, readOnly, onClose }: EditPunchSheetProps) {
  const [status, setStatus] = useState<AttendanceStatus>(row.status);
  const [checkIn, setCheckIn] = useState(toTimeInput(row.checkInAt));
  const [checkOut, setCheckOut] = useState(toTimeInput(row.checkOutAt));
  const [note, setNote] = useState(row.note ?? '');
  const [error, setError] = useState<string | null>(null);

  const upsert = useUpsertAttendance();
  const toast = useToast();

  const handleSubmit = async () => {
    setError(null);

    let checkInAt: string | null = null;
    let checkOutAt: string | null = null;
    try {
      // 班別只有早班，上下班一律視為同一天，不提供跨夜選項
      checkInAt = checkIn ? workDateTimeToIso(workDate, checkIn) : null;
      checkOutAt = checkOut ? workDateTimeToIso(workDate, checkOut) : null;
    } catch {
      setError('時間格式不正確');
      return;
    }

    if (status === 'present') {
      const invalid = validatePunchTimes(checkInAt, checkOutAt);
      if (invalid) {
        setError(invalid);
        return;
      }
    }

    try {
      await upsert.mutateAsync({
        workerId: row.worker.id,
        crewId,
        workDate,
        status,
        checkInAt: status === 'present' ? checkInAt : null,
        checkOutAt: status === 'present' ? checkOutAt : null,
        note: note.trim(),
      });
      toast.success(`已更新 ${row.worker.name} 的紀錄`);
      onClose();
    } catch (mutationError) {
      setError(toErrorMessage(mutationError));
    }
  };

  return (
    <Sheet
      open
      title={row.worker.name}
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={onClose}>
            取消
          </Button>
          <Button fullWidth onClick={handleSubmit} loading={upsert.isPending} disabled={readOnly}>
            儲存
          </Button>
        </div>
      }
    >
      {readOnly ? (
        <p className="mb-4 rounded-xl bg-leave-soft px-3 py-2 text-sm font-semibold text-leave">
          僅管理員可修改非當日的打卡紀錄
        </p>
      ) : null}

      <div className="space-y-4">
        <Field label="狀態">
          {(id) => (
            <div id={id} className="grid grid-cols-3 gap-2">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={readOnly}
                  onClick={() => setStatus(option)}
                  className={`tap rounded-xl border-2 text-sm font-bold transition-colors disabled:opacity-50 ${
                    status === option
                      ? 'border-brand bg-brand-soft text-brand'
                      : 'border-line bg-surface text-ink-soft'
                  }`}
                >
                  {STATUS_LABEL[option]}
                </button>
              ))}
            </div>
          )}
        </Field>

        {status === 'present' ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="上班時間">
              {(id) => (
                <TextInput
                  id={id}
                  type="time"
                  className="tnum"
                  value={checkIn}
                  disabled={readOnly}
                  onChange={(event) => setCheckIn(event.target.value)}
                />
              )}
            </Field>
            <Field label="下班時間">
              {(id) => (
                <TextInput
                  id={id}
                  type="time"
                  className="tnum"
                  value={checkOut}
                  disabled={readOnly}
                  onChange={(event) => setCheckOut(event.target.value)}
                />
              )}
            </Field>
          </div>
        ) : (
          <p className="rounded-xl bg-surface-sunken px-3 py-2 text-sm text-ink-soft">
            狀態為「{STATUS_LABEL[status]}」時不記錄上下班時間。
          </p>
        )}

        <Field label="備註" hint="例如請假原因、補登說明">
          {(id) => (
            <TextArea
              id={id}
              value={note}
              disabled={readOnly}
              maxLength={200}
              onChange={(event) => setNote(event.target.value)}
              placeholder="選填"
            />
          )}
        </Field>

        {error ? (
          <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-semibold text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}
