import { Show, SignInButton, useUser } from '@clerk/react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, useApi } from '@/lib/api';
import type { PlayerElection } from '@/lib/pick/types';
import { Button } from '@/components/ui/button';

function HealthBadge() {
  const { isLoading, isError } = useQuery({
    queryKey: ['health'],
    queryFn: async () => (await api.get('/health')).data,
    retry: false,
  });

  if (isLoading) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> בודק חיבור לשרת…
      </span>
    );
  }
  if (isError) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-destructive">
        <XCircle className="size-4" /> אין חיבור לשרת
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
      <CheckCircle2 className="size-4" /> מחובר לשרת
    </span>
  );
}

function MyAccount() {
  const apiClient = useApi();
  const { data, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await apiClient.get('/api/me')).data as { id: string; role: string },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">טוען פרופיל…</p>;
  return (
    <p className="text-sm text-muted-foreground">
      מזהה משתמש בשרת: <span className="font-mono">{data?.id ?? '—'}</span> · תפקיד: {data?.role}
    </p>
  );
}

function ActiveElectionCta() {
  const apiClient = useApi();
  const { data } = useQuery({
    queryKey: ['elections'],
    queryFn: async () => (await apiClient.get('/api/elections')).data as PlayerElection[],
  });

  if (!data || data.length === 0) return null;

  const now = Date.now();
  const active =
    data.find((e) => e.lockAt === null || new Date(e.lockAt).getTime() > now) ?? data[0];

  return (
    <Button asChild size="lg">
      <Link to={`/elections/${active.id}/pick`}>הגשת תחזית</Link>
    </Button>
  );
}

export default function HomePage() {
  const { user } = useUser();

  return (
    <div className="space-y-6 py-10 text-center">
      <h1 className="text-4xl font-extrabold tracking-tight">נחשו את תוצאות הבחירות</h1>
      <p className="mx-auto max-w-xl text-muted-foreground">
        חזו את חלוקת המנדטים, התחרו מול החברים, וראו מי הכי קרוב לתוצאות האמיתיות.
      </p>
      <div>
        <HealthBadge />
      </div>

      <Show when="signed-out">
        <SignInButton mode="modal">
          <Button size="lg">התחברות כדי להתחיל</Button>
        </SignInButton>
      </Show>

      <Show when="signed-in">
        <div className="space-y-4">
          <p className="text-lg font-medium">שלום, {user?.firstName ?? 'אורח'} 👋</p>
          <ActiveElectionCta />
          <MyAccount />
        </div>
      </Show>
    </div>
  );
}
