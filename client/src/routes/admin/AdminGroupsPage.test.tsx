import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { AdminGroup } from '@/lib/admin/types';

const get = vi.fn();
vi.mock('@/lib/api', () => ({
  useApi: () => ({ get, post: vi.fn(), patch: vi.fn(), delete: vi.fn() }),
  api: { get: vi.fn() },
}));

import AdminGroupsPage from '@/routes/admin/AdminGroupsPage';

afterEach(() => {
  vi.clearAllMocks();
});

describe('AdminGroupsPage', () => {
  it('renders the groups list from mocked data', async () => {
    const groups: AdminGroup[] = [
      {
        id: 'g1',
        nameHe: 'המשפחה',
        createdAt: '2026-06-01T00:00:00.000Z',
        admin: { id: 'u1', displayName: 'דנה', email: 'dana@example.com' },
        memberCount: 5,
      },
    ];
    get.mockResolvedValueOnce({ data: groups });

    renderWithProviders(<AdminGroupsPage />, { initialEntries: ['/admin/groups'] });

    expect(await screen.findByText('המשפחה')).toBeInTheDocument();
    expect(screen.getByText('דנה')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows the Hebrew empty state when there are no groups', async () => {
    get.mockResolvedValueOnce({ data: [] });

    renderWithProviders(<AdminGroupsPage />, { initialEntries: ['/admin/groups'] });

    await waitFor(() => expect(screen.getByText('עדיין לא נוצרו קבוצות.')).toBeInTheDocument());
  });
});
