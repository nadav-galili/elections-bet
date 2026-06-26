import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { Election } from '@/lib/admin/types';

const get = vi.fn();
vi.mock('@/lib/api', () => ({
  useApi: () => ({ get, post: vi.fn(), patch: vi.fn(), delete: vi.fn() }),
  api: { get: vi.fn() },
}));

import AdminElectionsPage from '@/routes/admin/AdminElectionsPage';

afterEach(() => {
  vi.clearAllMocks();
});

describe('AdminElectionsPage', () => {
  it('renders the elections list from mocked data', async () => {
    const elections: Election[] = [
      {
        id: 'e1',
        nameHe: 'הכנסת ה-26',
        lockAt: '2026-06-26T17:00:00.000Z',
        revealAt: '2026-06-26T17:02:00.000Z',
        resultsStatus: 'NONE',
        blocALabel: null,
        blocBLabel: null,
        createdAt: '2026-06-01T00:00:00.000Z',
        _count: { parties: 3 },
      },
    ];
    get.mockResolvedValueOnce({ data: elections });

    renderWithProviders(<AdminElectionsPage />, { initialEntries: ['/admin'] });

    expect(await screen.findByText('הכנסת ה-26')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('ללא תוצאות')).toBeInTheDocument();
  });

  it('shows the Hebrew empty state when there are no elections', async () => {
    get.mockResolvedValueOnce({ data: [] });

    renderWithProviders(<AdminElectionsPage />, { initialEntries: ['/admin'] });

    await waitFor(() => expect(screen.getByText('עדיין לא נוצרו בחירות.')).toBeInTheDocument());
  });
});
