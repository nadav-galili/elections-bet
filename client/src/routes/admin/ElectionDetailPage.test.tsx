import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { ElectionDetail } from '@/lib/admin/types';

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
const del = vi.fn();
vi.mock('@/lib/api', () => ({
  useApi: () => ({ get, post, patch, delete: del }),
  api: { get: vi.fn() },
}));

import ElectionDetailPage from '@/routes/admin/ElectionDetailPage';

afterEach(() => {
  vi.clearAllMocks();
});

const partyA = {
  id: 'p1',
  electionId: 'e1',
  nameHe: 'מפלגה א',
  logoUrl: null,
  bloc: 'A' as const,
  displayOrder: 1,
  actualMandates: null,
  baselineMandates: null,
};
const partyB = {
  id: 'p2',
  electionId: 'e1',
  nameHe: 'מפלגה ב',
  logoUrl: null,
  bloc: 'B' as const,
  displayOrder: 2,
  actualMandates: null,
  baselineMandates: null,
};

function detail(overrides: Partial<ElectionDetail> = {}): ElectionDetail {
  return {
    id: 'e1',
    nameHe: 'הכנסת ה-26',
    lockAt: null,
    revealAt: null,
    resultsStatus: 'NONE',
    resultsPublishedAt: null,
    blocALabel: null,
    blocBLabel: null,
    createdAt: '2026-06-01T00:00:00.000Z',
    parties: [partyA, partyB],
    ...overrides,
  };
}

function mockGet(electionDetail: ElectionDetail) {
  get.mockResolvedValue({ data: electionDetail });
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/admin/elections/:id" element={<ElectionDetailPage />} />
    </Routes>,
    { initialEntries: ['/admin/elections/e1'] },
  );
}

describe('ElectionDetailPage — ResultsManager', () => {
  it('renders a results input per party and a live remaining counter', async () => {
    mockGet(detail());
    renderPage();

    // One input per party (prefilled from actualMandates ?? 0).
    const inputA = await screen.findByLabelText('מפלגה א');
    expect(inputA).toBeInTheDocument();
    expect(screen.getByLabelText('מפלגה ב')).toBeInTheDocument();

    // The remaining counter is visible and starts at 120.
    expect(screen.getByText('נותרו: 120')).toBeInTheDocument();
  });

  it('updates the remaining counter as actual mandates are typed', async () => {
    const user = userEvent.setup();
    mockGet(detail());
    renderPage();

    const inputA = await screen.findByLabelText('מפלגה א');
    await user.clear(inputA);
    await user.type(inputA, '60');

    expect(await screen.findByText('נותרו: 60')).toBeInTheDocument();
  });

  it('shows the prominent מדגם indicator when resultsStatus is PROVISIONAL', async () => {
    mockGet(detail({ resultsStatus: 'PROVISIONAL' }));
    renderPage();

    expect(await screen.findByText('מדגם')).toBeInTheDocument();
  });

  it('shows the prominent סופי indicator and a recompute action when FINAL', async () => {
    mockGet(detail({ resultsStatus: 'FINAL' }));
    renderPage();

    expect(await screen.findByText('סופי')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /חישוב מחדש/ })).toBeInTheDocument();
  });

  it('shows the ללא תוצאות indicator when resultsStatus is NONE', async () => {
    mockGet(detail());
    renderPage();

    expect(await screen.findByText('ללא תוצאות')).toBeInTheDocument();
  });

  it('opens the ConfirmDialog when a publish button is clicked', async () => {
    const user = userEvent.setup();
    mockGet(detail());
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'פרסום תוצאות סופיות' }));

    // The confirm dialog appears with the recompute/reveal explanation.
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/יחשב את הניקוד הסופי ויחשוף אותו לכל המשתתפים/)).toBeInTheDocument();
  });
});
