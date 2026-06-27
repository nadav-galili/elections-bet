import { screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/renderWithProviders';

const post = vi.fn();
vi.mock('@/lib/api', () => ({
  useApi: () => ({ get: vi.fn(), post, patch: vi.fn(), delete: vi.fn() }),
  api: { get: vi.fn() },
}));

vi.mock('@clerk/react', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true }),
  SignInButton: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

import JoinPage from '@/routes/groups/JoinPage';

function renderJoin() {
  return renderWithProviders(
    <Routes>
      <Route path="/join/:token" element={<JoinPage />} />
      <Route path="/groups/:id" element={<div>עמוד הקבוצה</div>} />
    </Routes>,
    { initialEntries: ['/join/tok-abc'] },
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('JoinPage', () => {
  it('auto-joins exactly once and navigates to the group on success', async () => {
    post.mockResolvedValueOnce({ data: { id: 'g1' } });

    renderJoin();

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith('/api/groups/join/tok-abc');
    expect(await screen.findByText('עמוד הקבוצה')).toBeInTheDocument();
  });

  it('renders the Hebrew error card when the join fails', async () => {
    post.mockRejectedValueOnce(new Error('bad token'));

    renderJoin();

    expect(await screen.findByText('ההצטרפות לקבוצה נכשלה')).toBeInTheDocument();
    expect(screen.getByText('ייתכן שהקישור אינו תקין או שפג תוקפו.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'חזרה לקבוצות' })).toBeInTheDocument();
  });
});
