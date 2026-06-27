import { AlertCircle, Check, Copy, Loader2, Plus, Users } from 'lucide-react';
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

function inviteLink(token: string) {
  return `${window.location.origin}/join/${token}`;
}

export default function GroupsListPage() {
  const { data, isLoading, isError } = useGroups();
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

      {isLoading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="size-4" />
          שגיאה בטעינת הקבוצות. נסו לרענן את הדף.
        </div>
      )}

      {copyError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="size-4" />
          העתקת הקישור נכשלה. העתיקו ידנית: {copyError}
        </div>
      )}

      {!isLoading && !isError && data && data.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed py-16 text-center text-muted-foreground">
          <Users className="size-8" />
          <p>עדיין לא נוצרו קבוצות.</p>
          <Button asChild variant="outline" size="sm">
            <Link to="/groups/new">צרו את הקבוצה הראשונה</Link>
          </Button>
        </div>
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
                <TableCell className="text-muted-foreground">
                  {new Date(group.createdAt).toLocaleDateString('he-IL')}
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
