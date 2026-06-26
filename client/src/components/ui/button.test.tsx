import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('renders its Hebrew label as an accessible button', () => {
    render(<Button>התחברות</Button>);
    expect(screen.getByRole('button', { name: 'התחברות' })).toBeInTheDocument();
  });

  it('applies the destructive variant classes', () => {
    render(<Button variant="destructive">מחיקה</Button>);
    expect(screen.getByRole('button', { name: 'מחיקה' })).toHaveClass('bg-destructive');
  });
});
