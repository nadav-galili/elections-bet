import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Navigate, Outlet } from 'react-router-dom';
import { useApi } from '@/lib/api';

interface Me {
  id: string;
  role: string;
}

/**
 * Guard for the super-admin surface. Fetches /api/me; while loading shows a
 * centered spinner; on error or a non-SUPER_ADMIN role redirects home; else
 * renders its children (or the nested <Outlet/> when used as a layout route).
 */
export function RequireSuperAdmin({ children }: { children?: ReactNode }) {
  const apiClient = useApi();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await apiClient.get('/api/me')).data as Me,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || data?.role !== 'SUPER_ADMIN') {
    return <Navigate to="/" replace />;
  }

  return <>{children ?? <Outlet />}</>;
}

export default RequireSuperAdmin;
