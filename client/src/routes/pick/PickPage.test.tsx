import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { Pick, PlayerElectionDetail } from '@/lib/pick/types';

const get = vi.fn();
const put = vi.fn();
vi.mock('@/lib/api', () => ({
  useApi: () => ({ get, put, post: vi.fn(), patch: vi.fn(), delete: vi.fn() }),
  api: { get: vi.fn() },
}));

import PickPage from '@/routes/pick/PickPage';

afterEach(() => {
  vi.clearAllMocks();
});

const partyA = {
  id: 'p1',
  nameHe: 'מפלגה א',
  logoUrl: null,
  bloc: 'A' as const,
  displayOrder: 1,
};
const partyB = {
  id: 'p2',
  nameHe: 'מפלגה ב',
  logoUrl: null,
  bloc: 'B' as const,
  displayOrder: 2,
};

function detail(overrides: Partial<PlayerElectionDetail> = {}): PlayerElectionDetail {
  return {
    id: 'e1',
    nameHe: 'הכנסת ה-26',
    lockAt: null,
    revealAt: null,
    resultsStatus: 'NONE',
    blocALabel: null,
    blocBLabel: null,
    parties: [partyA, partyB],
    ...overrides,
  };
}

function mockGet(electionDetail: PlayerElectionDetail, pickOrNull: Pick | null) {
  get.mockImplementation((url: string) => {
    if (url === '/api/elections/e1') return Promise.resolve({ data: electionDetail });
    if (url === '/api/elections/e1/pick') return Promise.resolve({ data: pickOrNull });
    return Promise.reject(new Error('unexpected ' + url));
  });
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/elections/:id/pick" element={<PickPage />} />
    </Routes>,
    { initialEntries: ['/elections/e1/pick'] },
  );
}

describe('PickPage', () => {
  it('updates the live remaining counter as mandates are typed', async () => {
    const user = userEvent.setup();
    mockGet(detail(), null);
    renderPage();

    const inputA = await screen.findByLabelText('מפלגה א');
    await user.clear(inputA);
    await user.type(inputA, '60');
    expect(await screen.findByText('נותרו: 60')).toBeInTheDocument();

    const inputB = screen.getByLabelText('מפלגה ב');
    await user.clear(inputB);
    await user.type(inputB, '60');
    expect(await screen.findByText('נותרו: 0')).toBeInTheDocument();
  });

  it('disables the submit button when the total is not 120', async () => {
    const user = userEvent.setup();
    mockGet(detail(), null);
    renderPage();

    const inputA = await screen.findByLabelText('מפלגה א');
    await user.clear(inputA);
    await user.type(inputA, '60');

    expect(screen.getByRole('button', { name: 'שמירת תחזית' })).toBeDisabled();
  });

  it('shows an inline error when a value is 1–3', async () => {
    const user = userEvent.setup();
    mockGet(detail(), null);
    renderPage();

    const inputA = await screen.findByLabelText('מפלגה א');
    await user.clear(inputA);
    await user.type(inputA, '2');

    expect(await screen.findByText('יש להזין 0 או 4–120')).toBeInTheDocument();
  });

  it('renders a read-only frozen view once locked', async () => {
    mockGet(detail({ lockAt: '2020-01-01T20:00:00.000Z' }), null);
    renderPage();

    expect(await screen.findByText('לא הגשת תחזית')).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).toBeNull();
  });

  it('shows a loading state while data is fetching', () => {
    // Never resolves -> queries stay pending.
    get.mockImplementation(() => new Promise(() => {}));
    renderPage();

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).toBeNull();
  });

  it('shows an error state with a retry that refetches', async () => {
    const user = userEvent.setup();
    get.mockRejectedValue(new Error('boom'));
    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('שגיאה בטעינת התחזית');
    expect(alert).toHaveTextContent('נסו לרענן את הדף.');

    // Now succeed and retry — the form should appear.
    mockGet(detail(), null);
    await user.click(screen.getByRole('button', { name: 'נסו שוב' }));

    expect(await screen.findByLabelText('מפלגה א')).toBeInTheDocument();
  });

  it('renders the live countdown while the pick window is open', async () => {
    // A lock far in the future keeps the page editable and shows the countdown.
    mockGet(detail({ lockAt: '2999-01-01T20:00:00.000Z' }), null);
    renderPage();

    expect(await screen.findByText(/התחזיות ננעלות בעוד/)).toBeInTheDocument();
    expect(screen.getByLabelText('מפלגה א')).toBeInTheDocument();
  });

  it('shows the "start a group / invite friends" nudge after the FIRST pick locks', async () => {
    const user = userEvent.setup();
    // No existing submitted pick ⇒ this submission is the first pick.
    mockGet(detail(), null);
    put.mockResolvedValue({ data: { entries: [], submittedAt: '2026-01-01T00:00:00.000Z' } });
    renderPage();

    const inputA = await screen.findByLabelText('מפלגה א');
    await user.clear(inputA);
    await user.type(inputA, '60');
    const inputB = screen.getByLabelText('מפלגה ב');
    await user.clear(inputB);
    await user.type(inputB, '60');

    // Nudge is absent until the pick is actually submitted (fired at the brag moment).
    expect(screen.queryByText('פתחו קבוצה והזמינו חברים')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'שמירת תחזית' }));

    const nudge = await screen.findByRole('link', { name: 'פתחו קבוצה והזמינו חברים' });
    expect(nudge).toBeInTheDocument();
    expect(nudge).toHaveAttribute('href', '/groups');
  });

  it('does NOT show the first-pick nudge when re-saving an already-submitted pick', async () => {
    const user = userEvent.setup();
    // The player already had a submitted pick on load ⇒ no brag-moment nudge.
    mockGet(detail(), {
      submittedAt: '2026-01-01T00:00:00.000Z',
      entries: [
        { partyId: 'p1', mandates: 60 },
        { partyId: 'p2', mandates: 60 },
      ],
    });
    put.mockResolvedValue({ data: { entries: [], submittedAt: '2026-01-02T00:00:00.000Z' } });
    renderPage();

    const inputA = await screen.findByLabelText('מפלגה א');
    await user.clear(inputA);
    await user.type(inputA, '70');
    const inputB = screen.getByLabelText('מפלגה ב');
    await user.clear(inputB);
    await user.type(inputB, '50');

    await user.click(screen.getByRole('button', { name: 'שמירת תחזית' }));

    // The save badge appears, but the viral nudge must not (it is first-pick only).
    expect(await screen.findByText('נשמר')).toBeInTheDocument();
    expect(screen.queryByText('פתחו קבוצה והזמינו חברים')).toBeNull();
  });
});
