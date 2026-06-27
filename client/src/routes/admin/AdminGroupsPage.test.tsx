import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { AdminGroup } from '@/lib/admin/types';

const get = vi.fn();
const del = vi.fn();
vi.mock('@/lib/api', () => ({
  useApi: () => ({ get, post: vi.fn(), patch: vi.fn(), delete: del }),
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

  it('deletes a group only after the confirm dialog is accepted', async () => {
    const groups: AdminGroup[] = [
      {
        id: 'g1',
        nameHe: 'המשפחה',
        createdAt: '2026-06-01T00:00:00.000Z',
        admin: { id: 'u1', displayName: 'דנה', email: 'dana@example.com' },
        memberCount: 5,
      },
    ];
    get.mockResolvedValue({ data: groups });
    del.mockResolvedValue({});

    renderWithProviders(<AdminGroupsPage />, { initialEntries: ['/admin/groups'] });
    await screen.findByText('המשפחה');

    // Opening the confirm does NOT delete yet.
    await userEvent.click(screen.getByLabelText('מחיקת המשפחה'));
    expect(await screen.findByText('מחיקת קבוצה')).toBeInTheDocument();
    expect(del).not.toHaveBeenCalled();

    // Confirming fires the DELETE.
    await userEvent.click(screen.getByRole('button', { name: 'מחיקה' }));
    await waitFor(() => expect(del).toHaveBeenCalledWith('/api/admin/groups/g1'));
  });
});
