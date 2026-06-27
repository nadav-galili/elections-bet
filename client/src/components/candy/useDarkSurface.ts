import { useEffect } from 'react';

/**
 * While a page using the DESIGN.md surface is mounted, flips the whole app
 * chrome (header, gutters, body) to the dark surface (#27272A) by adding a
 * body class — so the dark page isn't a light-framed rectangle. Removed on
 * unmount, so other routes keep the neutral light theme.
 */
export function useDarkSurface() {
  useEffect(() => {
    document.body.classList.add('surface-dark');
    return () => document.body.classList.remove('surface-dark');
  }, []);
}
