import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, ArrowRight, Check, FileX, Loader2, Lock, Save } from 'lucide-react';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router-dom';
import { z } from 'zod';
import { usePick, usePlayerElection, useSavePick } from '@/lib/pick/hooks';
import type { Pick, PlayerElectionDetail } from '@/lib/pick/types';
import { Countdown } from '@/components/Countdown';
import { useDarkSurface } from '@/components/candy/useDarkSurface';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { useCountdown } from '@/lib/time';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

const TOTAL = 120;

const pickSchema = z
  .object({
    entries: z.array(
      z.object({
        partyId: z.string(),
        mandates: z.coerce
          .number({ message: 'יש להזין מספר' })
          .int('יש להזין מספר שלם')
          .refine((n) => n === 0 || (n >= 4 && n <= 120), 'יש להזין 0 או 4–120'),
      }),
    ),
  })
  .superRefine((val, ctx) => {
    const sum = val.entries.reduce((a, e) => a + (Number(e.mandates) || 0), 0);
    if (sum !== TOTAL) {
      ctx.addIssue({
        code: 'custom',
        path: ['entries'],
        message: `סך המנדטים חייב להיות 120 (כעת ${sum})`,
      });
    }
  });

type PickFormValues = z.input<typeof pickSchema>;

function PartyLogo({ src, alt }: { src: string | null; alt: string }) {
  if (!src) {
    return (
      <div className="flex size-8 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
        —
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className="size-8 rounded object-contain"
      onError={(e) => {
        e.currentTarget.style.display = 'none';
      }}
    />
  );
}

function PickForm({ election, pick }: { election: PlayerElectionDetail; pick: Pick | null }) {
  const saveMutation = useSavePick(election.id);

  const parties = useMemo(
    () => [...election.parties].sort((a, b) => a.displayOrder - b.displayOrder),
    [election.parties],
  );

  const existing = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of pick?.entries ?? []) map.set(e.partyId, e.mandates);
    return map;
  }, [pick]);

  const form = useForm<PickFormValues>({
    resolver: zodResolver(pickSchema),
    mode: 'onChange',
    defaultValues: {
      entries: parties.map((p) => ({ partyId: p.id, mandates: existing.get(p.id) ?? 0 })),
    },
  });

  const watched = form.watch('entries');
  const sum = watched.reduce((a, e) => a + (Number(e.mandates) || 0), 0);
  const remaining = TOTAL - sum;

  const onSubmit = form.handleSubmit((values) => {
    saveMutation.mutate(
      {
        entries: values.entries.map((e) => ({ partyId: e.partyId, mandates: Number(e.mandates) })),
      },
      // Reset to the just-saved values so isDirty clears and the "נשמר" badge shows.
      { onSuccess: () => form.reset(values) },
    );
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <div className="divide-y divide-border rounded-2xl border border-border bg-card px-5 shadow-sm sm:px-6">
          {parties.map((party, index) => (
            <FormField
              key={party.id}
              control={form.control}
              name={`entries.${index}.mandates`}
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between gap-4 py-4">
                  <div className="flex items-center gap-3">
                    <PartyLogo src={party.logoUrl} alt="" />
                    <FormLabel className="text-base font-medium">{party.nameHe}</FormLabel>
                  </div>
                  <div className="grid gap-1">
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={120}
                        className="w-24 text-center font-mono tabular-nums"
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

        {saveMutation.isError && (
          <div className="flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="size-4" />
            שמירת התחזית נכשלה. נסו שוב.
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          {saveMutation.isSuccess && !form.formState.isDirty && (
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Check className="size-4" /> נשמר
            </span>
          )}
          <Button
            type="submit"
            size="lg"
            disabled={!form.formState.isValid || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            שמירת תחזית
          </Button>
        </div>
      </form>
    </Form>
  );
}

function FrozenView({ election, pick }: { election: PlayerElectionDetail; pick: Pick | null }) {
  const parties = [...election.parties].sort((a, b) => a.displayOrder - b.displayOrder);
  const byParty = new Map<string, number>();
  for (const e of pick?.entries ?? []) byParty.set(e.partyId, e.mandates);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-xl">
          <span className="inline-flex size-9 items-center justify-center rounded-xl bg-candy-butter text-ink">
            <Lock className="size-5" />
          </span>
          התחזיות ננעלו
        </CardTitle>
      </CardHeader>
      <CardContent>
        {pick ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>מפלגה</TableHead>
                <TableHead className="text-left">מנדטים</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parties.map((party) => (
                <TableRow key={party.id}>
                  <TableCell className="flex items-center gap-3 font-medium">
                    <PartyLogo src={party.logoUrl} alt={party.nameHe} />
                    {party.nameHe}
                  </TableCell>
                  <TableCell className="text-left">{byParty.get(party.id) ?? 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState icon={FileX} title="לא הגשת תחזית" />
        )}
      </CardContent>
    </Card>
  );
}

export default function PickPage() {
  const { id = '' } = useParams();
  useDarkSurface();
  const electionQuery = usePlayerElection(id);
  const pickQuery = usePick(id);

  const isLoading = electionQuery.isLoading || pickQuery.isLoading;
  const isError = electionQuery.isError || pickQuery.isError;
  const election = electionQuery.data;

  // Reactive lock: ticks each second so an open page auto-freezes when lockAt passes.
  const { ended: locked } = useCountdown(election?.lockAt ?? null);

  const handleRetry = () => {
    electionQuery.refetch();
    pickQuery.refetch();
  };

  return (
    <div className="theme-candy mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/">
            <ArrowRight className="size-4" />
            חזרה
          </Link>
        </Button>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {election?.nameHe ?? 'תחזית'}
        </h1>
      </div>

      {isLoading && <LoadingState />}

      {!isLoading && isError && (
        <ErrorState
          title="שגיאה בטעינת התחזית"
          description="נסו לרענן את הדף."
          onRetry={handleRetry}
        />
      )}

      {!isLoading && !isError && election && (
        <>
          {locked ? (
            <FrozenView election={election} pick={pickQuery.data ?? null} />
          ) : (
            <div className="space-y-4">
              <Countdown to={election.lockAt} />
              <PickForm election={election} pick={pickQuery.data ?? null} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
