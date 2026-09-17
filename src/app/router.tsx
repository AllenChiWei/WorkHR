import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from '@/features/auth/LoginPage';
import { CrewTodayPage } from '@/features/attendance/CrewTodayPage';
import { MyPunchPage } from '@/features/attendance/MyPunchPage';
import { CrewsPage } from '@/features/crews/CrewsPage';
import { CrewDetailPage } from '@/features/crews/CrewDetailPage';
import { WorkersPage } from '@/features/workers/WorkersPage';
import { AdminDashboard } from '@/features/reports/AdminDashboard';
import { AdminAttendancePage } from '@/features/reports/AdminAttendancePage';
import { AdminCalendarPage } from '@/features/reports/AdminCalendarPage';
import { AdminReportsPage } from '@/features/reports/AdminReportsPage';
import { AppLayout } from './AppLayout';
import { ForbiddenPage, NotFoundPage } from './ErrorPages';
import { RedirectHome, RequireAuth, RequirePermission, RequireRole } from './guards';

export function AppRouter() {
  return (
    // basename 讓同一份 build 能部署在 GitHub Pages 的子路徑下
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/403" element={<ForbiddenPage />} />

        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route index element={<RedirectHome />} />

            {/* 管理員 */}
            <Route element={<RequireRole roles={['admin']} />}>
              <Route path="admin" element={<AdminDashboard />} />
              <Route path="admin/crews" element={<CrewsPage />} />
              <Route path="admin/crews/:id" element={<CrewDetailPage />} />
              <Route path="admin/workers" element={<WorkersPage />} />
              <Route path="admin/attendance" element={<AdminAttendancePage />} />
              <Route path="admin/calendar" element={<AdminCalendarPage />} />
              <Route path="admin/reports" element={<AdminReportsPage />} />
            </Route>

            {/* 領班：只有今日打卡頁 */}
            <Route element={<RequireRole roles={['foreman', 'admin']} />}>
              <Route path="crew" element={<CrewTodayPage />} />
            </Route>

            {/* 個人打卡：需已開通自行打卡 */}
            <Route element={<RequirePermission action="attendance:punchSelf" />}>
              <Route path="me" element={<MyPunchPage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
