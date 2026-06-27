import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

const patch = vi.fn();
vi.mock('@/lib/api', () => ({
  useApi: () => ({ get: vi.fn(), patch, post: vi.fn(), delete: vi.fn() }),
  api: { get: vi.fn() },
}));

import { useUpdateDisplayName } from '@/lib/me/hooks';

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('useUpdateDisplayName', () => {
  it('PATCHes /api/me with the new display name', async () => {
    patch.mockResolvedValue({
      data: { id: 'u1', role: 'USER', displayName: 'שם חדש', avatarUrl: null },
    });

    const { result } = renderHook(() => useUpdateDisplayName(), { wrapper });

    result.current.mutate('שם חדש');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(patch).toHaveBeenCalledWith('/api/me', { displayName: 'שם חדש' });
  });
});
