import { Show, SignInButton, useUser } from '@clerk/react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  LogIn,
  Sparkles,
  Target,
  Trophy,
  Users,
  Vote,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, useApi } from '@/lib/api';
import { usePick, usePlayerElections } from '@/lib/pick/hooks';
import type { PlayerElection } from '@/lib/pick/types';
import { Countdown } from '@/components/Countdown';
import { FlagOfIsrael } from '@/components/candy/FlagOfIsrael';
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

      <Button
        asChild
        size="lg"
        className="h-12 px-8 text-base shadow-lg shadow-black/20 transition-transform active:translate-y-px"
      >
        <Link to={`/elections/${active.id}/pick`}>
          <Vote className="size-4" />
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
      <section className="relative pt-4 pb-2 sm:pt-8">
        {/* Quiet ambient glow — authentic flag-blue with a touch of mint, kept behind the split. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 right-[-8%] size-[26rem] rounded-full bg-[#0038B8]/20 blur-3xl" />
          <div className="absolute bottom-[-30%] left-[-6%] size-80 rounded-full bg-candy-mint/10 blur-3xl" />
        </div>

        <div className="relative grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          {/* Type — leads on the right in RTL */}
          <div className="max-w-xl text-start">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-semibold text-white/80">
              <span className="size-1.5 rounded-full bg-candy-blue" />
              תחזית הבחירות · הכנסת ה־26
            </span>

            <h1 className="mt-6 font-display text-[clamp(2.5rem,6.5vw,4.25rem)] leading-[1.04] font-bold tracking-tight text-balance text-white">
              חזו את תוצאות <span className="text-candy-blue">הבחירות</span>
            </h1>

            <p className="mt-5 max-w-md text-lg leading-relaxed text-white/70 sm:text-xl">
              חזו את חלוקת המנדטים, התחרו מול החברים, וראו מי הכי קרוב לתוצאות האמיתיות.
            </p>

            <div className="mt-8">
              <Show when="signed-out">
                <SignInButton mode="modal">
                  <Button
                    size="lg"
                    className="h-12 px-8 text-base shadow-lg shadow-black/20 transition-transform active:translate-y-px"
                  >
                    <LogIn className="size-4" />
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

            <div className="mt-8">
              <HealthBadge />
            </div>
          </div>

          {/* Signature: the Israeli flag emblem — leads on the left in RTL */}
          <div className="relative mx-auto w-full max-w-sm">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-6 rounded-[3rem] bg-[#0038B8]/25 blur-3xl"
            />
            <div className="animate-candy-float relative">
              <div className="overflow-hidden rounded-[1.75rem] bg-white p-2.5 shadow-[0_30px_70px_-25px_rgba(0,0,0,0.65)]">
                <FlagOfIsrael className="block w-full rounded-[1.15rem]" />
              </div>
              <div className="absolute -bottom-4 -left-3 flex items-center gap-2 rounded-2xl border border-black/5 bg-candy-butter px-4 py-2.5 text-ink shadow-lg shadow-black/30">
                <span className="font-display text-2xl font-bold tabular-nums">120</span>
                <span className="text-sm font-semibold leading-tight">
                  מנדטים
                  <br />
                  על המגרש
                </span>
              </div>
            </div>
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
                  <LogIn className="size-4" />
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
                <Link to="/leaderboard">
                  <Trophy className="size-4" />
                  טבלת דירוג
                </Link>
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
