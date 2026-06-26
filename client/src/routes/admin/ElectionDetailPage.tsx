import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, ArrowRight, Check, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import {
  useDeleteElection,
  useDeleteParty,
  useElection,
  useUpdateElection,
} from '@/lib/admin/hooks';
import { blocLabel, fromDateTimeLocal, toDateTimeLocal } from '@/lib/admin/format';
import type { ElectionDetail, Party } from '@/lib/admin/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { PartyDialog } from '@/routes/admin/PartyDialog';

const configSchema = z
  .object({
    nameHe: z.string().trim().min(1, 'יש להזין שם לבחירות'),
    lockAt: z.string(),
    revealAt: z.string(),
    blocALabel: z.string(),
    blocBLabel: z.string(),
  })
  .refine((v) => !v.lockAt || !v.revealAt || new Date(v.revealAt) >= new Date(v.lockAt), {
    path: ['revealAt'],
    message: 'מועד החשיפה חייב להיות אחרי מועד הנעילה',
  });

type ConfigValues = z.input<typeof configSchema>;

function ConfigForm({ election }: { election: ElectionDetail }) {
  const updateElection = useUpdateElection(election.id);
  const form = useForm<ConfigValues>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      nameHe: election.nameHe,
      lockAt: toDateTimeLocal(election.lockAt),
      revealAt: toDateTimeLocal(election.revealAt),
      blocALabel: election.blocALabel ?? '',
      blocBLabel: election.blocBLabel ?? '',
    },
  });

  // Re-sync when the fetched election changes (e.g. after refetch).
  useEffect(() => {
    form.reset({
      nameHe: election.nameHe,
      lockAt: toDateTimeLocal(election.lockAt),
      revealAt: toDateTimeLocal(election.revealAt),
      blocALabel: election.blocALabel ?? '',
      blocBLabel: election.blocBLabel ?? '',
    });
  }, [election, form]);

  const onSubmit = form.handleSubmit((values) => {
    updateElection.mutate({
      nameHe: values.nameHe.trim(),
      lockAt: fromDateTimeLocal(values.lockAt),
      revealAt: fromDateTimeLocal(values.revealAt),
      blocALabel: values.blocALabel.trim() || null,
      blocBLabel: values.blocBLabel.trim() || null,
    });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>הגדרות הבחירות</CardTitle>
        <CardDescription>שם, מועדי נעילה וחשיפה, ותוויות הגושים.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-5" noValidate>
            <FormField
              control={form.control}
              name="nameHe"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שם הבחירות</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="lockAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>מועד נעילה</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="revealAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>מועד חשיפת תחזיות</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="blocALabel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>תווית גוש א׳</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="blocBLabel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>תווית גוש ב׳</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {updateElection.isError && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertCircle className="size-4" />
                שמירת ההגדרות נכשלה. נסו שוב.
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              {updateElection.isSuccess && !form.formState.isDirty && (
                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Check className="size-4" /> נשמר
                </span>
              )}
              <Button type="submit" disabled={updateElection.isPending}>
                {updateElection.isPending && <Loader2 className="size-4 animate-spin" />}
                שמירת הגדרות
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function PartiesManager({ election }: { election: ElectionDetail }) {
  const deleteParty = useDeleteParty(election.id);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Party | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Party | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (party: Party) => {
    setEditing(party);
    setDialogOpen(true);
  };

  const parties = [...election.parties].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div className="grid gap-2">
          <CardTitle>מפלגות</CardTitle>
          <CardDescription>נהלו את רשימת המפלגות לבחירות אלו.</CardDescription>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-4" />
          הוסף מפלגה
        </Button>
      </CardHeader>
      <CardContent>
        {parties.length === 0 ? (
          <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
            עדיין לא נוספו מפלגות.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>לוגו</TableHead>
                <TableHead>שם</TableHead>
                <TableHead>גוש</TableHead>
                <TableHead>סדר</TableHead>
                <TableHead className="text-left">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parties.map((party) => (
                <TableRow key={party.id}>
                  <TableCell>
                    {party.logoUrl ? (
                      <img
                        src={party.logoUrl}
                        alt={party.nameHe}
                        className="size-8 rounded object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="flex size-8 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                        —
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{party.nameHe}</TableCell>
                  <TableCell>{blocLabel(party.bloc, election)}</TableCell>
                  <TableCell>{party.displayOrder}</TableCell>
                  <TableCell className="text-left">
                    <div className="flex justify-start gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(party)}
                        aria-label={`עריכת ${party.nameHe}`}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmDelete(party)}
                        aria-label={`מחיקת ${party.nameHe}`}
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

        {deleteParty.isError && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="size-4" />
            מחיקת המפלגה נכשלה. נסו שוב.
          </div>
        )}
      </CardContent>

      <PartyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        election={election}
        party={editing}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
        title="מחיקת מפלגה"
        description={
          confirmDelete ? `למחוק את "${confirmDelete.nameHe}"? לא ניתן לשחזר.` : undefined
        }
        confirmLabel="מחיקה"
        pending={deleteParty.isPending}
        onConfirm={() => {
          if (!confirmDelete) return;
          deleteParty.mutate(confirmDelete.id, {
            onSuccess: () => setConfirmDelete(null),
          });
        }}
      />
    </Card>
  );
}

export default function ElectionDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useElection(id);
  const deleteElection = useDeleteElection();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin">
              <ArrowRight className="size-4" />
              חזרה
            </Link>
          </Button>
          <h1 className="text-2xl font-extrabold tracking-tight">{data?.nameHe ?? 'בחירות'}</h1>
        </div>
        {data && (
          <Button
            variant="outline"
            size="sm"
            className="text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="size-4" />
            מחיקת בחירות
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="size-4" />
          שגיאה בטעינת הבחירות.
        </div>
      )}

      {!isLoading && !isError && data && (
        <div className="space-y-6">
          <ConfigForm election={data} />
          <PartiesManager election={data} />
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="מחיקת בחירות"
        description={
          data ? `למחוק את "${data.nameHe}" ואת כל המפלגות שלה? לא ניתן לשחזר.` : undefined
        }
        confirmLabel="מחיקה"
        pending={deleteElection.isPending}
        onConfirm={() =>
          deleteElection.mutate(id, {
            onSuccess: () => navigate('/admin'),
          })
        }
      />
    </div>
  );
}
