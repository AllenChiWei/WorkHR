import { QueryClient } from '@tanstack/react-query';
import { isAppError } from '@/lib/errors';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 打卡資料變動頻繁，10 秒後就視為過期
      staleTime: 10_000,
      retry: (failureCount, error) => {
        // 權限與驗證錯誤重試沒有意義
        if (isAppError(error) && ['FORBIDDEN', 'UNAUTHORIZED', 'NOT_FOUND'].includes(error.code)) {
          return false;
        }
        return failureCount < 2;
      },
    },
    mutations: { retry: false },
  },
});
