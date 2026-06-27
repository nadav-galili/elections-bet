import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { Group } from '@/lib/groups/types';

const get = vi.fn();
vi.mock('@/lib/api', () => ({
  useApi: () => ({ get, post: vi.fn(), patch: vi.fn(), delete: vi.fn() }),
  api: { get: vi.fn() },
}));

import GroupsListPage from '@/routes/groups/GroupsListPage';

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('GroupsListPage', () => {
  it('renders groups from mocked data with name link and member-count badge', async () => {
    const groups: Group[] = [
      {
        id: 'g1',
        nameHe: 'המשפחה',
        adminUserId: 'u1',
        inviteToken: 'tok-abc',
        createdAt: '2026-06-01T00:00:00.000Z',
        _count: { memberships: 4 },
      },
    ];
    get.mockResolvedValueOnce({ data: groups });

    renderWithProviders(<GroupsListPage />, { initialEntries: ['/groups'] });

    const nameLink = await screen.findByRole('link', { name: 'המשפחה' });
    expect(nameLink).toHaveAttribute('href', '/groups/g1');
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('shows the Hebrew empty state when there are no groups', async () => {
    get.mockResolvedValueOnce({ data: [] });

    renderWithProviders(<GroupsListPage />, { initialEntries: ['/groups'] });

    await waitFor(() => expect(screen.getByText('עדיין לא נוצרו קבוצות.')).toBeInTheDocument());
  });

  it('shows an error state and refetches on retry', async () => {
    const user = userEvent.setup();
    get.mockRejectedValueOnce(new Error('boom'));

    renderWithProviders(<GroupsListPage />, { initialEntries: ['/groups'] });

    expect(await screen.findByText('שגיאה בטעינת הקבוצות')).toBeInTheDocument();

    get.mockResolvedValueOnce({
      data: [
        {
          id: 'g1',
          nameHe: 'המשפחה',
          adminUserId: 'u1',
          inviteToken: 'tok-abc',
          createdAt: '2026-06-01T00:00:00.000Z',
          _count: { memberships: 4 },
        },
      ],
    });

    await user.click(screen.getByRole('button', { name: 'נסו שוב' }));

    expect(await screen.findByRole('link', { name: 'המשפחה' })).toBeInTheDocument();
  });

  it('copies the /join/<token> URL when the invite button is clicked', async () => {
    // userEvent.setup() installs its own navigator.clipboard stub, so spy AFTER setup.
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

    const groups: Group[] = [
      {
        id: 'g1',
        nameHe: 'המשפחה',
        adminUserId: 'u1',
        inviteToken: 'tok-abc',
        createdAt: '2026-06-01T00:00:00.000Z',
        _count: { memberships: 4 },
      },
    ];
    get.mockResolvedValueOnce({ data: groups });

    renderWithProviders(<GroupsListPage />, { initialEntries: ['/groups'] });

    await screen.findByRole('link', { name: 'המשפחה' });
    await user.click(screen.getByRole('button', { name: /העתק קישור/ }));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/join/tok-abc`);
    expect(await screen.findByText('הועתק')).toBeInTheDocument();
  });
});
