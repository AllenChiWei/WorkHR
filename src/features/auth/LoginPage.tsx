import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { HardHat, KeyRound, LogIn, User } from 'lucide-react';
import { credentialsSchema } from '@/schemas/auth';
import { homePathFor } from '@/lib/permissions';
import { toErrorMessage } from '@/lib/errors';
import { SHOW_DEV_TOOLS } from '@/lib/env';
import { Button } from '@/components/Button';
import { Field, TextInput } from '@/components/Form';
import { useAuthStore } from './authStore';

interface LocationState {
  returnTo?: string;
}

const DEMO_ACCOUNTS = [
  { identifier: 'admin', password: 'admin123', label: '管理員' },
  { identifier: 'foreman-a', password: '1234', label: 'A 班領班' },
  { identifier: 'worker-a1', password: '1234', label: 'A 班師傅（已開通自行打卡）' },
];

export function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as LocationState | null)?.returnTo;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const parsed = credentialsSchema.safeParse({ identifier, password });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === 'string' && !errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);

    try {
      const user = await login(parsed.data);
      // 登入前想去的頁面優先，其次才是角色首頁
      navigate(returnTo ?? homePathFor(user), { replace: true });
    } catch (error) {
      setFormError(toErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = (account: (typeof DEMO_ACCOUNTS)[number]) => {
    setIdentifier(account.identifier);
    setPassword(account.password);
    setFormError(null);
  };

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-canvas px-4 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-brand text-ink-invert">
            <HardHat size={30} />
          </div>
          <h1 className="text-2xl font-bold text-ink">工地工班打卡系統</h1>
          <p className="mt-1 text-sm text-ink-soft">請輸入帳號密碼登入</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-line bg-surface p-5"
          noValidate
        >
          <Field label="帳號" hint="可輸入帳號、手機或員工編號" error={fieldErrors.identifier} required>
            {(id) => (
              <div className="relative">
                <User
                  size={18}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute"
                />
                <TextInput
                  id={id}
                  className="pl-10"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  autoComplete="username"
                  inputMode="text"
                  autoCapitalize="none"
                  placeholder="例如 foreman-a"
                />
              </div>
            )}
          </Field>

          <Field label="密碼" error={fieldErrors.password} required>
            {(id) => (
              <div className="relative">
                <KeyRound
                  size={18}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute"
                />
                <TextInput
                  id={id}
                  className="pl-10"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                />
              </div>
            )}
          </Field>

          {formError ? (
            <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-semibold text-danger">
              {formError}
            </p>
          ) : null}

          <Button type="submit" size="lg" fullWidth loading={submitting} icon={<LogIn size={18} />}>
            登入
          </Button>
        </form>

        {SHOW_DEV_TOOLS ? (
          <div className="mt-5 rounded-2xl border border-dashed border-line-strong bg-surface-sunken p-4">
            <p className="mb-2 text-xs font-bold text-ink-soft">測試帳號（點一下自動帶入）</p>
            <ul className="space-y-1.5">
              {DEMO_ACCOUNTS.map((account) => (
                <li key={account.identifier}>
                  <button
                    type="button"
                    onClick={() => fillDemo(account)}
                    className="tap flex w-full items-center justify-between gap-2 rounded-lg bg-surface px-3 text-left text-sm hover:bg-brand-soft"
                  >
                    <span className="tnum font-mono text-ink">
                      {account.identifier} / {account.password}
                    </span>
                    <span className="shrink-0 text-xs text-ink-soft">{account.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
