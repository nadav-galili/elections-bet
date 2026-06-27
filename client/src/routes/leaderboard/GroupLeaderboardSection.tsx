import { useState } from 'react';
import { AlertCircle, Loader2, Trophy, Users } from 'lucide-react';
import { useGroupLeaderboard } from '@/lib/leaderboard/hooks';
import { useMe } from '@/lib/me/hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LeaderboardTable } from './LeaderboardTable';

const PAGE_SIZE = 50;

export function GroupLeaderboardSection({ groupId }: { groupId: string }) {
  const { data: me } = useMe();
  const [offset, setOffset] = useState(0);
  const { data, isLoading, isError } = useGroupLeaderboard(groupId, { limit: PAGE_SIZE, offset });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        <AlertCircle className="size-4" />
        שגיאה בטעינת טבלת הדירוג. נסו לרענן את הדף.
      </div>
    );
  }

  if (!data.published) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <Users className="size-8 text-muted-foreground" />
          <p className="text-lg font-semibold">הטבלה תיחשף לאחר פרסום התוצאות</p>
          <p className="text-base text-muted-foreground">
            {data.participantCount} חברים הגישו תחזית עד כה
          </p>
        </CardContent>
      </Card>
    );
  }

  if (data.rows.length === 0 && offset === 0) {
    return (
      <div className="rounded-md border border-dashed p-4 text-base text-muted-foreground">
        אין עדיין משתתפים מדורגים בקבוצה זו.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.yourRank !== null && (
        <div className="flex items-center gap-2 rounded-md border bg-secondary/40 p-3 text-base font-medium">
          <Trophy className="size-4" />
          המקום שלך בקבוצה: <span className="font-bold tabular-nums">
            {data.yourRank}
          </span> מתוך <span className="font-bold tabular-nums">{data.total}</span>
        </div>
      )}
      <LeaderboardTable rows={data.rows} currentUserId={me?.id ?? null} yourRank={data.yourRank} />

      <div className="flex items-center justify-between gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={offset === 0}
          onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
        >
          הקודם
        </Button>
        <span className="text-sm text-muted-foreground tabular-nums">
          {Math.min(offset + 1, data.total)}–{Math.min(offset + data.rows.length, data.total)} מתוך{' '}
          {data.total}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={offset + PAGE_SIZE >= data.total}
          onClick={() => setOffset((o) => o + PAGE_SIZE)}
        >
          הבא
        </Button>
      </div>
    </div>
  );
}

export default GroupLeaderboardSection;
