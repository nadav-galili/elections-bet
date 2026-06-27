import { AlertCircle, Ban, Loader2, Pencil, Trash2, Undo2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  useBanUser,
  useDeleteUser,
  useUnbanUser,
  useUpdateUser,
  useUsers,
} from '@/lib/admin/hooks';
import type { AdminUser, Role } from '@/lib/admin/types';
import { apiErrorMessage } from '@/lib/admin/format';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';

const roleLabels: Record<Role, string> = {
  USER: 'משתמש',
  SUPER_ADMIN: 'מנהל-על',
};

/** Inline rename dialog for a single user. */
function RenameDialog({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const updateUser = useUpdateUser();
  const [name, setName] = useState(user.displayName ?? '');

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>שינוי שם תצוגה</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="display-name">שם תצוגה</Label>
          <Input
            id="display-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        {updateUser.isError && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {apiErrorMessage(updateUser.error)}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={updateUser.isPending}>
            ביטול
          </Button>
          <Button
            disabled={updateUser.isPending}
            onClick={() =>
              updateUser.mutate(
                { id: user.id, input: { displayName: name.trim() } },
                { onSuccess: onClose },
              )
            }
          >
            {updateUser.isPending && <Loader2 className="size-4 animate-spin" />}
            שמירה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UserRow({ user }: { user: AdminUser }) {
  const updateUser = useUpdateUser();
  const banUser = useBanUser();
  const unbanUser = useUnbanUser();
  const deleteUser = useDeleteUser();
  const [rename, setRename] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Promoting to super-admin is sensitive — gate it behind a confirm. Other
  // role changes (e.g. demoting back to a regular user) apply immediately.
  const [confirmPromote, setConfirmPromote] = useState(false);

  const banned = user.bannedAt !== null;

  const changeRole = (role: Role) => {
    if (role === user.role) return;
    if (role === 'SUPER_ADMIN') {
      setConfirmPromote(true);
      return;
    }
    updateUser.mutate({ id: user.id, input: { role } });
  };

  return (
    <TableRow>
      <TableCell className="font-medium">{user.displayName ?? '—'}</TableCell>
      <TableCell>{user.email ?? '—'}</TableCell>
      <TableCell>
        <Select value={user.role} onValueChange={(role) => changeRole(role as Role)}>
          <SelectTrigger size="sm" aria-label={`תפקיד ${user.displayName ?? user.id}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="USER">{roleLabels.USER}</SelectItem>
            <SelectItem value="SUPER_ADMIN">{roleLabels.SUPER_ADMIN}</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        {banned ? (
          <Badge variant="destructive">מושעה</Badge>
        ) : (
          <Badge variant="outline">פעיל</Badge>
        )}
      </TableCell>
      <TableCell className="text-end">
        <div className="flex justify-start gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRename(true)}
            aria-label={`שינוי שם ${user.displayName ?? user.id}`}
          >
            <Pencil className="size-4" />
          </Button>
          {banned ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={unbanUser.isPending}
              onClick={() => unbanUser.mutate(user.id)}
              aria-label={`ביטול השעיה ${user.displayName ?? user.id}`}
            >
              <Undo2 className="size-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              disabled={banUser.isPending}
              onClick={() => banUser.mutate(user.id)}
              aria-label={`השעיית ${user.displayName ?? user.id}`}
            >
              <Ban className="size-4 text-destructive" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmDelete(true)}
            aria-label={`מחיקת ${user.displayName ?? user.id}`}
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </TableCell>

      {rename && <RenameDialog user={user} onClose={() => setRename(false)} />}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="מחיקת משתמש"
        description={`למחוק את "${user.displayName ?? user.email ?? user.id}"? לא ניתן לשחזר.`}
        confirmLabel="מחיקה"
        pending={deleteUser.isPending}
        error={deleteUser.isError ? apiErrorMessage(deleteUser.error) : undefined}
        onConfirm={() => deleteUser.mutate(user.id, { onSuccess: () => setConfirmDelete(false) })}
      />

      <ConfirmDialog
        open={confirmPromote}
        onOpenChange={setConfirmPromote}
        title="הענקת הרשאת מנהל-על"
        description={`להפוך את "${user.displayName ?? user.email ?? user.id}" למנהל-על? למנהל-על יש שליטה מלאה במערכת.`}
        confirmLabel="הענקת הרשאה"
        pending={updateUser.isPending}
        error={updateUser.isError ? apiErrorMessage(updateUser.error) : undefined}
        onConfirm={() =>
          updateUser.mutate(
            { id: user.id, input: { role: 'SUPER_ADMIN' } },
            { onSuccess: () => setConfirmPromote(false) },
          )
        }
      />
    </TableRow>
  );
}

export default function AdminUsersPage() {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');

  // Debounce the search input feeding the query.
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isError, refetch } = useUsers(q);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tight">ניהול משתמשים</h1>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="חיפוש לפי שם או אימייל"
        className="max-w-sm"
        aria-label="חיפוש משתמשים"
      />

      {isLoading && <LoadingState label="טוען משתמשים…" />}

      {isError && (
        <ErrorState
          title="שגיאה בטעינת המשתמשים"
          description="נסו לרענן את הדף."
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !isError && data && data.length === 0 && (
        <EmptyState icon={Users} title="לא נמצאו משתמשים." />
      )}

      {!isLoading && !isError && data && data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>שם</TableHead>
              <TableHead>אימייל</TableHead>
              <TableHead>תפקיד</TableHead>
              <TableHead>סטטוס</TableHead>
              <TableHead className="text-end">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((user) => (
              <UserRow key={user.id} user={user} />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
