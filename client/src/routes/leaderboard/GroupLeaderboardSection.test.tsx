import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { LeaderboardResponse } from '@/lib/leaderboard/types';

const get = vi.fn();
vi.mock('@/lib/api', () => ({
  useApi: () => ({ get, patch: vi.fn(), post: vi.fn(), delete: vi.fn() }),
  api: { get: vi.fn() },
}));

import { GroupLeaderboardSection } from '@/routes/leaderboard/GroupLeaderboardSection';

const me = { id: 'u-me', role: 'USER', displayName: 'אני', avatarUrl: null };

function wire(board: LeaderboardResponse) {
  get.mockImplementation((url: string) => {
    if (url === '/api/me') return Promise.resolve({ data: me });
    if (url.endsWith('/leaderboard')) return Promise.resolve({ data: board });
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('GroupLeaderboardSection', () => {
  it('published: highlights the caller row and shows the within-group rank', async () => {
    wire({
      published: true,
      totalCount: 3,
      yourRank: 2,
      rows: [
        { rank: 1, userId: 'u-a', displayName: 'דנה', avatarUrl: null, total: 220 },
        { rank: 2, userId: 'u-me', displayName: 'אני', avatarUrl: null, total: 200 },
        { rank: 3, userId: 'u-c', displayName: 'יוסי', avatarUrl: null, total: 180 },
      ],
    });

    renderWithProviders(<GroupLeaderboardSection groupId="g1" />);

    expect(await screen.findByText('דנה')).toBeInTheDocument();

    const table = screen.getByRole('table');
    const youCell = within(table).getByText('אני');
    const row = youCell.closest('tr');
    expect(row).toHaveAttribute('data-you', 'true');

    expect(screen.getByText(/המקום שלך בקבוצה:/)).toBeInTheDocument();
  });

  it('pre-publish: shows the participation-count state and no rows', async () => {
    wire({ published: false, state: 'pre_publish', participantCount: 4 });

    renderWithProviders(<GroupLeaderboardSection groupId="g1" />);

    expect(await screen.findByText('הטבלה תיחשף לאחר פרסום התוצאות')).toBeInTheDocument();
    expect(screen.getByText(/יפרסם תוצאות \(מדגם או סופיות\)/)).toBeInTheDocument();
    expect(screen.getByText(/4 חברים הגישו תחזית/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('no active election: shows a distinct message, not the participation card', async () => {
    wire({ published: false, state: 'no_active' });

    renderWithProviders(<GroupLeaderboardSection groupId="g1" />);

    expect(await screen.findByText('אין בחירות פעילות כרגע.')).toBeInTheDocument();
    expect(screen.queryByText('הטבלה תיחשף לאחר פרסום התוצאות')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('pagination: clicking next advances the offset and refetches', async () => {
    const page0: LeaderboardResponse = {
      published: true,
      totalCount: 120,
      yourRank: 99,
      rows: [{ rank: 1, userId: 'u-a', displayName: 'דנה', avatarUrl: null, total: 220 }],
    };
    const page1: LeaderboardResponse = {
      published: true,
      totalCount: 120,
      yourRank: 99,
      rows: [{ rank: 51, userId: 'u-z', displayName: 'רון', avatarUrl: null, total: 140 }],
    };
    get.mockImplementation((url: string, config?: { params?: { offset?: number } }) => {
      if (url === '/api/me') return Promise.resolve({ data: me });
      if (url.endsWith('/leaderboard')) {
        const offset = config?.params?.offset ?? 0;
        return Promise.resolve({ data: offset >= 50 ? page1 : page0 });
      }
      return Promise.reject(new Error(`unexpected GET ${url}`));
    });

    renderWithProviders(<GroupLeaderboardSection groupId="g1" />);

    expect(await screen.findByText('דנה')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'הבא' }));

    expect(await screen.findByText('רון')).toBeInTheDocument();
    const calledWithOffset = get.mock.calls.some(
      ([url, config]) =>
        typeof url === 'string' && url.endsWith('/leaderboard') && config?.params?.offset === 50,
    );
    expect(calledWithOffset).toBe(true);
  });
});
