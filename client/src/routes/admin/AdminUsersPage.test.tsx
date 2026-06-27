import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
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

beforeAll(() => {
  // Radix Select relies on these, which jsdom doesn't implement.
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.HTMLElement.prototype.hasPointerCapture = vi.fn();
  window.HTMLElement.prototype.releasePointerCapture = vi.fn();
});

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

  it('bans an active user and unbans a banned one', async () => {
    get.mockResolvedValue({ data: [dana, yossi] });
    post.mockResolvedValue({ data: {} });
    del.mockResolvedValue({ data: {} });

    renderWithProviders(<AdminUsersPage />, { initialEntries: ['/admin/users'] });
    await screen.findByText('דנה');

    await userEvent.click(screen.getByLabelText('השעיית דנה'));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/admin/users/u1/ban'));

    await userEvent.click(screen.getByLabelText('ביטול השעיה יוסי'));
    await waitFor(() => expect(del).toHaveBeenCalledWith('/api/admin/users/u2/ban'));
  });

  it('requires confirmation before promoting a user to SUPER_ADMIN', async () => {
    get.mockResolvedValue({ data: [dana] });
    patch.mockResolvedValue({ data: { ...dana, role: 'SUPER_ADMIN' } });

    renderWithProviders(<AdminUsersPage />, { initialEntries: ['/admin/users'] });
    await screen.findByText('דנה');

    // Select SUPER_ADMIN → confirm dialog opens, but no PATCH yet.
    await userEvent.click(screen.getByLabelText('תפקיד דנה'));
    await userEvent.click(await screen.findByRole('option', { name: 'מנהל-על' }));
    expect(await screen.findByText('הענקת הרשאת מנהל-על')).toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();

    // Confirming sends the promotion.
    await userEvent.click(screen.getByRole('button', { name: 'הענקת הרשאה' }));
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/api/admin/users/u1', { role: 'SUPER_ADMIN' }),
    );
  });
});
