import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Role } from '@/types';
import { can, homePathFor, type PermissionAction } from '@/lib/permissions';
import { useAuthStore } from '@/features/auth/authStore';
import { ListSkeleton } from '@/components/Feedback';

function BootstrapFallback() {
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <ListSkeleton rows={3} />
    </div>
  );
}

/**
 * 未登入導回 /login 並保留 returnTo。
 * 這是第一層防線；第二層在 service 層（src/services/mock/guard.ts）。
 */
export function RequireAuth({ children }: { children?: ReactNode }) {
  const status = useAuthStore((state) => state.status);
  const location = useLocation();

  if (status === 'loading') return <BootstrapFallback />;
  if (status === 'anonymous') {
    const returnTo = `${location.pathname}${location.search}`;
    return <Navigate to="/login" replace state={{ returnTo }} />;
  }
  return <>{children ?? <Outlet />}</>;
}

/** 角色不符導向 /403。 */
export function RequireRole({ roles, children }: { roles: Role[]; children?: ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);

  if (status === 'loading') return <BootstrapFallback />;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/403" replace />;
  return <>{children ?? <Outlet />}</>;
}

/** 需要特定權限才能進入的頁面（例如個人打卡需已開通）。 */
export function RequirePermission({
  action,
  children,
}: {
  action: PermissionAction;
  children?: ReactNode;
}) {
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);

  if (status === 'loading') return <BootstrapFallback />;
  if (!user) return <Navigate to="/login" replace />;
  if (!can(user, action, { crewId: user.crewId })) return <Navigate to="/403" replace />;
  return <>{children ?? <Outlet />}</>;
}

/** 已登入者進到 /login 或根路徑時，直接送往各自首頁。 */
export function RedirectHome() {
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);

  if (status === 'loading') return <BootstrapFallback />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={homePathFor(user)} replace />;
}
