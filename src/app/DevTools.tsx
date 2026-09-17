import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { services, isMockDataSource } from '@/services';
import { SHOW_DEV_TOOLS } from '@/lib/env';
import { useToast } from '@/components/toast';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useAuthStore } from '@/features/auth/authStore';

/** 重置 mock 資料的浮動按鈕；僅開發模式與展示站顯示。 */
export function DevTools() {
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);
  const queryClient = useQueryClient();
  const toast = useToast();
  const bootstrap = useAuthStore((state) => state.bootstrap);

  if (!SHOW_DEV_TOOLS || !isMockDataSource) return null;

  const handleReset = async () => {
    setResetting(true);
    try {
      await services.dev.resetMockData();
      await queryClient.invalidateQueries();
      await bootstrap();
      toast.success('已重置為初始 mock 資料，請重新登入');
      setConfirming(false);
    } catch {
      toast.error('重置失敗，請重新整理頁面再試');
    } finally {
      setResetting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="tap fixed bottom-24 right-3 z-20 flex items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 text-xs font-bold text-ink-soft shadow-lg"
      >
        <RotateCcw size={14} />
        重置資料
      </button>

      <ConfirmDialog
        open={confirming}
        title="重置 mock 資料"
        message="會清掉目前所有工班、人員與打卡紀錄，回到初始的示範資料，並登出目前帳號。確定要繼續嗎？"
        confirmLabel="重置"
        tone="danger"
        loading={resetting}
        onConfirm={handleReset}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
