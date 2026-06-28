import { AlertCircle, Loader2, ShieldCheck, Trash2, UserMinus, UsersRound } from 'lucide-react';
import { useState } from 'react';
import {
  useAdminGroup,
  useAllGroups,
  useDeleteGroupAdmin,
  useRemoveGroupMemberAdmin,
  useUpdateGroupAdmin,
} from '@/lib/admin/hooks';
import { apiErrorMessage, formatDateTime } from '@/lib/admin/format';
import type { AdminGroup } from '@/lib/admin/types';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
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
  const mutationError =
    updateGroup.isError || removeMember.isError
      ? apiErrorMessage(updateGroup.error ?? removeMember.error)
      : null;

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
          <div className="flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="size-4" />
            שגיאה בטעינת חברי הקבוצה.
          </div>
        )}

        {mutationError && (
          <div className="flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {mutationError}
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
                    {isAdmin && <span className="ms-2 text-sm text-muted-foreground">(מנהל)</span>}
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
  const { data, isLoading, isError, refetch } = useAllGroups();
  const deleteGroup = useDeleteGroupAdmin();
  const [confirmDelete, setConfirmDelete] = useState<AdminGroup | null>(null);
  const [reassign, setReassign] = useState<AdminGroup | null>(null);
  const [removeMember, setRemoveMember] = useState<AdminGroup | null>(null);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">ניהול קבוצות</h1>

      {isLoading && <LoadingState label="טוען קבוצות…" />}

      {isError && (
        <ErrorState
          title="שגיאה בטעינת הקבוצות"
          description="נסו לרענן את הדף."
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !isError && data && data.length === 0 && (
        <EmptyState icon={UsersRound} title="עדיין לא נוצרו קבוצות." />
      )}

      {!isLoading && !isError && data && data.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>שם</TableHead>
                <TableHead>מנהל</TableHead>
                <TableHead>חברים</TableHead>
                <TableHead>נוצרה</TableHead>
                <TableHead className="text-end">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((group) => (
                <TableRow key={group.id}>
                  <TableCell className="font-medium">{group.nameHe}</TableCell>
                  <TableCell>{group.admin?.displayName ?? '—'}</TableCell>
                  <TableCell>{group.memberCount}</TableCell>
                  <TableCell>{formatDateTime(group.createdAt)}</TableCell>
                  <TableCell className="text-end">
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
        </div>
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
        error={deleteGroup.isError ? apiErrorMessage(deleteGroup.error) : undefined}
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
