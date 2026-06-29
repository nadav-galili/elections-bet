import { useMemo } from 'react';
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import type { LeaderboardRow } from '@/lib/leaderboard/types';

function RowAvatar({
  displayName,
  avatarUrl,
}: {
  displayName: string | null;
  avatarUrl: string | null;
}) {
  if (!avatarUrl) return null;
  return (
    <img
      src={avatarUrl}
      alt={displayName ?? ''}
      className="size-8 rounded-full"
      onError={(e) => {
        e.currentTarget.style.display = 'none';
      }}
    />
  );
}

const columnHelper = createColumnHelper<LeaderboardRow>();

export function LeaderboardTable({
  rows,
  currentUserId,
}: {
  rows: LeaderboardRow[];
  currentUserId: string | null;
  /**
   * Accepted for prop symmetry with the page-level banner but intentionally
   * unused here: the table highlights the caller's row by `userId`, and the
   * numeric rank is shown in the banner that lives in the parent page.
   */
  yourRank?: number | null;
}) {
  const columns = useMemo(
    () => [
      columnHelper.accessor('rank', {
        header: 'דירוג',
        cell: (info) => <span className="font-bold tabular-nums">{info.getValue()}</span>,
        meta: { align: 'start' },
      }),
      columnHelper.display({
        id: 'player',
        header: 'שחקן',
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex items-center gap-3">
              <RowAvatar displayName={r.displayName} avatarUrl={r.avatarUrl} />
              <span className="font-medium">{r.displayName || 'ללא שם'}</span>
              {r.userId === currentUserId && (
                <Badge className="bg-candy-mint text-ink hover:bg-candy-mint">אתה</Badge>
              )}
            </div>
          );
        },
        meta: { align: 'start' },
      }),
      columnHelper.accessor('total', {
        header: 'נקודות',
        cell: (info) => <span className="font-semibold tabular-nums">{info.getValue()}</span>,
        meta: { align: 'start' },
      }),
    ],
    [currentUserId],
  );

  return (
    <DataTable
      columns={columns as ColumnDef<LeaderboardRow, unknown>[]}
      data={rows}
      rowClassName={(row) =>
        row.original.userId === currentUserId
          ? 'bg-candy-mint/15 hover:bg-candy-mint/15'
          : undefined
      }
      rowProps={(row) => ({ 'data-you': row.original.userId === currentUserId || undefined })}
    />
  );
}

export default LeaderboardTable;
