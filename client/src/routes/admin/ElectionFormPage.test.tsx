import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/renderWithProviders';

const post = vi.fn();
vi.mock('@/lib/api', () => ({
  useApi: () => ({ get: vi.fn(), post, patch: vi.fn(), delete: vi.fn() }),
  api: { get: vi.fn() },
}));

import ElectionFormPage from '@/routes/admin/ElectionFormPage';

afterEach(() => {
  vi.clearAllMocks();
});

describe('ElectionFormPage', () => {
  it('shows a Hebrew validation error when nameHe is empty on submit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ElectionFormPage />, {
      initialEntries: ['/admin/elections/new'],
    });

    await user.click(screen.getByRole('button', { name: 'צור בחירות' }));

    expect(await screen.findByText('יש להזין שם לבחירות')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('computes an absolute revealAt from the offset and submits', async () => {
    const user = userEvent.setup();
    post.mockResolvedValueOnce({ data: { id: 'new-id' } });

    renderWithProviders(<ElectionFormPage />, {
      initialEntries: ['/admin/elections/new'],
    });

    await user.type(screen.getByLabelText('שם הבחירות'), 'הכנסת ה-26');
    await user.type(screen.getByLabelText('מועד נעילת התחזיות'), '2026-06-26T20:00');

    await user.click(screen.getByRole('button', { name: 'צור בחירות' }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const [url, payload] = post.mock.calls[0];
    expect(url).toBe('/api/admin/elections');
    expect(payload.nameHe).toBe('הכנסת ה-26');
    // revealAt should be lockAt + 2 minutes (the default offset).
    const lock = new Date(payload.lockAt).getTime();
    const reveal = new Date(payload.revealAt).getTime();
    expect(reveal - lock).toBe(2 * 60000);
  });
});
