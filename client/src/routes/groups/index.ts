import { Suspense } from 'react'
import { RouteObject } from 'react-router-dom'
import GroupsListPage from './GroupsListPage'
import GroupFormPage from './GroupFormPage'
import GroupDetailPage from './GroupDetailPage'
import JoinPage from './JoinPage'

export const routes: RouteObject[] = [
  {
    path: 'groups',
    children: [
      { index: true, element: <GroupsListPage /> },
      { path: 'new', element: <GroupFormPage /> },
      { path: ':id', element: <GroupDetailPage /> },
      { path: 'join/:token', element: <JoinPage /> },
    ],
  },
]