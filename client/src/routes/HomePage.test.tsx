import { screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { Pick, PlayerElection } from '@/lib/pick/types';

const get = vi.fn();
vi.mock('@/lib/api', () => ({
  useApi: () => ({ get, put: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }),
  api: { get: vi.fn() },
}));

// Render <Show when="signed-in"> children (signed-in user) and surface useUser.
vi.mock('@clerk/react', () => ({
  Show: ({ when, children }: { when: string; children: ReactNode }) =>
    when === 'signed-in' ? <>{children}</> : null,
  SignInButton: ({ children }: { children: ReactNode }) => <>{children}</>,
  useUser: () => ({ user: { firstName: 'דנה' } }),
}));

import HomePage from '@/routes/HomePage';

afterEach(() => {
  vi.clearAllMocks();
});

const election: PlayerElection = {
  id: 'e1',
  nameHe: 'הכנסת ה-26',
  // Far-future lock so the election is not yet locked.
  lockAt: '2999-01-01T20:00:00.000Z',
  revealAt: null,
  resultsStatus: 'NONE',
};

function mockApi(opts: {
  elections?: PlayerElection[];
  electionsReject?: boolean;
  electionsPending?: boolean;
  pick?: Pick | null;
}) {
  get.mockImplementation((url: string) => {
    if (url === '/health') return Promise.resolve({ data: { ok: true } });
    if (url === '/api/me') return Promise.resolve({ data: { id: 'u1', role: 'USER' } });
    if (url === '/api/elections') {
      if (opts.electionsPending) return new Promise(() => {});
      if (opts.electionsReject) return Promise.reject(new Error('boom'));
      return Promise.resolve({ data: opts.elections ?? [election] });
    }
    if (url === '/api/elections/e1/pick') return Promise.resolve({ data: opts.pick ?? null });
    return Promise.reject(new Error('unexpected ' + url));
  });
}

function renderHome() {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<HomePage />} />
    </Routes>,
    { initialEntries: ['/'] },
  );
}

describe('HomePage', () => {
  it('shows the "no pick yet" flag for an unlocked election with no submitted pick', async () => {
    mockApi({ elections: [election], pick: null });
    renderHome();

    expect(
      await screen.findByText('טרם הגשת תחזית — זה הזמן לחזות את חלוקת המנדטים.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'שמירת תחזית' })).toBeInTheDocument();
  });

  it('hides the flag once the user has a submitted pick', async () => {
    mockApi({
      elections: [election],
      pick: { entries: [], submittedAt: '2026-01-01T10:00:00.000Z' },
    });
    renderHome();

    // The CTA link still renders; the flag does not.
    expect(await screen.findByRole('link', { name: 'שמירת תחזית' })).toBeInTheDocument();
    expect(
      screen.queryByText('טרם הגשת תחזית — זה הזמן לחזות את חלוקת המנדטים.'),
    ).not.toBeInTheDocument();
  });

  it('renders a loading state while the elections query is pending', () => {
    mockApi({ electionsPending: true });
    renderHome();

    expect(screen.getByText('טוען בחירות…')).toBeInTheDocument();
  });

  it('renders an error state when the elections query fails', async () => {
    mockApi({ electionsReject: true });
    renderHome();

    expect(await screen.findByText('שגיאה בטעינת הבחירות')).toBeInTheDocument();
    expect(screen.getByText('נסו לרענן את הדף.')).toBeInTheDocument();
  });
});
