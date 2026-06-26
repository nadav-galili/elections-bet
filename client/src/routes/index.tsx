import type { RouteObject } from 'react-router-dom';
import App from '@/App';
import HomePage from '@/routes/HomePage';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <App />,
    children: [{ index: true, element: <HomePage /> }],
  },
];
