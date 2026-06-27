import { AlertCircle, Loader2, ShieldCheck, Trash2, UserMinus, UsersRound } from 'lucide-react';
import { useState } from 'react';
import {
  useAdminGroup,
  useAllGroups,
  useDeleteGroupAdmin,
  useRemoveGroupMemberAdmin,
  useUpdateGroupAdmin,
} from '@/lib/admin/hooks';
import { formatDateTime } from '@/lib/admin/format';
import type { AdminGroup } from '@/lib/admin/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';

/** Dialog listing a group's members, used to reassign admin or remove a member. */
function MembersDialog({
  group,
  mode,
  onClose,
}: {
  group: AdminGroup;
  mode: 'reassign' | 'remove';
  onClose: () => void;
}) {
  const { data, isLoading, isError } = useAdminGroup(group.id);
  const updateGroup = useUpdateGroupAdmin();
  const removeMember = useRemoveGroupMemberAdmin();

  const pending = updateGroup.isPending || removeMember.isPending;

  const act = (userId: string) => {
    if (mode === 'reassign') {
      updateGroup.mutate({ id: group.id, input: { adminUserId: userId } }, { onSuccess: onClose });
    } else {
      removeMember.mutate({ groupId: group.id, userId }, { onSuccess: onClose });
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'reassign' ? 'החלפת מנהל הקבוצה' : 'הסרת חבר מהקבוצה'}
          </DialogTitle>
          <DialogDescription>{group.nameHe}</DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
          </div>
        )}

        {isError && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="size-4" />
            שגיאה בטעינת חברי הקבוצה.
          </div>
        )}

        {!isLoading && !isError && data && (
          <ul className="space-y-2">
            {data.memberships.map((m) => {
              const isAdmin = m.userId === data.adminUserId;
              return (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 rounded-md border p-3"
                >
                  <span className="text-base font-medium">
                    {m.user.displayName ?? '—'}
                    {isAdmin && <span className="mr-2 text-sm text-muted-foreground">(מנהל)</span>}
                  </span>
                  {mode === 'reassign' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isAdmin || pending}
                      onClick={() => act(m.userId)}
                    >
                      <ShieldCheck className="size-4" />
                      מנה למנהל
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      disabled={pending}
                      onClick={() => act(m.userId)}
                    >
                      <UserMinus className="size-4" />
                      הסרה
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            סגירה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminGroupsPage() {
  const { data, isLoading, isError } = useAllGroups();
  const deleteGroup = useDeleteGroupAdmin();
  const [confirmDelete, setConfirmDelete] = useState<AdminGroup | null>(null);
  const [reassign, setReassign] = useState<AdminGroup | null>(null);
  const [removeMember, setRemoveMember] = useState<AdminGroup | null>(null);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tight">ניהול קבוצות</h1>

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

      {!isLoading && !isError && data && data.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed py-16 text-center text-muted-foreground">
          <UsersRound className="size-8" />
          <p>עדיין לא נוצרו קבוצות.</p>
        </div>
      )}

      {!isLoading && !isError && data && data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>שם</TableHead>
              <TableHead>מנהל</TableHead>
              <TableHead>חברים</TableHead>
              <TableHead>נוצרה</TableHead>
              <TableHead className="text-left">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((group) => (
              <TableRow key={group.id}>
                <TableCell className="font-medium">{group.nameHe}</TableCell>
                <TableCell>{group.admin?.displayName ?? '—'}</TableCell>
                <TableCell>{group.memberCount}</TableCell>
                <TableCell>{formatDateTime(group.createdAt)}</TableCell>
                <TableCell className="text-left">
                  <div className="flex justify-start gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setReassign(group)}
                      aria-label={`החלפת מנהל ${group.nameHe}`}
                    >
                      <ShieldCheck className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRemoveMember(group)}
                      aria-label={`הסרת חבר מ-${group.nameHe}`}
                    >
                      <UserMinus className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmDelete(group)}
                      aria-label={`מחיקת ${group.nameHe}`}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
        title="מחיקת קבוצה"
        description={
          confirmDelete ? `למחוק את "${confirmDelete.nameHe}"? לא ניתן לשחזר.` : undefined
        }
        confirmLabel="מחיקה"
        pending={deleteGroup.isPending}
        onConfirm={() => {
          if (!confirmDelete) return;
          deleteGroup.mutate(confirmDelete.id, {
            onSuccess: () => setConfirmDelete(null),
          });
        }}
      />

      {reassign && (
        <MembersDialog group={reassign} mode="reassign" onClose={() => setReassign(null)} />
      )}
      {removeMember && (
        <MembersDialog group={removeMember} mode="remove" onClose={() => setRemoveMember(null)} />
      )}
    </div>
  );
}
