import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { AdminOverview } from '@/lib/admin/types';

const get = vi.fn();
vi.mock('@/lib/api', () => ({
  useApi: () => ({ get, post: vi.fn(), patch: vi.fn(), delete: vi.fn() }),
  api: { get: vi.fn() },
}));

import AdminOverviewPage from '@/routes/admin/AdminOverviewPage';

afterEach(() => {
  vi.clearAllMocks();
});

describe('AdminOverviewPage', () => {
  it('renders the stat numbers from mocked data', async () => {
    const overview: AdminOverview = {
      users: 42,
      groups: 7,
      elections: 3,
      activeElection: { id: 'e1', nameHe: 'הכנסת ה-26' },
      picksSubmitted: 21,
      participationRate: 0.5,
    };
    get.mockResolvedValueOnce({ data: overview });

    renderWithProviders(<AdminOverviewPage />, { initialEntries: ['/admin/overview'] });

    expect(await screen.findByText('42')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('21')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('הכנסת ה-26')).toBeInTheDocument();
  });

  it('shows an error state with a retry that refetches', async () => {
    get.mockRejectedValueOnce(new Error('boom'));

    renderWithProviders(<AdminOverviewPage />, { initialEntries: ['/admin/overview'] });

    expect(await screen.findByText('שגיאה בטעינת הנתונים')).toBeInTheDocument();

    const overview: AdminOverview = {
      users: 1,
      groups: 0,
      elections: 0,
      activeElection: null,
      picksSubmitted: 0,
      participationRate: 0,
    };
    get.mockResolvedValueOnce({ data: overview });
    await userEvent.click(screen.getByRole('button', { name: 'נסו שוב' }));

    await waitFor(() => expect(screen.getByText('משתמשים')).toBeInTheDocument());
  });
});
