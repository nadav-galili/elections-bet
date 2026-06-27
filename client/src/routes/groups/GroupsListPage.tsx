import { AlertCircle, Check, Copy, Plus, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useGroups } from '@/lib/groups/hooks';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { formatDate } from '@/lib/time';

function inviteLink(token: string) {
  return `${window.location.origin}/join/${token}`;
}

export default function GroupsListPage() {
  const { data, isLoading, isError, refetch } = useGroups();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight">הקבוצות שלי</h1>
        <Button asChild>
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
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>שם הקבוצה</TableHead>
              <TableHead>חברים</TableHead>
              <TableHead>נוצר</TableHead>
              <TableHead>הזמנה</TableHead>
              <TableHead>פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((group) => (
              <TableRow key={group.id}>
                <TableCell className="font-medium">
                  <Link
                    to={`/groups/${group.id}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {group.nameHe}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{group._count?.memberships ?? 0}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {formatDate(group.createdAt)}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(group)}
                    className="gap-2"
                  >
                    {copiedId === group.id ? (
                      <>
                        <Check className="size-3" />
                        הועתק
                      </>
                    ) : (
                      <>
                        <Copy className="size-3" />
                        העתק קישור
                      </>
                    )}
                  </Button>
                </TableCell>
                <TableCell>
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/groups/${group.id}`}>פרטים</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
