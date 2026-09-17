import { useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import type { Advance } from '@/types';
import { formatMoney, shiftPayMonth } from '@/lib/payroll';
import { toErrorMessage } from '@/lib/errors';
import { todayWorkDate } from '@/lib/date';
import { Button } from '@/components/Button';
import { Field, TextInput } from '@/components/Form';
import { useToast } from '@/components/toast';
import { useCreateAdvance, useRemoveAdvance, useUpdateAdvance } from './queries';

interface AdvanceSectionProps {
  workerId: string;
  workerName: string;
  month: string;
  items: { advance: Advance; deduction: number; outstanding: number }[];
}

function AdvanceForm({
  workerId,
  month,
  onDone,
}: {
  workerId: string;
  month: string;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [monthlyRepayment, setMonthlyRepayment] = useState('');
  const [startMonth, setStartMonth] = useState(shiftPayMonth(month, 1));
  const [borrowedOn, setBorrowedOn] = useState(todayWorkDate());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useCreateAdvance();
  const toast = useToast();

  const handleSubmit = async () => {
    setError(null);
    try {
      await create.mutateAsync({
        workerId,
        amount: Number(amount),
        monthlyRepayment: Number(monthlyRepayment),
        startMonth,
        borrowedOn: borrowedOn || undefined,
        note: note.trim() || undefined,
      });
      toast.success('已新增借支');
      onDone();
    } catch (mutationError) {
      setError(toErrorMessage(mutationError));
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-line bg-surface-sunken p-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="借支金額" required>
          {(id) => (
            <TextInput
              id={id}
              type="number"
              inputMode="numeric"
              className="tnum"
              min={1}
              step={1000}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="30000"
            />
          )}
        </Field>
        <Field label="每月還款" required>
          {(id) => (
            <TextInput
              id={id}
              type="number"
              inputMode="numeric"
              className="tnum"
              min={1}
              step={500}
              value={monthlyRepayment}
              onChange={(event) => setMonthlyRepayment(event.target.value)}
              placeholder="5000"
            />
          )}
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="起扣月份" required>
          {(id) => (
            <TextInput
              id={id}
              type="month"
              className="tnum"
              value={startMonth}
              onChange={(event) => setStartMonth(event.target.value)}
            />
          )}
        </Field>
        <Field label="借支日期">
          {(id) => (
            <TextInput
              id={id}
              type="date"
              className="tnum"
              value={borrowedOn}
              onChange={(event) => setBorrowedOn(event.target.value)}
            />
          )}
        </Field>
      </div>

      <Field label="事由">
        {(id) => (
          <TextInput
            id={id}
            value={note}
            maxLength={200}
            onChange={(event) => setNote(event.target.value)}
            placeholder="選填"
          />
        )}
      </Field>

      {error ? (
        <p role="alert" className="text-xs font-semibold text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button size="sm" variant="secondary" fullWidth onClick={onDone}>
          取消
        </Button>
        <Button size="sm" fullWidth loading={create.isPending} onClick={handleSubmit}>
          新增借支
        </Button>
      </div>
    </div>
  );
}

/** 借支：新增、提前結清、手動調整已還金額、刪除。 */
export function AdvanceSection({ workerId, workerName, month, items }: AdvanceSectionProps) {
  const [adding, setAdding] = useState(false);
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [adjustValue, setAdjustValue] = useState('');

  const update = useUpdateAdvance();
  const remove = useRemoveAdvance();
  const toast = useToast();

  const handleSettle = async (advance: Advance) => {
    try {
      await update.mutateAsync({ id: advance.id, input: { settledMonth: month } });
      toast.success(`${workerName} 的借支已於 ${month} 結清`);
    } catch (error) {
      toast.error(toErrorMessage(error));
    }
  };

  const handleAdjust = async (advance: Advance) => {
    try {
      await update.mutateAsync({
        id: advance.id,
        input: { repaidAdjustment: Number(adjustValue) || 0 },
      });
      toast.success('已更新對帳調整金額');
      setAdjusting(null);
    } catch (error) {
      toast.error(toErrorMessage(error));
    }
  };

  const handleRemove = async (advance: Advance) => {
    try {
      await remove.mutateAsync(advance.id);
      toast.success('已刪除借支紀錄');
    } catch (error) {
      toast.error(toErrorMessage(error));
    }
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold text-ink">借支</h3>
        {!adding ? (
          <Button size="sm" variant="secondary" icon={<Plus size={15} />} onClick={() => setAdding(true)}>
            新增
          </Button>
        ) : null}
      </div>

      {adding ? <AdvanceForm workerId={workerId} month={month} onDone={() => setAdding(false)} /> : null}

      {items.length === 0 && !adding ? (
        <p className="rounded-xl bg-surface-sunken px-3 py-2 text-sm text-ink-soft">
          目前沒有借支紀錄。
        </p>
      ) : null}

      <ul className="space-y-2">
        {items.map(({ advance, deduction, outstanding }) => {
          const cleared = outstanding === 0;
          return (
            <li key={advance.id} className="rounded-xl border border-line bg-surface p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="tnum text-sm font-bold text-ink">
                    借支 {formatMoney(advance.amount)}
                    <span className="ml-2 font-normal text-ink-soft">
                      每月還 {formatMoney(advance.monthlyRepayment)}
                    </span>
                  </p>
                  <p className="tnum mt-1 text-xs text-ink-soft">
                    {advance.startMonth} 起扣
                    {advance.borrowedOn ? `\u3000借支日 ${advance.borrowedOn}` : ''}
                    {advance.settledMonth ? `\u3000${advance.settledMonth} 結清` : ''}
                  </p>
                  {advance.note ? (
                    <p className="mt-0.5 text-xs text-ink-mute">事由：{advance.note}</p>
                  ) : null}
                  <p className="tnum mt-1.5 text-sm">
                    <span className="font-semibold text-ink">本月扣款 {formatMoney(deduction)}</span>
                    <span className={`ml-3 ${cleared ? 'text-present' : 'text-ink-soft'}`}>
                      {cleared ? '已還清' : `尚欠 ${formatMoney(outstanding)}`}
                    </span>
                  </p>
                  {advance.repaidAdjustment !== 0 ? (
                    <p className="tnum mt-0.5 text-xs text-leave">
                      對帳調整 {formatMoney(advance.repaidAdjustment)}
                    </p>
                  ) : null}
                </div>

                <button
                  type="button"
                  aria-label="刪除這筆借支"
                  onClick={() => void handleRemove(advance)}
                  className="tap flex items-center justify-center rounded-xl border border-line-strong text-ink-soft hover:bg-surface-sunken"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {adjusting === advance.id ? (
                <div className="mt-2 flex items-end gap-2">
                  <Field label="已還金額調整（可為負）">
                    {(id) => (
                      <TextInput
                        id={id}
                        type="number"
                        inputMode="numeric"
                        className="tnum"
                        value={adjustValue}
                        onChange={(event) => setAdjustValue(event.target.value)}
                      />
                    )}
                  </Field>
                  <Button size="sm" loading={update.isPending} onClick={() => void handleAdjust(advance)}>
                    儲存
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setAdjusting(null)}>
                    取消
                  </Button>
                </div>
              ) : (
                <div className="mt-2 flex gap-2">
                  {!cleared ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Check size={15} />}
                      loading={update.isPending && update.variables?.id === advance.id}
                      onClick={() => void handleSettle(advance)}
                    >
                      本月提前結清
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setAdjusting(advance.id);
                      setAdjustValue(String(advance.repaidAdjustment));
                    }}
                  >
                    對帳調整
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
