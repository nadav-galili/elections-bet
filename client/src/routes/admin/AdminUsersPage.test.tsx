import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { AdminUser } from '@/lib/admin/types';

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
const del = vi.fn();
vi.mock('@/lib/api', () => ({
  useApi: () => ({ get, post, patch, delete: del }),
  api: { get: vi.fn() },
}));

import AdminUsersPage from '@/routes/admin/AdminUsersPage';

const dana: AdminUser = {
  id: 'u1',
  email: 'dana@example.com',
  displayName: 'דנה',
  avatarUrl: null,
  role: 'USER',
  bannedAt: null,
  createdAt: '2026-06-01T00:00:00.000Z',
};

const yossi: AdminUser = {
  id: 'u2',
  email: 'yossi@example.com',
  displayName: 'יוסי',
  avatarUrl: null,
  role: 'SUPER_ADMIN',
  bannedAt: '2026-06-10T00:00:00.000Z',
  createdAt: '2026-06-02T00:00:00.000Z',
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('AdminUsersPage', () => {
  it('renders the users list from mocked data', async () => {
    get.mockResolvedValue({ data: [dana, yossi] });

    renderWithProviders(<AdminUsersPage />, { initialEntries: ['/admin/users'] });

    expect(await screen.findByText('דנה')).toBeInTheDocument();
    expect(screen.getByText('יוסי')).toBeInTheDocument();
    expect(screen.getByText('dana@example.com')).toBeInTheDocument();
    expect(screen.getByText('מושעה')).toBeInTheDocument();
  });

  it('filters the list via the search box', async () => {
    // Return only Dana when the query matches her, everyone otherwise.
    get.mockImplementation((_url: string, config?: { params?: { q?: string } }) => {
      const q = config?.params?.q ?? '';
      const rows = q ? [dana] : [dana, yossi];
      return Promise.resolve({ data: rows });
    });

    renderWithProviders(<AdminUsersPage />, { initialEntries: ['/admin/users'] });

    expect(await screen.findByText('יוסי')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('חיפוש משתמשים'), 'דנה');

    // After the debounce + refetch settles, Yossi is filtered out and Dana remains.
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/api/admin/users', { params: { q: 'דנה' } }),
    );
    await waitFor(() => expect(screen.queryByText('יוסי')).not.toBeInTheDocument());
    expect(await screen.findByText('דנה')).toBeInTheDocument();
  });

  it('deletes a user only after the confirm dialog is accepted', async () => {
    get.mockResolvedValue({ data: [dana] });
    del.mockResolvedValue({});

    renderWithProviders(<AdminUsersPage />, { initialEntries: ['/admin/users'] });
    await screen.findByText('דנה');

    // Clicking the row action opens the confirm dialog but does NOT delete yet.
    await userEvent.click(screen.getByLabelText('מחיקת דנה'));
    expect(await screen.findByText('מחיקת משתמש')).toBeInTheDocument();
    expect(del).not.toHaveBeenCalled();

    // Only confirming fires the DELETE.
    await userEvent.click(screen.getByRole('button', { name: 'מחיקה' }));
    await waitFor(() => expect(del).toHaveBeenCalledWith('/api/admin/users/u1'));
  });
});
