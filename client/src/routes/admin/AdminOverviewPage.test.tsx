import { screen } from '@testing-library/react';
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
});
