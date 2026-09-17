import { useState } from 'react';
import type { AttendanceStatus, LeaveType } from '@/types';
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
  /**
   * 是否顯示並允許編輯實際打卡時間。只有管理員為 true；
   * 領班看不到時間點，也不能改時間，只能改狀態、假別與備註。
   */
  showTimes: boolean;
  onClose: () => void;
}

const STATUS_OPTIONS: AttendanceStatus[] = ['present', 'leave', 'absent'];

/**
 * 假別影響薪資與特休餘額：
 * 特休照給全薪、病假半薪、事假不給薪（勞工請假規則）。
 */
const LEAVE_TYPE_OPTIONS: { value: LeaveType; label: string; hint: string }[] = [
  { value: 'annual', label: '特休', hint: '全薪，扣特休餘額' },
  { value: 'personal', label: '事假', hint: '不給薪' },
  { value: 'sick', label: '病假', hint: '半薪' },
  { value: 'other', label: '其他', hint: '不給薪' },
];

/** 只取 HH:mm；沒有時間時回傳空字串讓 input 呈現未填。 */
function toTimeInput(iso: string | null): string {
  return iso ? formatClock(iso) : '';
}

/** 由呼叫端條件渲染，每次開啟都是新的實例，初始值直接取自傳入的那一列。 */
export function EditPunchSheet({
  row,
  crewId,
  workDate,
  readOnly,
  showTimes,
  onClose,
}: EditPunchSheetProps) {
  const [status, setStatus] = useState<AttendanceStatus>(row.status);
  const [checkIn, setCheckIn] = useState(toTimeInput(row.checkInAt));
  const [checkOut, setCheckOut] = useState(toTimeInput(row.checkOutAt));
  const [leaveType, setLeaveType] = useState<LeaveType>(row.record?.leaveType ?? 'personal');
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

    if (showTimes && status === 'present') {
      const invalid = validatePunchTimes(checkInAt, checkOutAt);
      if (invalid) {
        setError(invalid);
        return;
      }
    }

    /**
     * 沒有時間編輯權限時完全不送時間欄位，避免把畫面上看不到的值覆寫掉。
     * 改成請假／未到時仍要清空時間，這由服務層依 status 處理。
     */
    const timeFields = showTimes
      ? {
          checkInAt: status === 'present' ? checkInAt : null,
          checkOutAt: status === 'present' ? checkOutAt : null,
        }
      : {};

    try {
      await upsert.mutateAsync({
        workerId: row.worker.id,
        crewId,
        workDate,
        status,
        leaveType: status === 'leave' ? leaveType : undefined,
        ...timeFields,
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

        {status === 'present' && !showTimes ? (
          <div className="rounded-xl bg-surface-sunken px-3 py-2 text-sm text-ink-soft">
            <p className="font-semibold text-ink">
              {row.checkInAt ? '上班已打卡' : '上班未打卡'}
              <span className="ml-3">{row.checkOutAt ? '下班已打卡' : '下班未打卡'}</span>
            </p>
            <p className="mt-1 text-xs">
              實際打卡時間僅管理員可檢視與修改。如需更正時間，請聯絡管理員。
            </p>
          </div>
        ) : status === 'present' ? (
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
        ) : status === 'leave' ? (
          <Field label="假別" hint="影響薪資計算與特休餘額">
            {(id) => (
              <div id={id} className="grid grid-cols-2 gap-2">
                {LEAVE_TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    disabled={readOnly}
                    onClick={() => setLeaveType(option.value)}
                    className={`tap flex flex-col items-start justify-center rounded-xl border-2 px-3 py-2 text-left transition-colors disabled:opacity-50 ${
                      leaveType === option.value
                        ? 'border-brand bg-brand-soft'
                        : 'border-line bg-surface'
                    }`}
                  >
                    <span
                      className={`text-sm font-bold ${leaveType === option.value ? 'text-brand' : 'text-ink'}`}
                    >
                      {option.label}
                    </span>
                    <span className="text-xs text-ink-soft">{option.hint}</span>
                  </button>
                ))}
              </div>
            )}
          </Field>
        ) : (
          <p className="rounded-xl bg-surface-sunken px-3 py-2 text-sm text-ink-soft">
            狀態為「未到」時不記錄上下班時間，且不計薪。
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
