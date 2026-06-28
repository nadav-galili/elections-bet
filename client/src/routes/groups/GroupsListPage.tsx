import { AlertCircle, ArrowLeft, Check, Copy, Plus, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useGroups } from '@/lib/groups/hooks';
import { Button } from '@/components/ui/button';
import { Reveal } from '@/components/candy/Reveal';
import { useDarkSurface } from '@/components/candy/useDarkSurface';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { formatDate } from '@/lib/time';

function inviteLink(token: string) {
  return `${window.location.origin}/join/${token}`;
}

/** Rotating candy accents so a wall of group cards reads playful, not uniform. */
const AVATAR_TONES = ['bg-candy-peach', 'bg-candy-mint', 'bg-candy-butter'];

export default function GroupsListPage() {
  const { data, isLoading, isError, refetch } = useGroups();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  useDarkSurface();

  const handleCopy = async (group: { id: string; inviteToken: string }) => {
    const url = inviteLink(group.inviteToken);
    try {
      await navigator.clipboard.writeText(url);
      setCopyError(null);
      setCopiedId(group.id);
      setTimeout(() => setCopiedId((current) => (current === group.id ? null : current)), 2000);
    } catch {
      setCopiedId(null);
      setCopyError(url);
    }
  };

  return (
    <div className="theme-candy space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            הקבוצות שלי
          </h1>
          <p className="text-lg text-muted-foreground">
            כל החבורות שבהן אתם מתחרים על הניחוש המדויק ביותר.
          </p>
        </div>
        <Button asChild size="lg" className="h-12 shrink-0 px-6 text-base">
          <Link to="/groups/new">
            <Plus className="size-4" />
            צור קבוצה חדשה
          </Link>
        </Button>
      </div>

      {isLoading && <LoadingState label="טוען קבוצות…" />}

      {isError && (
        <ErrorState
          title="שגיאה בטעינת הקבוצות"
          description="נסו לרענן את הדף."
          onRetry={() => refetch()}
        />
      )}

      {copyError && (
        <div className="flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="size-4" />
          העתקת הקישור נכשלה. העתיקו ידנית:{' '}
          <span dir="ltr" className="font-mono [unicode-bidi:isolate]">
            {copyError}
          </span>
        </div>
      )}

      {!isLoading && !isError && data && data.length === 0 && (
        <EmptyState
          icon={Users}
          title="עדיין לא נוצרו קבוצות."
          description="צרו קבוצה חדשה או הצטרפו לקבוצה קיימת באמצעות קישור הזמנה."
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/groups/new">צרו את הקבוצה הראשונה</Link>
            </Button>
          }
        />
      )}

      {!isLoading && !isError && data && data.length > 0 && (
        <div className="grid auto-rows-fr grid-flow-dense gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((group, i) => {
            const members = group._count?.memberships ?? 0;
            const copied = copiedId === group.id;
            return (
              <Reveal key={group.id} delay={(i % 6) * 70}>
                <article className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-500 hover:-translate-y-1 hover:shadow-md">
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={`flex size-12 items-center justify-center rounded-xl font-display text-xl font-bold text-ink ${
                        AVATAR_TONES[i % AVATAR_TONES.length]
                      } transition-transform duration-500 group-hover:scale-110`}
                      aria-hidden
                    >
                      {group.nameHe.trim().charAt(0) || '?'}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground">
                      <Users className="size-4" />
                      <span className="font-mono tabular-nums">{members}</span>
                      חברים
                    </span>
                  </div>

                  <h2 className="mt-5 font-display text-xl font-semibold">
                    <Link
                      to={`/groups/${group.id}`}
                      className="underline-offset-4 hover:underline focus-visible:underline"
                    >
                      {group.nameHe}
                    </Link>
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    נוצרה ב־
                    <span className="tabular-nums">{formatDate(group.createdAt)}</span>
                  </p>

                  <div className="mt-auto flex items-center gap-2 pt-5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(group)}
                      className="gap-2"
                    >
                      {copied ? (
                        <>
                          <Check className="size-3 text-emerald-600" />
                          הועתק
                        </>
                      ) : (
                        <>
                          <Copy className="size-3" />
                          העתק קישור
                        </>
                      )}
                    </Button>
                    <Button asChild variant="outline" size="sm" className="ms-auto">
                      <Link to={`/groups/${group.id}`}>
                        פרטים
                        <ArrowLeft className="size-3" />
                      </Link>
                    </Button>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      )}
    </div>
  );
}
