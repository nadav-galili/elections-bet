import { useMemo } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
              {r.userId === currentUserId && <Badge variant="secondary">אתה</Badge>}
            </div>
          );
        },
      }),
      columnHelper.accessor('total', {
        header: 'נקודות',
        cell: (info) => <span className="font-semibold tabular-nums">{info.getValue()}</span>,
      }),
    ],
    [currentUserId],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id} className="text-start">
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => {
          const isYou = row.original.userId === currentUserId;
          return (
            <TableRow
              key={row.id}
              data-you={isYou || undefined}
              className={cn(isYou && 'bg-secondary/60 hover:bg-secondary/60')}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className="text-start">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export default LeaderboardTable;
