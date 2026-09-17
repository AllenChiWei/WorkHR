import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { CalendarRange, FileBarChart, HardHat, LogOut, Users, Wallet } from 'lucide-react';
import { useAuthStore } from '@/features/auth/authStore';
import { useToast } from '@/components/toast';
import { DevTools } from './DevTools';

const ADMIN_NAV = [
  { to: '/admin', label: '儀表板', icon: HardHat, end: true },
  { to: '/admin/crews', label: '工班', icon: Users, end: false },
  { to: '/admin/workers', label: '人員', icon: Users, end: false },
  { to: '/admin/attendance', label: '打卡紀錄', icon: CalendarRange, end: false },
  { to: '/admin/calendar', label: '出勤月曆', icon: CalendarRange, end: false },
  { to: '/admin/reports', label: '報表', icon: FileBarChart, end: false },
  { to: '/admin/payroll', label: '薪資', icon: Wallet, end: false },
] as const;

const ROLE_LABEL = {
  admin: '管理員',
  foreman: '領班',
  worker: '師傅',
} as const;

export function AppLayout() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const toast = useToast();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      toast.error('登出失敗，請再試一次');
    }
  };

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold text-ink">工地工班打卡系統</p>
            {user ? (
              <p className="truncate text-xs text-ink-soft">
                {user.name} · {ROLE_LABEL[user.role]}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="tap flex items-center gap-1.5 rounded-xl border border-line-strong px-3 text-sm font-semibold text-ink-soft hover:bg-surface-sunken"
          >
            <LogOut size={16} />
            登出
          </button>
        </div>

        {user?.role === 'admin' ? (
          <nav className="mx-auto max-w-5xl overflow-x-auto px-2 pb-2">
            <ul className="flex gap-1">
              {ADMIN_NAV.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `tap flex items-center whitespace-nowrap rounded-xl px-3 text-sm font-semibold ${
                        isActive ? 'bg-brand text-ink-invert' : 'text-ink-soft hover:bg-surface-sunken'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </header>

      <main className="mx-auto max-w-5xl px-4 py-4">
        <Outlet />
      </main>

      <DevTools />
    </div>
  );
}
