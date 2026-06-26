import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '@/test/renderWithProviders';

const get = vi.fn();
vi.mock('@/lib/api', () => ({
  useApi: () => ({ get, post: vi.fn(), patch: vi.fn(), delete: vi.fn() }),
  api: { get: vi.fn() },
}));

import RequireSuperAdmin from '@/components/admin/RequireSuperAdmin';

afterEach(() => {
  vi.clearAllMocks();
});

function Harness() {
  return (
    <Routes>
      <Route path="/" element={<div>דף הבית</div>} />
      <Route
        path="/admin"
        element={
          <RequireSuperAdmin>
            <div>אזור ניהול</div>
          </RequireSuperAdmin>
        }
      />
    </Routes>
  );
}

describe('RequireSuperAdmin', () => {
  it('renders children for a SUPER_ADMIN', async () => {
    get.mockResolvedValueOnce({ data: { id: 'u1', role: 'SUPER_ADMIN' } });

    renderWithProviders(<Harness />, { initialEntries: ['/admin'] });

    expect(await screen.findByText('אזור ניהול')).toBeInTheDocument();
  });

  it('redirects a USER away from the admin surface', async () => {
    get.mockResolvedValueOnce({ data: { id: 'u2', role: 'USER' } });

    renderWithProviders(<Harness />, { initialEntries: ['/admin'] });

    await waitFor(() => expect(screen.getByText('דף הבית')).toBeInTheDocument());
    expect(screen.queryByText('אזור ניהול')).not.toBeInTheDocument();
  });

  it('redirects when /api/me errors', async () => {
    get.mockRejectedValueOnce(new Error('unauthorized'));

    renderWithProviders(<Harness />, { initialEntries: ['/admin'] });

    await waitFor(() => expect(screen.getByText('דף הבית')).toBeInTheDocument());
    expect(screen.queryByText('אזור ניהול')).not.toBeInTheDocument();
  });
});
