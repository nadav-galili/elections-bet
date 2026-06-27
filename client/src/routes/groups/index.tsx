import type { RouteObject } from 'react-router-dom';
import GroupsListPage from './GroupsListPage';
import GroupFormPage from './GroupFormPage';
import GroupDetailPage from './GroupDetailPage';
import JoinPage from './JoinPage';

/**
 * Groups routes plus a SEPARATE top-level `join/:token` route.
 * Join lives at the top level (not under `groups`) so the copy-link URL
 * `${origin}/join/<token>` resolves and `:id` never shadows it.
 */
export const routes: RouteObject[] = [
  {
    path: 'groups',
    children: [
      { index: true, element: <GroupsListPage /> },
      { path: 'new', element: <GroupFormPage /> },
      { path: ':id', element: <GroupDetailPage /> },
    ],
  },
  { path: 'join/:token', element: <JoinPage /> },
];
