import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ExtraPay } from '@/types';
import { formatMoney } from '@/lib/payroll';
import { toErrorMessage } from '@/lib/errors';
import { Button } from '@/components/Button';
import { Field, TextInput } from '@/components/Form';
import { useToast } from '@/components/toast';
import { useCreateExtraPay, useRemoveExtraPay } from './queries';

interface ExtraPaySectionProps {
  workerId: string;
  month: string;
  items: ExtraPay[];
}

/** 額外派遣加給：當月臨時工作另外給的薪資，逐筆列管。 */
export function ExtraPaySection({ workerId, month, items }: ExtraPaySectionProps) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [workDate, setWorkDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useCreateExtraPay();
  const remove = useRemoveExtraPay();
  const toast = useToast();

  const total = items.reduce((sum, item) => sum + item.amount, 0);

  const handleSubmit = async () => {
    setError(null);
    try {
      await create.mutateAsync({
        workerId,
        month,
        label: label.trim(),
        amount: Number(amount),
        workDate: workDate || undefined,
      });
      toast.success('已新增額外加給');
      setLabel('');
      setAmount('');
      setWorkDate('');
      setAdding(false);
    } catch (mutationError) {
      setError(toErrorMessage(mutationError));
    }
  };

  const handleRemove = async (entry: ExtraPay) => {
    try {
      await remove.mutateAsync(entry.id);
      toast.success('已刪除額外加給');
    } catch (mutationError) {
      toast.error(toErrorMessage(mutationError));
    }
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold text-ink">
          額外派遣加給
          {total > 0 ? (
            <span className="tnum ml-2 text-sm font-semibold text-present">
              合計 {formatMoney(total)}
            </span>
          ) : null}
        </h3>
        {!adding ? (
          <Button size="sm" variant="secondary" icon={<Plus size={15} />} onClick={() => setAdding(true)}>
            新增
          </Button>
        ) : null}
      </div>

      {adding ? (
        <div className="space-y-3 rounded-xl border border-line bg-surface-sunken p-3">
          <Field label="項目說明" required>
            {(id) => (
              <TextInput
                id={id}
                value={label}
                maxLength={40}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="例如 假日吊車支援"
              />
            )}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="金額" required>
              {(id) => (
                <TextInput
                  id={id}
                  type="number"
                  inputMode="numeric"
                  className="tnum"
                  min={1}
                  step={100}
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="2000"
                />
              )}
            </Field>
            <Field label="發生日期" hint="選填">
              {(id) => (
                <TextInput
                  id={id}
                  type="date"
                  className="tnum"
                  value={workDate}
                  onChange={(event) => setWorkDate(event.target.value)}
                />
              )}
            </Field>
          </div>

          {error ? (
            <p role="alert" className="text-xs font-semibold text-danger">
              {error}
            </p>
          ) : null}

          <div className="flex gap-2">
            <Button size="sm" variant="secondary" fullWidth onClick={() => setAdding(false)}>
              取消
            </Button>
            <Button size="sm" fullWidth loading={create.isPending} onClick={handleSubmit}>
              新增
            </Button>
          </div>
        </div>
      ) : null}

      {items.length === 0 && !adding ? (
        <p className="rounded-xl bg-surface-sunken px-3 py-2 text-sm text-ink-soft">
          這個月沒有額外加給。
        </p>
      ) : null}

      <ul className="space-y-2">
        {items.map((entry) => (
          <li
            key={entry.id}
            className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-ink">{entry.label}</p>
              <p className="tnum text-xs text-ink-soft">
                {formatMoney(entry.amount)}
                {entry.workDate ? `\u3000${entry.workDate}` : ''}
              </p>
            </div>
            <button
              type="button"
              aria-label={`刪除 ${entry.label}`}
              onClick={() => void handleRemove(entry)}
              className="tap flex items-center justify-center rounded-xl border border-line-strong text-ink-soft hover:bg-surface-sunken"
            >
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
