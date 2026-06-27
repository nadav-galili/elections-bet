import { Plus, Vote } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useElections } from '@/lib/admin/hooks';
import { formatDateTime, resultsStatusLabels } from '@/lib/admin/format';
import type { ResultsStatus } from '@/lib/admin/types';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function statusVariant(status: ResultsStatus): 'default' | 'secondary' | 'outline' {
  if (status === 'FINAL') return 'default';
  if (status === 'PROVISIONAL') return 'secondary';
  return 'outline';
}

export default function AdminElectionsPage() {
  const { data, isLoading, isError, refetch } = useElections();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight">ניהול בחירות</h1>
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
              <Link to="/admin/elections/new">צרו את הבחירות הראשונות</Link>
            </Button>
          }
        />
      )}

      {!isLoading && !isError && data && data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>שם</TableHead>
              <TableHead>נעילה</TableHead>
              <TableHead>חשיפת תחזיות</TableHead>
              <TableHead>תוצאות</TableHead>
              <TableHead>מפלגות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((election) => (
              <TableRow key={election.id}>
                <TableCell className="font-medium">
                  <Link
                    to={`/admin/elections/${election.id}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {election.nameHe}
                  </Link>
                </TableCell>
                <TableCell>{formatDateTime(election.lockAt)}</TableCell>
                <TableCell>{formatDateTime(election.revealAt)}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(election.resultsStatus)}>
                    {resultsStatusLabels[election.resultsStatus]}
                  </Badge>
                </TableCell>
                <TableCell>{election._count?.parties ?? 0}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
