import type { RouteObject } from 'react-router-dom';
import App from '@/App';
import HomePage from '@/routes/HomePage';
import RequireSuperAdmin from '@/components/admin/RequireSuperAdmin';
import AdminElectionsPage from '@/routes/admin/AdminElectionsPage';
import ElectionFormPage from '@/routes/admin/ElectionFormPage';
import ElectionDetailPage from '@/routes/admin/ElectionDetailPage';
import PickPage from '@/routes/pick/PickPage';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'elections/:id/pick', element: <PickPage /> },
      {
        path: 'admin',
        element: <RequireSuperAdmin />,
        children: [
          { index: true, element: <AdminElectionsPage /> },
          { path: 'elections/new', element: <ElectionFormPage /> },
          { path: 'elections/:id', element: <ElectionDetailPage /> },
        ],
      },
    ],
  },
];
