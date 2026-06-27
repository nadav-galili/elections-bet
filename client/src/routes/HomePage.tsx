import { Show, SignInButton, useUser } from '@clerk/react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Sparkles,
  Target,
  Trophy,
  Users,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, useApi } from '@/lib/api';
import { usePick, usePlayerElections } from '@/lib/pick/hooks';
import type { PlayerElection } from '@/lib/pick/types';
import { Countdown } from '@/components/Countdown';
import { Marquee } from '@/components/candy/Marquee';
import { Reveal } from '@/components/candy/Reveal';
import { useDarkSurface } from '@/components/candy/useDarkSurface';
import { ErrorState, LoadingState } from '@/components/states';
import { Button } from '@/components/ui/button';

/** Public-knowledge party lineup, used purely as ambient marquee decoration. */
const PARTY_NAMES = [
  'הליכוד',
  'יש עתיד',
  'הציונות הדתית',
  'המחנה הממלכתי',
  'ש"ס',
  'יהדות התורה',
  'ישראל ביתנו',
  'רע"ם',
  'חד"ש-תע"ל',
  'העבודה',
];

const VALUE_TILES = [
  {
    icon: Target,
    dot: 'bg-candy-mint',
    title: 'חוזים מנדטים',
    body: 'מחלקים 120 מנדטים בין המפלגות — בדיוק כמו ועדת הבחירות, רק לפני כולם.',
  },
  {
    icon: Users,
    dot: 'bg-candy-peach',
    title: 'מתחרים מול חברים',
    body: 'פותחים קבוצה, שולחים קישור הזמנה, ורואים מי באמת מבין בפוליטיקה.',
  },
  {
    icon: Trophy,
    dot: 'bg-candy-butter',
    title: 'מטפסים בטבלה',
    body: 'ככל שאתם קרובים לתוצאה האמיתית, כך תזכו בניקוד גבוה יותר ובבונוסים.',
  },
] as const;

function HealthBadge() {
  const { isLoading, isError } = useQuery({
    queryKey: ['health'],
    queryFn: async () => (await api.get('/health')).data,
    retry: false,
  });

  const base =
    'inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-medium';

  if (isLoading) {
    return (
      <span className={`${base} text-white/70`}>
        <Loader2 className="size-4 animate-spin" /> בודק חיבור לשרת…
      </span>
    );
  }
  if (isError) {
    return (
      <span className={`${base} text-red-200`}>
        <XCircle className="size-4" /> אין חיבור לשרת
      </span>
    );
  }
  return (
    <span className={`${base} text-white/80`}>
      <CheckCircle2 className="size-4 text-candy-mint" /> מחובר לשרת
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
        <div className="mx-auto flex max-w-md items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-base font-medium text-white">
          <Sparkles className="size-5 text-candy-butter" />
          טרם הגשת תחזית — זה הזמן לחזות את חלוקת המנדטים.
        </div>
      )}

      <Button asChild size="lg" className="h-12 px-8 text-base shadow-lg shadow-black/20">
        <Link to={`/elections/${active.id}/pick`}>
          שמירת תחזית
          <ArrowLeft className="size-4" />
        </Link>
      </Button>

      <Countdown to={active.lockAt} className="mx-auto max-w-md text-white/70" />
    </div>
  );
}

export default function HomePage() {
  const { user } = useUser();
  useDarkSurface();

  return (
    <div className="theme-candy space-y-16 overflow-x-clip pb-12 sm:space-y-24">
      <section className="relative -mx-4 overflow-hidden rounded-[2rem] bg-ink px-5 pt-14 pb-16 text-white sm:mx-0 sm:px-10 sm:pt-20">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="animate-candy-float absolute -top-12 -left-16 size-72 rounded-full bg-candy-peach/30 blur-3xl" />
          <div className="animate-candy-float absolute top-20 -right-12 size-64 rounded-full bg-candy-mint/25 blur-3xl [animation-delay:1.5s]" />
          <div className="animate-candy-float absolute right-1/3 -bottom-10 size-60 rounded-full bg-candy-butter/20 blur-3xl [animation-delay:3s]" />
        </div>

        <div className="relative mx-auto max-w-4xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-semibold text-white/80">
            <Sparkles className="size-4 text-candy-butter" />
            משחק הניחושים של הכנסת
          </span>

          <h1 className="mt-7 font-display text-[clamp(2.6rem,6vw,4.5rem)] leading-[1.05] font-bold tracking-tight text-balance">
            חזו את תוצאות הבחירות
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-white/70 sm:text-xl">
            חזו את חלוקת המנדטים, התחרו מול החברים, וראו מי הכי קרוב לתוצאות האמיתיות.
          </p>

          <div className="mt-9">
            <Show when="signed-out">
              <SignInButton mode="modal">
                <Button size="lg" className="h-12 px-8 text-base shadow-lg shadow-black/20">
                  התחברות כדי להתחיל
                  <ArrowLeft className="size-4" />
                </Button>
              </SignInButton>
            </Show>

            <Show when="signed-in">
              <div className="space-y-5">
                <p className="text-lg font-medium text-white/90">
                  שלום, {user?.firstName ?? 'אורח'}
                </p>
                <ActiveElectionCta />
              </div>
            </Show>
          </div>

          <div className="mt-8 flex justify-center">
            <HealthBadge />
          </div>
        </div>
      </section>

      <section className="space-y-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            איך משחקים
            <span className="ms-2 inline-flex size-8 translate-y-1 items-center justify-center rounded-full bg-candy-mint align-baseline">
              <Sparkles className="size-4 text-ink" />
            </span>
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            שלושה צעדים מהחיזוי הראשון ועד לראש טבלת הדירוג.
          </p>
        </Reveal>

        <div className="grid auto-rows-fr grid-flow-dense gap-4 md:grid-cols-3">
          {VALUE_TILES.map((tile, i) => (
            <Reveal key={tile.title} delay={i * 100}>
              <article className="group h-full rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-500 hover:-translate-y-1 hover:shadow-md">
                <span
                  className={`inline-flex size-12 items-center justify-center rounded-xl ${tile.dot} transition-transform duration-500 group-hover:scale-110`}
                >
                  <tile.icon className="size-6 text-ink" />
                </span>
                <h3 className="mt-5 font-display text-xl font-semibold">{tile.title}</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">{tile.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <p className="text-center text-sm font-semibold tracking-wide text-muted-foreground">
          כל המפלגות על השולחן
        </p>
        <Marquee items={PARTY_NAMES} />
      </section>

      <Reveal>
        <section className="-mx-4 overflow-hidden rounded-[2rem] bg-candy-peach px-6 py-12 text-center text-ink sm:mx-0 sm:px-10 sm:py-16">
          <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            מוכנים לגלות מי הכי קרוב לתוצאה?
          </h2>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Show when="signed-out">
              <SignInButton mode="modal">
                <Button size="lg" className="h-12 px-8 text-base">
                  התחברות כדי להתחיל
                  <ArrowLeft className="size-4" />
                </Button>
              </SignInButton>
            </Show>
            <Show when="signed-in">
              <Button asChild size="lg" className="h-12 px-8 text-base">
                <Link to="/groups">
                  לקבוצות שלי
                  <ArrowLeft className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 border-ink/20 bg-white/40 px-8 text-base text-ink hover:bg-white/70"
              >
                <Link to="/leaderboard">טבלת דירוג</Link>
              </Button>
            </Show>
          </div>
        </section>
      </Reveal>

      <Show when="signed-in">
        <div className="text-center">
          <MyAccount />
        </div>
      </Show>
    </div>
  );
}
