import { Show, SignInButton, UserButton } from '@clerk/react';
import { useQuery } from '@tanstack/react-query';
import { Component, type ReactNode } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useApi } from '@/lib/api';
import { ErrorState } from '@/components/states';
import { Button } from '@/components/ui/button';

/** Catches render errors in the routed page so a crash doesn't blank the whole app. */
class RouteErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) {
      return (
        <ErrorState title="שגיאה בטעינת הדף" description="נסו לרענן את הדף." onRetry={this.reset} />
      );
    }
    return this.props.children;
  }
}

/** Shown only to signed-in super-admins: a link into the admin surface. */
function AdminNavLink() {
  const apiClient = useApi();
  const { data } = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await apiClient.get('/api/me')).data as { id: string; role: string },
    retry: false,
  });

  if (data?.role !== 'SUPER_ADMIN') return null;

  return (
    <Button asChild variant="ghost" size="sm">
      <Link to="/admin">ניהול</Link>
    </Button>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-extrabold">
            בט בחירות
          </Link>
          <div className="flex items-center gap-3">
            <Show when="signed-out">
              <SignInButton mode="modal">
                <Button size="sm">התחברות</Button>
              </SignInButton>
            </Show>
            <Show when="signed-in">
              <Button asChild variant="ghost" size="sm">
                <Link to="/groups">הקבוצות שלי</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to="/leaderboard">טבלת דירוג</Link>
              </Button>
              <AdminNavLink />
              <UserButton />
            </Show>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <RouteErrorBoundary>
          <Outlet />
        </RouteErrorBoundary>
      </main>
    </div>
  );
}
