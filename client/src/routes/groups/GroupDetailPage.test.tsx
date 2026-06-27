import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { GroupDetail } from '@/lib/groups/types';

const get = vi.fn();
vi.mock('@/lib/api', () => ({
  useApi: () => ({ get, post: vi.fn(), patch: vi.fn(), delete: vi.fn() }),
  api: { get: vi.fn() },
}));

import GroupDetailPage from '@/routes/groups/GroupDetailPage';

Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: vi.fn().mockResolvedValue(undefined) },
  configurable: true,
});

function renderDetail() {
  return renderWithProviders(
    <Routes>
      <Route path="/groups/:id" element={<GroupDetailPage />} />
    </Routes>,
    { initialEntries: ['/groups/g1'] },
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('GroupDetailPage', () => {
  it('PRE-REVEAL: shows submitted/pending indicators and never mandate numbers', async () => {
    const data: GroupDetail = {
      id: 'g1',
      nameHe: 'המשפחה',
      adminUserId: 'admin-1',
      inviteToken: 'tok-abc',
      createdAt: '2026-06-01T00:00:00.000Z',
      currentUserId: 'member-2',
      privacyPhase: 'pre_reveal',
      activeElection: {
        id: 'e1',
        nameHe: 'הכנסת ה-26',
        lockAt: null,
        revealAt: null,
      },
      memberships: [
        {
          id: 'm1',
          userId: 'admin-1',
          joinedAt: '2026-06-01T00:00:00.000Z',
          user: { id: 'admin-1', displayName: 'דנה', avatarUrl: null },
          pickStatus: 'submitted',
        },
        {
          id: 'm2',
          userId: 'member-2',
          joinedAt: '2026-06-01T00:00:00.000Z',
          user: { id: 'member-2', displayName: 'יוסי', avatarUrl: null },
          pickStatus: 'pending',
        },
      ],
    };
    get.mockResolvedValueOnce({ data });

    renderDetail();

    expect(await screen.findByText('הגיש')).toBeInTheDocument();
    expect(screen.getByText('טרם הגיש')).toBeInTheDocument();
    // Privacy: no mandate value (e.g. "30") may leak before reveal.
    expect(screen.queryByText('30')).not.toBeInTheDocument();
  });

  it('POST-REVEAL: renders party names and mandate counts', async () => {
    const data: GroupDetail = {
      id: 'g1',
      nameHe: 'המשפחה',
      adminUserId: 'admin-1',
      inviteToken: 'tok-abc',
      createdAt: '2026-06-01T00:00:00.000Z',
      currentUserId: 'member-2',
      privacyPhase: 'post_reveal',
      activeElection: {
        id: 'e1',
        nameHe: 'הכנסת ה-26',
        lockAt: null,
        revealAt: null,
      },
      memberships: [
        {
          id: 'm1',
          userId: 'admin-1',
          joinedAt: '2026-06-01T00:00:00.000Z',
          user: { id: 'admin-1', displayName: 'דנה', avatarUrl: null },
          pickStatus: 'submitted',
          pick: {
            submittedAt: '2026-06-26T17:00:00.000Z',
            entries: [
              { partyId: 'p1', mandates: 30, party: { nameHe: 'הליכוד', logoUrl: null } },
              { partyId: 'p2', mandates: 24, party: { nameHe: 'יש עתיד', logoUrl: null } },
            ],
          },
        },
      ],
    };
    get.mockResolvedValueOnce({ data });

    renderDetail();

    expect(await screen.findByText('הליכוד')).toBeInTheDocument();
    expect(screen.getByText('יש עתיד')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('24')).toBeInTheDocument();
  });

  it('shows admin controls when currentUserId === adminUserId, hides them otherwise', async () => {
    const base: GroupDetail = {
      id: 'g1',
      nameHe: 'המשפחה',
      adminUserId: 'admin-1',
      inviteToken: 'tok-abc',
      createdAt: '2026-06-01T00:00:00.000Z',
      currentUserId: 'admin-1',
      privacyPhase: 'no_active',
      activeElection: null,
      memberships: [
        {
          id: 'm1',
          userId: 'admin-1',
          joinedAt: '2026-06-01T00:00:00.000Z',
          user: { id: 'admin-1', displayName: 'דנה', avatarUrl: null },
        },
      ],
    };
    get.mockResolvedValueOnce({ data: base });

    const { unmount } = renderDetail();
    expect(await screen.findByRole('button', { name: 'מחק קבוצה' })).toBeInTheDocument();
    unmount();

    // Now as a non-admin member.
    get.mockResolvedValueOnce({ data: { ...base, currentUserId: 'member-2' } });
    renderDetail();
    await screen.findByText('המשפחה');
    expect(screen.queryByRole('button', { name: 'מחק קבוצה' })).not.toBeInTheDocument();
  });
});
