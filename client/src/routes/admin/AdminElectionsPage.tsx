import { AlertCircle, Loader2, Plus, Vote } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useElections } from '@/lib/admin/hooks';
import { formatDateTime, resultsStatusLabels } from '@/lib/admin/format';
import type { ResultsStatus } from '@/lib/admin/types';
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
  const { data, isLoading, isError } = useElections();

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

      {isLoading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="size-4" />
          שגיאה בטעינת הבחירות. נסו לרענן את הדף.
        </div>
      )}

      {!isLoading && !isError && data && data.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed py-16 text-center text-muted-foreground">
          <Vote className="size-8" />
          <p>עדיין לא נוצרו בחירות.</p>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/elections/new">צרו את הבחירות הראשונות</Link>
          </Button>
        </div>
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
