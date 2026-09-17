import { Link } from 'react-router-dom';
import { ShieldAlert, Compass } from 'lucide-react';
import { useAuthStore } from '@/features/auth/authStore';
import { homePathFor } from '@/lib/permissions';

function Shell({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  const user = useAuthStore((state) => state.user);
  const home = user ? homePathFor(user) : '/login';

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 text-ink-mute">{icon}</div>
      <h1 className="text-2xl font-bold text-ink">{title}</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-soft">{description}</p>
      <Link
        to={home}
        className="tap mt-6 inline-flex items-center rounded-xl bg-brand px-5 font-semibold text-ink-invert"
      >
        回到首頁
      </Link>
    </div>
  );
}

export function ForbiddenPage() {
  return (
    <Shell
      icon={<ShieldAlert size={48} strokeWidth={1.5} />}
      title="沒有存取權限"
      description="這個頁面不屬於你的角色可以使用的範圍。如果認為是設定錯誤，請聯絡管理員。"
    />
  );
}

export function NotFoundPage() {
  return (
    <Shell
      icon={<Compass size={48} strokeWidth={1.5} />}
      title="找不到這個頁面"
      description="網址可能輸入錯誤，或這個頁面已經被移除。"
    />
  );
}
