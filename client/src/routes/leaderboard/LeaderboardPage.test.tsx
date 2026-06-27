import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { LeaderboardResponse } from '@/lib/leaderboard/types';
import type { PlayerElection } from '@/lib/pick/types';

const get = vi.fn();
const patch = vi.fn();
vi.mock('@/lib/api', () => ({
  useApi: () => ({ get, patch, post: vi.fn(), delete: vi.fn() }),
  api: { get: vi.fn() },
}));

import LeaderboardPage from '@/routes/leaderboard/LeaderboardPage';

const baseElection: PlayerElection = {
  id: 'e1',
  nameHe: 'הכנסת ה-26',
  lockAt: '2026-06-26T17:00:00.000Z',
  revealAt: null,
  resultsStatus: 'FINAL',
};
let elections: PlayerElection[] = [baseElection];

// Editor name is distinct from any row name so the two never collide in queries.
const me = { id: 'u-me', role: 'USER', displayName: 'המשתמש שלי', avatarUrl: null };

/**
 * Routes requests by URL so the page can resolve elections, me, and the board
 * regardless of fetch order. The board responder is a function of offset so the
 * pagination test can return different pages.
 */
function wire(boardFor: (offset: number) => LeaderboardResponse) {
  get.mockImplementation((url: string, config?: { params?: { offset?: number } }) => {
    if (url === '/api/elections') return Promise.resolve({ data: elections });
    if (url === '/api/me') return Promise.resolve({ data: me });
    if (url.endsWith('/leaderboard')) {
      const offset = config?.params?.offset ?? 0;
      return Promise.resolve({ data: boardFor(offset) });
    }
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
}

afterEach(() => {
  vi.clearAllMocks();
  elections = [baseElection];
});

describe('LeaderboardPage', () => {
  it('published: renders rows and highlights the caller row', async () => {
    const board: LeaderboardResponse = {
      published: true,
      totalCount: 2,
      yourRank: 2,
      rows: [
        { rank: 1, userId: 'u-other', displayName: 'דנה', avatarUrl: null, total: 230 },
        { rank: 2, userId: 'u-me', displayName: 'אני', avatarUrl: null, total: 210 },
      ],
    };
    wire(() => board);

    renderWithProviders(<LeaderboardPage />);

    expect(await screen.findByText('דנה')).toBeInTheDocument();
    expect(screen.getByText('230')).toBeInTheDocument();
    expect(screen.getByText('210')).toBeInTheDocument();

    // The caller's row carries the highlight marker.
    const table = screen.getByRole('table');
    const youCell = within(table).getByText('אני');
    const row = youCell.closest('tr');
    expect(row).toHaveAttribute('data-you', 'true');

    // Your-rank banner.
    expect(screen.getByText(/המקום שלך:/)).toBeInTheDocument();

    // FINAL election surfaces the unmissable "סופי" badge.
    expect(screen.getByText('סופי')).toBeInTheDocument();
  });

  it('published + PROVISIONAL: surfaces the מדגם badge', async () => {
    elections = [{ ...baseElection, resultsStatus: 'PROVISIONAL' }];
    const board: LeaderboardResponse = {
      published: true,
      totalCount: 1,
      yourRank: 1,
      rows: [{ rank: 1, userId: 'u-me', displayName: 'אני', avatarUrl: null, total: 230 }],
    };
    wire(() => board);

    renderWithProviders(<LeaderboardPage />);

    expect(await screen.findByText('אני')).toBeInTheDocument();
    expect(screen.getByText('מדגם')).toBeInTheDocument();
    expect(screen.queryByText('סופי')).not.toBeInTheDocument();
  });

  it('pagination: clicking next advances the offset and refetches', async () => {
    const page0: LeaderboardResponse = {
      published: true,
      totalCount: 60,
      yourRank: 1,
      rows: [{ rank: 1, userId: 'u-me', displayName: 'אני', avatarUrl: null, total: 230 }],
    };
    const page1: LeaderboardResponse = {
      published: true,
      totalCount: 60,
      yourRank: 1,
      rows: [{ rank: 51, userId: 'u-51', displayName: 'משתתף 51', avatarUrl: null, total: 100 }],
    };
    wire((offset) => (offset >= 50 ? page1 : page0));

    renderWithProviders(<LeaderboardPage />);

    expect(await screen.findByText('אני')).toBeInTheDocument();

    const next = screen.getByRole('button', { name: 'הבא' });
    await userEvent.click(next);

    await screen.findByText('משתתף 51');

    // A leaderboard request was issued with offset 50.
    await waitFor(() => {
      const calledWithOffset = get.mock.calls.some(
        ([url, config]) =>
          typeof url === 'string' && url.endsWith('/leaderboard') && config?.params?.offset === 50,
      );
      expect(calledWithOffset).toBe(true);
    });
  });

  it('published:false: shows the participation-count state and no rows', async () => {
    wire(() => ({ published: false, state: 'pre_publish', participantCount: 7 }));

    renderWithProviders(<LeaderboardPage />);

    expect(await screen.findByText('הטבלה תיחשף לאחר פרסום התוצאות')).toBeInTheDocument();
    expect(screen.getByText(/יפרסם תוצאות \(מדגם או סופיות\)/)).toBeInTheDocument();
    expect(screen.getByText(/7 משתתפים הגישו תחזית/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('edit display name: calls PATCH /api/me with the new name', async () => {
    wire(() => ({ published: false, state: 'pre_publish', participantCount: 0 }));
    patch.mockResolvedValue({ data: { ...me, displayName: 'שם חדש' } });

    renderWithProviders(<LeaderboardPage />);

    const editBtn = await screen.findByRole('button', { name: 'ערוך' });
    await userEvent.click(editBtn);

    const input = screen.getByLabelText('שם תצוגה');
    await userEvent.clear(input);
    await userEvent.type(input, 'שם חדש');

    await userEvent.click(screen.getByRole('button', { name: 'שמור' }));

    await waitFor(() => {
      expect(patch).toHaveBeenCalledWith('/api/me', { displayName: 'שם חדש' });
    });
  });
});
