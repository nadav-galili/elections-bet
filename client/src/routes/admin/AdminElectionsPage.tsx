import { Plus, Vote } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import { useElections } from '@/lib/admin/hooks';
import { formatDateTime, resultsStatusLabels } from '@/lib/admin/format';
import type { ResultsStatus } from '@/lib/admin/types';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';

function statusVariant(status: ResultsStatus): 'default' | 'secondary' | 'outline' {
  if (status === 'FINAL') return 'default';
  if (status === 'PROVISIONAL') return 'secondary';
  return 'outline';
}

type AdminElection = NonNullable<ReturnType<typeof useElections>['data']>[number];

const columnHelper = createColumnHelper<AdminElection>();

const columns: ColumnDef<AdminElection, unknown>[] = [
  columnHelper.accessor('nameHe', {
    header: 'שם',
    meta: { align: 'start', className: 'font-medium' },
    cell: ({ row }) => (
      <Link
        to={`/admin/elections/${row.original.id}`}
        className="text-primary underline-offset-4 hover:underline"
      >
        {row.original.nameHe}
      </Link>
    ),
  }),
  columnHelper.accessor('lockAt', {
    header: 'נעילה',
    meta: { align: 'start' },
    cell: ({ row }) => formatDateTime(row.original.lockAt),
  }),
  columnHelper.accessor('revealAt', {
    header: 'חשיפת תחזיות',
    meta: { align: 'start' },
    cell: ({ row }) => formatDateTime(row.original.revealAt),
  }),
  columnHelper.accessor('resultsStatus', {
    header: 'תוצאות',
    meta: { align: 'start' },
    cell: ({ row }) => (
      <Badge variant={statusVariant(row.original.resultsStatus)}>
        {resultsStatusLabels[row.original.resultsStatus]}
      </Badge>
    ),
  }),
  columnHelper.display({
    id: 'parties',
    header: 'מפלגות',
    meta: { align: 'start' },
    cell: ({ row }) => row.original._count?.parties ?? 0,
  }),
] as ColumnDef<AdminElection, unknown>[];

export default function AdminElectionsPage() {
  const { data, isLoading, isError, refetch } = useElections();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">ניהול בחירות</h1>
        <Button asChild>
          <Link to="/admin/elections/new">
            <Plus className="size-4" />
            צור בחירות חדשות
          </Link>
        </Button>
      </div>

      {isLoading && <LoadingState label="טוען בחירות…" />}

      {isError && (
        <ErrorState
          title="שגיאה בטעינת הבחירות"
          description="נסו לרענן את הדף."
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !isError && data && data.length === 0 && (
        <EmptyState
          icon={Vote}
          title="עדיין לא נוצרו בחירות."
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/elections/new">
                <Plus className="size-4" />
                צרו את הבחירות הראשונות
              </Link>
            </Button>
          }
        />
      )}

      {!isLoading && !isError && data && data.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <DataTable columns={columns} data={data} />
        </div>
      )}
    </div>
  );
}
