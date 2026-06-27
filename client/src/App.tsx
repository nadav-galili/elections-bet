import { Show, SignInButton, UserButton } from '@clerk/react';
import { useQuery } from '@tanstack/react-query';
import { Outlet, Link } from 'react-router-dom';
import { useApi } from '@/lib/api';
import { Button } from '@/components/ui/button';

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
            תחזית בחירות
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
        <Outlet />
      </main>
    </div>
  );
}
