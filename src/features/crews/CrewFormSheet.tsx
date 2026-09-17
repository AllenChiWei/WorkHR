import { useState } from 'react';
import type { Crew } from '@/types';
import { crewCreateInputSchema } from '@/schemas/crew';
import { toErrorMessage } from '@/lib/errors';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/Button';
import { Field, TextArea, TextInput, Toggle } from '@/components/Form';
import { useToast } from '@/components/toast';
import { useCreateCrew, useUpdateCrew } from './queries';

interface CrewFormSheetProps {
  /** 傳入代表編輯，未傳代表新增。 */
  crew?: Crew | null;
  onClose: () => void;
}

/** 由呼叫端條件渲染，因此初始值直接取自 props，不需要 effect 重設。 */
export function CrewFormSheet({ crew, onClose }: CrewFormSheetProps) {
  const [name, setName] = useState(crew?.name ?? '');
  const [siteName, setSiteName] = useState(crew?.siteName ?? '');
  const [note, setNote] = useState(crew?.note ?? '');
  const [active, setActive] = useState(crew?.active ?? true);
  const [error, setError] = useState<string | null>(null);

  const create = useCreateCrew();
  const update = useUpdateCrew();
  const toast = useToast();
  const isEdit = Boolean(crew);

  const handleSubmit = async () => {
    setError(null);
    const payload = {
      name: name.trim(),
      siteName: siteName.trim() || undefined,
      note: note.trim() || undefined,
      active,
    };

    const parsed = crewCreateInputSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? '資料不正確');
      return;
    }

    try {
      if (crew) {
        await update.mutateAsync({ id: crew.id, input: payload });
        toast.success('工班已更新');
      } else {
        await create.mutateAsync(payload);
        toast.success('工班已建立');
      }
      onClose();
    } catch (mutationError) {
      setError(toErrorMessage(mutationError));
    }
  };

  return (
    <Sheet
      open
      title={isEdit ? '編輯工班' : '新增工班'}
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={onClose}>
            取消
          </Button>
          <Button fullWidth onClick={handleSubmit} loading={create.isPending || update.isPending}>
            {isEdit ? '儲存' : '建立'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="工班名稱" required>
          {(id) => (
            <TextInput
              id={id}
              value={name}
              maxLength={40}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如 A 班（水電）"
            />
          )}
        </Field>

        <Field label="工地名稱">
          {(id) => (
            <TextInput
              id={id}
              value={siteName}
              maxLength={60}
              onChange={(event) => setSiteName(event.target.value)}
              placeholder="選填"
            />
          )}
        </Field>

        <Field label="備註">
          {(id) => (
            <TextArea
              id={id}
              value={note}
              maxLength={200}
              onChange={(event) => setNote(event.target.value)}
              placeholder="選填，例如進場時間"
            />
          )}
        </Field>

        <Toggle
          checked={active}
          onChange={setActive}
          label="啟用中"
          description="停用後仍保留歷史紀錄，但不會出現在打卡清單。"
        />

        {isEdit ? (
          <p className="rounded-xl bg-surface-sunken px-3 py-2 text-xs text-ink-soft">
            指派領班請到工班詳情頁的成員清單操作。
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-semibold text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}
