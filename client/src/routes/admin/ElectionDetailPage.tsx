import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertCircle,
  ArrowRight,
  Check,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import {
  useDeleteElection,
  useDeleteParty,
  useElection,
  usePublishResults,
  useSetResults,
  useUpdateElection,
} from '@/lib/admin/hooks';
import {
  blocLabel,
  formatDateTime,
  fromDateTimeLocal,
  resultsStatusLabels,
  toDateTimeLocal,
} from '@/lib/admin/format';
import type { ElectionDetail, Party } from '@/lib/admin/types';
import { getApiErrorMessage } from '@/lib/utils';
import { useDarkSurface } from '@/components/candy/useDarkSurface';
import { ErrorState, LoadingState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
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
import { DataTable } from '@/components/ui/data-table';
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
        <CardTitle className="font-display text-xl">הגדרות הבחירות</CardTitle>
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
              <div className="flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                {getApiErrorMessage(updateElection.error, 'שמירת ההגדרות נכשלה. נסו שוב.')}
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              {updateElection.isSuccess && !form.formState.isDirty && (
                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Check className="size-4" /> נשמר
                </span>
              )}
              <Button type="submit" disabled={updateElection.isPending}>
                {updateElection.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
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

  const columns = useMemo<ColumnDef<Party, unknown>[]>(
    () => [
      {
        id: 'logo',
        header: 'לוגו',
        meta: { align: 'center' },
        cell: ({ row }) => {
          const party = row.original;
          return party.logoUrl ? (
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
          );
        },
      },
      {
        id: 'name',
        header: 'שם',
        meta: { align: 'start', className: 'font-medium' },
        cell: ({ row }) => row.original.nameHe,
      },
      {
        id: 'bloc',
        header: 'גוש',
        meta: { align: 'start' },
        cell: ({ row }) => blocLabel(row.original.bloc, election),
      },
      {
        id: 'order',
        header: 'סדר',
        meta: { align: 'start' },
        cell: ({ row }) => row.original.displayOrder,
      },
      {
        id: 'baseline',
        header: 'בסיס',
        meta: { align: 'start' },
        cell: ({ row }) => row.original.baselineMandates ?? '—',
      },
      {
        id: 'actions',
        header: 'פעולות',
        meta: { align: 'end' },
        cell: ({ row }) => {
          const party = row.original;
          return (
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
          );
        },
      },
    ],
    [election],
  );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div className="grid gap-2">
          <CardTitle className="font-display text-xl">מפלגות</CardTitle>
          <CardDescription>נהלו את רשימת המפלגות לבחירות אלו.</CardDescription>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-4" />
          הוסף מפלגה
        </Button>
      </CardHeader>
      <CardContent>
        {parties.length === 0 ? (
          <p className="rounded-2xl border border-dashed py-10 text-center text-sm text-muted-foreground">
            עדיין לא נוספו מפלגות.
          </p>
        ) : (
          <DataTable columns={columns} data={parties} />
        )}

        {deleteParty.isError && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {getApiErrorMessage(deleteParty.error, 'מחיקת המפלגה נכשלה. נסו שוב.')}
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

const RESULTS_TOTAL = 120;

const resultsSchema = z
  .object({
    entries: z.array(
      z.object({
        partyId: z.string(),
        actualMandates: z.coerce
          .number({ message: 'יש להזין מספר' })
          .int('יש להזין מספר שלם')
          .refine((n) => n === 0 || (n >= 4 && n <= 120), 'יש להזין 0 או 4–120'),
      }),
    ),
  })
  .superRefine((val, ctx) => {
    const sum = val.entries.reduce((a, e) => a + (Number(e.actualMandates) || 0), 0);
    if (sum !== RESULTS_TOTAL) {
      ctx.addIssue({
        code: 'custom',
        path: ['entries'],
        message: `סך המנדטים חייב להיות 120 (כעת ${sum})`,
      });
    }
  });

type ResultsFormValues = z.input<typeof resultsSchema>;

/** Big, color-coded indicator of the election's results status. */
function ResultsStatusBadge({ election }: { election: ElectionDetail }) {
  const status = election.resultsStatus;
  // מדגם (provisional) vs סופי (final) must be visually distinct.
  const prominent =
    status === 'PROVISIONAL'
      ? { label: 'מדגם', variant: 'secondary' as const }
      : status === 'FINAL'
        ? { label: 'סופי', variant: 'default' as const }
        : null;

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">סטטוס תוצאות:</span>
        {prominent ? (
          <Badge variant={prominent.variant} className="px-4 py-1.5 text-lg font-extrabold">
            {prominent.label}
          </Badge>
        ) : (
          <Badge variant="outline" className="px-4 py-1.5 text-lg font-bold">
            {resultsStatusLabels.NONE}
          </Badge>
        )}
      </div>
      {election.resultsPublishedAt && (
        <span className="text-sm text-muted-foreground">
          פורסם: {formatDateTime(election.resultsPublishedAt)}
        </span>
      )}
    </div>
  );
}

function ResultsManager({ election }: { election: ElectionDetail }) {
  const setResults = useSetResults(election.id);
  const publishResults = usePublishResults(election.id);
  const [confirm, setConfirm] = useState<'PROVISIONAL' | 'FINAL' | 'RECOMPUTE' | null>(null);

  const parties = useMemo(
    () => [...election.parties].sort((a, b) => a.displayOrder - b.displayOrder),
    [election.parties],
  );

  const form = useForm<ResultsFormValues>({
    resolver: zodResolver(resultsSchema),
    mode: 'onChange',
    defaultValues: {
      entries: parties.map((p) => ({ partyId: p.id, actualMandates: p.actualMandates ?? 0 })),
    },
  });

  // Re-sync when the fetched election changes (e.g. after save/refetch).
  useEffect(() => {
    form.reset({
      entries: parties.map((p) => ({ partyId: p.id, actualMandates: p.actualMandates ?? 0 })),
    });
  }, [parties, form]);

  const watched = form.watch('entries');
  const sum = watched.reduce((a, e) => a + (Number(e.actualMandates) || 0), 0);
  const remaining = RESULTS_TOTAL - sum;

  const onSubmit = form.handleSubmit((values) => {
    setResults.mutate(
      values.entries.map((e) => ({
        partyId: e.partyId,
        actualMandates: Number(e.actualMandates),
      })),
      { onSuccess: () => form.reset(values) },
    );
  });

  const confirmDescription = (() => {
    if (confirm === 'PROVISIONAL') {
      return 'פרסום תוצאות מדגם יחשב את הניקוד ויחשוף אותו לכל המשתתפים. ניתן יהיה לעדכן בהמשך לתוצאות סופיות.';
    }
    if (confirm === 'FINAL') {
      return 'פרסום תוצאות סופיות יחשב את הניקוד הסופי ויחשוף אותו לכל המשתתפים.';
    }
    if (confirm === 'RECOMPUTE') {
      return 'הניקוד יחושב מחדש על בסיס התוצאות הנוכחיות ויעודכן לכל המשתתפים.';
    }
    return undefined;
  })();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-xl">תוצאות הבחירות</CardTitle>
        <CardDescription>הזינו את חלוקת המנדטים בפועל ופרסמו לחישוב הניקוד.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ResultsStatusBadge election={election} />

        {parties.length === 0 ? (
          <p className="rounded-2xl border border-dashed py-10 text-center text-sm text-muted-foreground">
            יש להוסיף מפלגות לפני הזנת תוצאות.
          </p>
        ) : (
          <Form {...form}>
            <form onSubmit={onSubmit} className="space-y-5" noValidate>
              <div className="space-y-4">
                {parties.map((party, index) => (
                  <FormField
                    key={party.id}
                    control={form.control}
                    name={`entries.${index}.actualMandates`}
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between gap-4">
                        <FormLabel className="text-base font-medium">{party.nameHe}</FormLabel>
                        <div className="grid gap-1">
                          <FormControl>
                            <Input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={120}
                              className="w-24"
                              {...field}
                              value={field.value as number}
                            />
                          </FormControl>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />
                ))}
              </div>

              <div
                className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-base font-semibold ${
                  remaining !== 0 ? 'bg-destructive/15 text-destructive' : 'bg-candy-mint text-ink'
                }`}
                aria-live="polite"
              >
                {remaining === 0 && <Check className="size-4" />}
                {`נותרו: ${remaining}`}
              </div>

              {setResults.isError && (
                <div className="flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertCircle className="size-4" />
                  {getApiErrorMessage(setResults.error, 'שמירת התוצאות נכשלה. נסו שוב.')}
                </div>
              )}

              <div className="flex items-center justify-end gap-3">
                {setResults.isSuccess && !form.formState.isDirty && (
                  <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Check className="size-4" /> נשמר
                  </span>
                )}
                <Button type="submit" disabled={!form.formState.isValid || setResults.isPending}>
                  {setResults.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  שמירת תוצאות
                </Button>
              </div>
            </form>
          </Form>
        )}

        {publishResults.isError && (
          <div className="flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="size-4" />
            {getApiErrorMessage(
              publishResults.error,
              'פרסום התוצאות נכשל. ודאו שהתוצאות תקינות ושלמות.',
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-5">
          <Button
            type="button"
            variant="outline"
            disabled={publishResults.isPending}
            onClick={() => setConfirm('PROVISIONAL')}
          >
            <Megaphone className="size-4" />
            פרסום תוצאות מדגם
          </Button>
          <Button
            type="button"
            disabled={publishResults.isPending}
            onClick={() => setConfirm('FINAL')}
          >
            <Megaphone className="size-4" />
            פרסום תוצאות סופיות
          </Button>
          {election.resultsStatus === 'FINAL' && (
            <Button
              type="button"
              variant="outline"
              disabled={publishResults.isPending}
              onClick={() => setConfirm('RECOMPUTE')}
            >
              <RefreshCw className="size-4" />
              חישוב מחדש
            </Button>
          )}
        </div>
      </CardContent>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title={
          confirm === 'PROVISIONAL'
            ? 'פרסום תוצאות מדגם'
            : confirm === 'RECOMPUTE'
              ? 'חישוב מחדש'
              : 'פרסום תוצאות סופיות'
        }
        description={confirmDescription}
        confirmLabel={
          confirm === 'PROVISIONAL'
            ? 'פרסום מדגם'
            : confirm === 'RECOMPUTE'
              ? 'חישוב מחדש'
              : 'פרסום סופי'
        }
        pending={publishResults.isPending}
        onConfirm={() => {
          publishResults.mutate(confirm === 'PROVISIONAL' ? 'PROVISIONAL' : 'FINAL', {
            onSuccess: () => setConfirm(null),
          });
        }}
      />
    </Card>
  );
}

export default function ElectionDetailPage() {
  const { id = '' } = useParams();
  useDarkSurface();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useElection(id);
  const deleteElection = useDeleteElection();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="theme-candy space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin">
              <ArrowRight className="size-4" />
              חזרה
            </Link>
          </Button>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {data?.nameHe ?? 'בחירות'}
          </h1>
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

      {isLoading && <LoadingState label="טוען בחירות…" />}

      {isError && (
        <ErrorState
          title="שגיאה בטעינת הבחירות"
          description="נסו לרענן את הדף."
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !isError && data && (
        <div className="space-y-6">
          <ConfigForm election={data} />
          <PartiesManager election={data} />
          <ResultsManager election={data} />
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
