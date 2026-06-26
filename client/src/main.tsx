import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/react';
import { shadcn } from '@clerk/ui/themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import './index.css';
import { routes } from './routes';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const rootEl = document.getElementById('root')!;

if (!PUBLISHABLE_KEY) {
  // Render a clear message instead of a blank page when the app isn't configured.
  createRoot(rootEl).render(
    <StrictMode>
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center text-foreground">
        <div className="max-w-md space-y-3">
          <h1 className="text-2xl font-extrabold">חסר מפתח Clerk</h1>
          <p className="text-muted-foreground">
            צרו קובץ <code className="rounded bg-muted px-1">client/.env</code> והגדירו את{' '}
            <code className="rounded bg-muted px-1">VITE_CLERK_PUBLISHABLE_KEY</code> ואת{' '}
            <code className="rounded bg-muted px-1">VITE_API_BASE_URL</code>, ואז הריצו מחדש{' '}
            <code className="rounded bg-muted px-1">bun run dev</code>.
          </p>
        </div>
      </div>
    </StrictMode>,
  );
} else {
  const queryClient = new QueryClient();
  const router = createBrowserRouter(routes);

  createRoot(rootEl).render(
    <StrictMode>
      <ClerkProvider
        publishableKey={PUBLISHABLE_KEY}
        afterSignOutUrl="/"
        appearance={{ theme: shadcn }}
      >
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </ClerkProvider>
    </StrictMode>,
  );
}
