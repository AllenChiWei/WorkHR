import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { annualLeaveEntitlement, formatServiceLength, DAILY_WAGE_FLOOR } from '@/lib/labor';
import { formatMoney } from '@/lib/payroll';
import { todayWorkDate } from '@/lib/date';
import type { Worker, WorkerRole } from '@/types';
import { workerCreateInputSchema } from '@/schemas/worker';
import { toErrorMessage } from '@/lib/errors';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/Button';
import { Field, Select, TextInput, Toggle } from '@/components/Form';
import { useToast } from '@/components/toast';
import { useCrews } from '@/features/crews/queries';
import { useCreateWorker, useResetPassword, useUpdateWorker } from './queries';

/** 依到職日即時顯示年資與本年度特休，讓管理員在建檔時就看得到（勞基法 §38）。 */
function LeavePreview({ hireDate }: { hireDate: string }) {
  const asOf = todayWorkDate();
  if (hireDate > asOf) {
    return (
      <p className="rounded-xl bg-leave-soft px-3 py-2 text-xs font-semibold text-leave">
        到職日不能晚於今天。
      </p>
    );
  }

  const leave = annualLeaveEntitlement(hireDate, asOf);
  return (
    <div className="rounded-xl bg-surface-sunken px-3 py-2 text-xs text-ink-soft">
      <p>
        年資 <span className="font-bold text-ink">{formatServiceLength(hireDate, asOf)}</span>
        {'\u3000'}本年度特休{' '}
        <span className="font-bold text-ink">{leave.entitledDays} 天</span>
      </p>
      <p className="mt-0.5">
        {leave.notYetEligible
          ? leave.basis
          : `特休年度 ${leave.from} ～ ${leave.to}（${leave.basis}）`}
      </p>
    </div>
  );
}

interface WorkerFormSheetProps {
  worker?: Worker | null;
  /** 從工班詳情開啟時預設工班。 */
  defaultCrewId?: string | null;
  onClose: () => void;
}

/**
 * 呼叫端以條件渲染開關這張表單（例如 {editing && <WorkerFormSheet worker={editing} … />}），
 * 每次開啟都是全新的元件實例，因此初始值直接由 props 帶入，不需要用 effect 重設狀態。
 */
export function WorkerFormSheet({ worker, defaultCrewId, onClose }: WorkerFormSheetProps) {
  const [name, setName] = useState(worker?.name ?? '');
  const [crewId, setCrewId] = useState<string>(worker?.crewId ?? defaultCrewId ?? '');
  const [role, setRole] = useState<WorkerRole>(worker?.role ?? 'worker');
  const [phone, setPhone] = useState(worker?.phone ?? '');
  const [employeeNo, setEmployeeNo] = useState(worker?.employeeNo ?? '');
  const [hireDate, setHireDate] = useState(worker?.hireDate ?? '');
  const [dailyWage, setDailyWage] = useState(
    worker?.dailyWage === undefined ? '' : String(worker.dailyWage),
  );
  const [hasAccount, setHasAccount] = useState(worker?.hasAccount ?? false);
  const [canSelfCheckIn, setCanSelfCheckIn] = useState(worker?.canSelfCheckIn ?? false);
  const [active, setActive] = useState(worker?.active ?? true);
  const [error, setError] = useState<string | null>(null);

  const crewsQuery = useCrews();
  const create = useCreateWorker();
  const update = useUpdateWorker();
  const resetPassword = useResetPassword();
  const toast = useToast();
  const isEdit = Boolean(worker);

  /** 關掉帳號時一併關掉自行打卡，避免出現無法登入卻可打卡的矛盾設定。 */
  const handleAccountToggle = (checked: boolean) => {
    setHasAccount(checked);
    if (!checked) setCanSelfCheckIn(false);
  };

  const handleSubmit = async () => {
    setError(null);
    const payload = {
      name: name.trim(),
      crewId: crewId || null,
      role,
      phone: phone.trim() || undefined,
      employeeNo: employeeNo.trim() || undefined,
      hireDate: hireDate || undefined,
      dailyWage: dailyWage.trim() === '' ? undefined : Number(dailyWage),
      hasAccount,
      canSelfCheckIn,
      active,
    };

    const parsed = workerCreateInputSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? '資料不正確');
      return;
    }

    try {
      if (worker) {
        await update.mutateAsync({ id: worker.id, input: payload });
        toast.success('人員已更新');
      } else {
        await create.mutateAsync(payload);
        toast.success('人員已建立');
      }
      onClose();
    } catch (mutationError) {
      setError(toErrorMessage(mutationError));
    }
  };

  const handleResetPassword = async () => {
    if (!worker) return;
    try {
      const result = await resetPassword.mutateAsync(worker.id);
      toast.success(`已重設 ${worker.name} 的密碼為 ${result.password}`);
    } catch (mutationError) {
      toast.error(toErrorMessage(mutationError));
    }
  };

  return (
    <Sheet
      open
      title={isEdit ? '編輯人員' : '新增人員'}
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
        <Field label="姓名" required>
          {(id) => (
            <TextInput
              id={id}
              value={name}
              maxLength={20}
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </Field>

        <Field label="所屬工班" hint="可先留空，之後再從工班頁指派">
          {(id) => (
            <Select id={id} value={crewId} onChange={(event) => setCrewId(event.target.value)}>
              <option value="">（未指派）</option>
              {(crewsQuery.data ?? []).map((crew) => (
                <option key={crew.id} value={crew.id}>
                  {crew.name}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="角色">
          {(id) => (
            <Select
              id={id}
              value={role}
              onChange={(event) => setRole(event.target.value as WorkerRole)}
            >
              <option value="worker">師傅</option>
              <option value="foreman">領班</option>
            </Select>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="手機" hint="09 開頭 10 碼">
            {(id) => (
              <TextInput
                id={id}
                type="tel"
                inputMode="tel"
                value={phone}
                maxLength={10}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="0912345678"
              />
            )}
          </Field>
          <Field label="員工編號">
            {(id) => (
              <TextInput
                id={id}
                value={employeeNo}
                maxLength={20}
                onChange={(event) => setEmployeeNo(event.target.value)}
                placeholder="選填"
              />
            )}
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="到職日" hint="用於計算年資與特休" required>
            {(id) => (
              <TextInput
                id={id}
                type="date"
                className="tnum"
                value={hireDate}
                max={todayWorkDate()}
                onChange={(event) => setHireDate(event.target.value)}
              />
            )}
          </Field>
          <Field label="日薪（元）" hint={`基本工資換算 ${formatMoney(DAILY_WAGE_FLOOR)}`}>
            {(id) => (
              <TextInput
                id={id}
                type="number"
                inputMode="numeric"
                className="tnum"
                min={0}
                step={100}
                value={dailyWage}
                onChange={(event) => setDailyWage(event.target.value)}
                placeholder="例如 2200"
              />
            )}
          </Field>
        </div>

        {hireDate ? <LeavePreview hireDate={hireDate} /> : null}

        <Toggle
          checked={hasAccount}
          onChange={handleAccountToggle}
          label="建立登入帳號"
          description="預設密碼 1234；帳號由員工編號或手機自動產生。"
        />

        <Toggle
          checked={canSelfCheckIn}
          onChange={setCanSelfCheckIn}
          disabled={!hasAccount}
          label="開通自行打卡"
          description={
            hasAccount ? '開通後可自行在手機上打卡。' : '需要先建立登入帳號才能開通。'
          }
        />

        <Toggle
          checked={active}
          onChange={setActive}
          label="在職中"
          description="停用後不會出現在打卡清單，歷史紀錄保留。"
        />

        {isEdit && worker?.hasAccount ? (
          <Button
            variant="secondary"
            fullWidth
            icon={<KeyRound size={16} />}
            loading={resetPassword.isPending}
            onClick={handleResetPassword}
          >
            重設密碼為預設值
          </Button>
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
