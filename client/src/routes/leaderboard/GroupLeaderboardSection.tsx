import { useState } from 'react';
import { ChevronLeft, ChevronRight, Trophy, Users } from 'lucide-react';
import { useGroupLeaderboard } from '@/lib/leaderboard/hooks';
import { useMe } from '@/lib/me/hooks';
import { Button } from '@/components/ui/button';
import { LoadingState, ErrorState, EmptyState } from '@/components/states';
import { LeaderboardTable } from './LeaderboardTable';

const PAGE_SIZE = 50;

export function GroupLeaderboardSection({ groupId }: { groupId: string }) {
  const { data: me } = useMe();
  const [offset, setOffset] = useState(0);
  const { data, isLoading, isError, refetch } = useGroupLeaderboard(groupId, {
    limit: PAGE_SIZE,
    offset,
  });

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError || !data) {
    return (
      <ErrorState
        title="שגיאה בטעינת טבלת הדירוג"
        description="נסו לרענן את הדף."
        onRetry={() => refetch()}
      />
    );
  }

  if (!data.published) {
    // Distinguish "no election running" from "active but not yet published".
    if (data.state === 'no_active') {
      return <EmptyState icon={Trophy} title="אין בחירות פעילות כרגע." />;
    }
    return (
      <EmptyState
        icon={Users}
        title="הטבלה תיחשף לאחר פרסום התוצאות"
        description={`הניקוד יופיע לאחר שמנהל המערכת יפרסם תוצאות (מדגם או סופיות). ${data.participantCount} חברים הגישו תחזית עד כה`}
      />
    );
  }

  if (data.rows.length === 0 && offset === 0) {
    return <EmptyState icon={Users} title="אין עדיין משתתפים מדורגים בקבוצה זו." />;
  }

  return (
    <div className="space-y-4">
      {data.yourRank !== null && (
        <div className="flex items-center gap-2 rounded-2xl border border-candy-butter/40 bg-candy-butter/10 p-4 text-base font-medium">
          <span className="inline-flex size-8 items-center justify-center rounded-xl bg-candy-butter text-ink">
            <Trophy className="size-4" />
          </span>
          המקום שלך בקבוצה: <span className="font-bold tabular-nums">{data.yourRank}</span> מתוך{' '}
          <span className="font-bold tabular-nums">{data.totalCount}</span>
        </div>
      )}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <LeaderboardTable
          rows={data.rows}
          currentUserId={me?.id ?? null}
          yourRank={data.yourRank}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={offset === 0}
          onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
        >
          <ChevronRight className="size-4" />
          הקודם
        </Button>
        <span className="text-sm text-muted-foreground tabular-nums">
          {Math.min(offset + 1, data.totalCount)}–
          {Math.min(offset + data.rows.length, data.totalCount)} מתוך {data.totalCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={offset + PAGE_SIZE >= data.totalCount}
          onClick={() => setOffset((o) => o + PAGE_SIZE)}
        >
          הבא
          <ChevronLeft className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export default GroupLeaderboardSection;
