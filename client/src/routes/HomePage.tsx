import { Show, SignInButton, useUser } from '@clerk/react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Loader2, Sparkles, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, useApi } from '@/lib/api';
import { usePick, usePlayerElections } from '@/lib/pick/hooks';
import type { PlayerElection } from '@/lib/pick/types';
import { Countdown } from '@/components/Countdown';
import { ErrorState, LoadingState } from '@/components/states';
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
      מזהה משתמש בשרת:{' '}
      <span className="font-mono" dir="ltr" style={{ unicodeBidi: 'isolate' }}>
        {data?.id ?? '—'}
      </span>{' '}
      · תפקיד: {data?.role}
    </p>
  );
}

function pickActive(elections: PlayerElection[]): PlayerElection {
  const now = Date.now();
  return (
    elections.find((e) => e.lockAt === null || new Date(e.lockAt).getTime() > now) ?? elections[0]
  );
}

function ActiveElectionCta() {
  const electionsQuery = usePlayerElections();
  const elections = electionsQuery.data;
  const active = elections && elections.length > 0 ? pickActive(elections) : undefined;

  // Always call the hook; an empty id keeps the query disabled until we know the election.
  const pickQuery = usePick(active?.id ?? '');

  if (electionsQuery.isLoading) {
    return <LoadingState label="טוען בחירות…" />;
  }
  if (electionsQuery.isError) {
    return (
      <ErrorState
        title="שגיאה בטעינת הבחירות"
        description="נסו לרענן את הדף."
        onRetry={() => void electionsQuery.refetch()}
      />
    );
  }
  if (!active) return null;

  const locked = active.lockAt !== null && new Date(active.lockAt).getTime() <= Date.now();
  const hasPick = Boolean(pickQuery.data?.submittedAt);
  const showFlag = !locked && !pickQuery.isLoading && !hasPick;

  return (
    <div className="space-y-4">
      {showFlag && (
        <div className="mx-auto flex max-w-md items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-primary/5 px-4 py-3 text-base font-medium text-foreground">
          <Sparkles className="size-5 text-primary" />
          טרם הגשת תחזית — זה הזמן לחזות את חלוקת המנדטים.
        </div>
      )}

      <Button asChild size="lg">
        <Link to={`/elections/${active.id}/pick`}>שמירת תחזית</Link>
      </Button>

      <Countdown to={active.lockAt} className="mx-auto max-w-md" />
    </div>
  );
}

export default function HomePage() {
  const { user } = useUser();

  return (
    <div className="space-y-6 py-10 text-center">
      <h1 className="text-4xl font-extrabold tracking-tight">חזו את תוצאות הבחירות</h1>
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
          <p className="text-lg font-medium">שלום, {user?.firstName ?? 'אורח'}</p>
          <ActiveElectionCta />
          <MyAccount />
        </div>
      </Show>
    </div>
  );
}
