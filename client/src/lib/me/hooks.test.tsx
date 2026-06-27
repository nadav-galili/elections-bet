import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

const patch = vi.fn();
vi.mock('@/lib/api', () => ({
  useApi: () => ({ get: vi.fn(), patch, post: vi.fn(), delete: vi.fn() }),
  api: { get: vi.fn() },
}));

import { useUpdateDisplayName, meKeys } from '@/lib/me/hooks';
import { leaderboardKeys } from '@/lib/leaderboard/hooks';

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function newQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('useUpdateDisplayName', () => {
  it('PATCHes /api/me with the new display name', async () => {
    patch.mockResolvedValue({
      data: { id: 'u1', role: 'USER', displayName: 'שם חדש', avatarUrl: null },
    });

    const { result } = renderHook(() => useUpdateDisplayName(), {
      wrapper: makeWrapper(newQueryClient()),
    });

    result.current.mutate('שם חדש');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(patch).toHaveBeenCalledWith('/api/me', { displayName: 'שם חדש' });
  });

  it('invalidates BOTH the me query and the leaderboard on success', async () => {
    patch.mockResolvedValue({
      data: { id: 'u1', role: 'USER', displayName: 'שם חדש', avatarUrl: null },
    });

    const queryClient = newQueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateDisplayName(), {
      wrapper: makeWrapper(queryClient),
    });

    result.current.mutate('שם חדש');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // The rename must refresh the profile AND the board (the name renders there).
    expect(invalidate).toHaveBeenCalledWith({ queryKey: meKeys.me });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: leaderboardKeys.all });
  });
});
