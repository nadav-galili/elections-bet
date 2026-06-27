import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Countdown } from './Countdown';

describe('Countdown', () => {
  it('shows the label and a ticking clock for a future target, with aria-live', () => {
    const future = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // +2h
    render(<Countdown to={future} />);

    const node = screen.getByText(/התחזיות ננעלות בעוד/);
    expect(node).toBeInTheDocument();
    expect(node).toHaveAttribute('aria-live', 'polite');
    // HH:MM:SS clock somewhere in the node
    expect(node.textContent).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it('honors a custom label', () => {
    const future = new Date(Date.now() + 60 * 1000).toISOString();
    render(<Countdown to={future} label="נשאר" />);
    expect(screen.getByText(/נשאר/)).toBeInTheDocument();
  });

  it('shows the "not scheduled" note when `to` is null', () => {
    render(<Countdown to={null} />);
    expect(screen.getByText('טרם נקבע מועד נעילה')).toBeInTheDocument();
  });

  it('shows the ended label for a past target', () => {
    const past = new Date(Date.now() - 60 * 1000).toISOString();
    render(<Countdown to={past} />);
    expect(screen.getByText('התחזיות ננעלו')).toBeInTheDocument();
  });

  it('honors a custom ended label for a past target', () => {
    const past = new Date(Date.now() - 60 * 1000).toISOString();
    render(<Countdown to={past} endedLabel="הסתיים" />);
    expect(screen.getByText('הסתיים')).toBeInTheDocument();
  });
});
