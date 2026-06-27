import { useMemo, useState } from 'react';
import { AlertCircle, Check, Loader2, Pencil, Trophy, Users, X } from 'lucide-react';
import { usePlayerElections } from '@/lib/pick/hooks';
import type { PlayerElection } from '@/lib/pick/types';
import { useElectionLeaderboard } from '@/lib/leaderboard/hooks';
import { useMe, useUpdateDisplayName } from '@/lib/me/hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LeaderboardTable } from './LeaderboardTable';

const PAGE_SIZE = 50;

/** Sort by recency: latest lockAt first; null lockAt (undated) sorts last. */
function byMostRecent(a: PlayerElection, b: PlayerElection) {
  if (a.lockAt && b.lockAt) return b.lockAt.localeCompare(a.lockAt);
  if (a.lockAt) return -1;
  if (b.lockAt) return 1;
  return 0;
}

function DisplayNameEditor() {
  const { data: me } = useMe();
  const updateName = useUpdateDisplayName();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');

  const open = () => {
    setValue(me?.displayName ?? '');
    setEditing(true);
  };

  const save = () => {
    const trimmed = value.trim();
    if (trimmed.length === 0) return;
    updateName.mutate(trimmed, { onSuccess: () => setEditing(false) });
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-2 text-base">
        <span className="text-muted-foreground">השם שלך:</span>
        <span className="font-semibold">{me?.displayName || 'ללא שם'}</span>
        <Button variant="ghost" size="sm" onClick={open} className="gap-1">
          <Pencil className="size-3" />
          ערוך
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="שם תצוגה"
        maxLength={50}
        className="w-48"
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') setEditing(false);
        }}
      />
      <Button size="sm" onClick={save} disabled={updateName.isPending || value.trim().length === 0}>
        {updateName.isPending ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <Check className="size-3" />
        )}
        שמור
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
        <X className="size-3" />
        ביטול
      </Button>
      {updateName.isError && (
        <span className="text-sm text-destructive">עדכון השם נכשל. נסו שוב.</span>
      )}
    </div>
  );
}

export default function LeaderboardPage() {
  const { data: me } = useMe();
  const {
    data: elections,
    isLoading: electionsLoading,
    isError: electionsError,
  } = usePlayerElections();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  const sorted = useMemo(() => [...(elections ?? [])].sort(byMostRecent), [elections]);
  const activeId = selectedId ?? sorted[0]?.id ?? '';

  const {
    data,
    isLoading: boardLoading,
    isError: boardError,
  } = useElectionLeaderboard(activeId, { limit: PAGE_SIZE, offset });

  const onSelectElection = (id: string) => {
    setSelectedId(id);
    setOffset(0);
  };

  if (electionsLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  if (electionsError) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        <AlertCircle className="size-4" />
        שגיאה בטעינת הבחירות. נסו לרענן את הדף.
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-4 text-base text-muted-foreground">
        אין בחירות זמינות כרגע.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <Trophy className="size-6" />
          טבלת דירוג
        </h1>
        {sorted.length > 1 && (
          <Select value={activeId} onValueChange={onSelectElection}>
            <SelectTrigger aria-label="בחירת מערכת בחירות" className="min-w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sorted.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.nameHe}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <DisplayNameEditor />

      {boardLoading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      )}

      {boardError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="size-4" />
          שגיאה בטעינת טבלת הדירוג. נסו לרענן את הדף.
        </div>
      )}

      {data && !data.published && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Users className="size-8 text-muted-foreground" />
            <p className="text-lg font-semibold">הטבלה תיחשף לאחר פרסום התוצאות</p>
            <p className="text-base text-muted-foreground">
              {data.participantCount} משתתפים הגישו תחזית עד כה
            </p>
          </CardContent>
        </Card>
      )}

      {data && data.published && (
        <div className="space-y-4">
          {data.yourRank !== null && (
            <div className="flex items-center gap-2 rounded-md border bg-secondary/40 p-3 text-base font-medium">
              <Trophy className="size-4" />
              המקום שלך: <span className="font-bold tabular-nums">{data.yourRank}</span> מתוך{' '}
              <span className="font-bold tabular-nums">{data.total}</span>
            </div>
          )}

          {data.rows.length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-base text-muted-foreground">
              אין עדיין משתתפים מדורגים.
            </div>
          ) : (
            <LeaderboardTable
              rows={data.rows}
              currentUserId={me?.id ?? null}
              yourRank={data.yourRank}
            />
          )}

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
              {Math.min(offset + 1, data.total)}–{Math.min(offset + data.rows.length, data.total)}{' '}
              מתוך {data.total}
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
      )}
    </div>
  );
}
