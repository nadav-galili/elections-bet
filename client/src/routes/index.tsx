import type { RouteObject } from 'react-router-dom';
import App from '@/App';
import HomePage from '@/routes/HomePage';
import RequireSuperAdmin from '@/components/admin/RequireSuperAdmin';
import AdminLayout from '@/routes/admin/AdminLayout';
import AdminElectionsPage from '@/routes/admin/AdminElectionsPage';
import AdminGroupsPage from '@/routes/admin/AdminGroupsPage';
import AdminUsersPage from '@/routes/admin/AdminUsersPage';
import AdminOverviewPage from '@/routes/admin/AdminOverviewPage';
import ElectionFormPage from '@/routes/admin/ElectionFormPage';
import ElectionDetailPage from '@/routes/admin/ElectionDetailPage';
import PickPage from '@/routes/pick/PickPage';
import LeaderboardPage from '@/routes/leaderboard/LeaderboardPage';
import { routes as groupsRoutes } from '@/routes/groups';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'elections/:id/pick', element: <PickPage /> },
      { path: 'leaderboard', element: <LeaderboardPage /> },
      {
        path: 'admin',
        element: <RequireSuperAdmin />,
        children: [
          {
            element: <AdminLayout />,
            children: [
              { index: true, element: <AdminElectionsPage /> },
              { path: 'groups', element: <AdminGroupsPage /> },
              { path: 'users', element: <AdminUsersPage /> },
              { path: 'overview', element: <AdminOverviewPage /> },
            ],
          },
          { path: 'elections/new', element: <ElectionFormPage /> },
          { path: 'elections/:id', element: <ElectionDetailPage /> },
        ],
      },
      ...groupsRoutes,
    ],
  },
];
