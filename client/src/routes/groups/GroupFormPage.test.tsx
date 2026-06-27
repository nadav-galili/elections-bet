import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/renderWithProviders';

const post = vi.fn();
vi.mock('@/lib/api', () => ({
  useApi: () => ({ get: vi.fn(), post, patch: vi.fn(), delete: vi.fn() }),
  api: { get: vi.fn() },
}));

import GroupFormPage from '@/routes/groups/GroupFormPage';

afterEach(() => {
  vi.clearAllMocks();
});

describe('GroupFormPage', () => {
  it('shows a Hebrew validation error when the name is empty on submit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GroupFormPage />, { initialEntries: ['/groups/new'] });

    await user.click(screen.getByRole('button', { name: 'צור קבוצה' }));

    expect(await screen.findByText('יש להזין שם לקבוצה')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('posts the trimmed name on a valid submit', async () => {
    const user = userEvent.setup();
    post.mockResolvedValueOnce({ data: { id: 'g1' } });

    renderWithProviders(<GroupFormPage />, { initialEntries: ['/groups/new'] });

    await user.type(screen.getByLabelText('שם הקבוצה'), '  המשפחה  ');
    await user.click(screen.getByRole('button', { name: 'צור קבוצה' }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith('/api/groups', { nameHe: 'המשפחה' });
  });
});
