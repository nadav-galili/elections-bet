import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, ArrowRight, Check, Loader2, Lock } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router-dom';
import { z } from 'zod';
import { usePick, usePlayerElection, useSavePick } from '@/lib/pick/hooks';
import type { Pick, PlayerElectionDetail } from '@/lib/pick/types';
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
        <div className="space-y-4">
          {parties.map((party, index) => (
            <FormField
              key={party.id}
              control={form.control}
              name={`entries.${index}.mandates`}
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between gap-4">
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
          className={`text-lg font-semibold ${
            remaining !== 0 ? 'text-destructive' : 'text-muted-foreground'
          }`}
          aria-live="polite"
        >
          {`נותרו: ${remaining}`}
        </div>

        {saveMutation.isError && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
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
            {saveMutation.isPending && <Loader2 className="size-4 animate-spin" />}
            שמירת תחזית
          </Button>
        </div>
      </form>
    </Form>
  );
}

/** A live clock that ticks every second until `lockAt`, then flips `locked`. */
function useTimeLeft(lockAt: string | null) {
  const target = lockAt ? new Date(lockAt).getTime() : null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (target == null) return;
    // Already past the lock — no need to tick.
    if (target - Date.now() <= 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [target]);

  const msLeft = target == null ? null : target - now;
  const locked = msLeft != null && msLeft <= 0;
  return { msLeft, locked };
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const clock = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return days > 0 ? `${days} ימים ${clock}` : clock;
}

function LockCountdown({ lockAt, msLeft }: { lockAt: string | null; msLeft: number | null }) {
  if (!lockAt) {
    return <p className="text-sm text-muted-foreground">טרם נקבע מועד נעילה</p>;
  }
  return (
    <p className="text-sm text-muted-foreground" aria-live="polite">
      התחזיות ננעלות בעוד{' '}
      <span className="font-mono font-semibold tabular-nums">{formatCountdown(msLeft ?? 0)}</span> ·{' '}
      {new Date(lockAt).toLocaleString('he-IL')}
    </p>
  );
}

function FrozenView({ election, pick }: { election: PlayerElectionDetail; pick: Pick | null }) {
  const parties = [...election.parties].sort((a, b) => a.displayOrder - b.displayOrder);
  const byParty = new Map<string, number>();
  for (const e of pick?.entries ?? []) byParty.set(e.partyId, e.mandates);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Lock className="size-5" />
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
          <p className="py-6 text-center text-muted-foreground">לא הגשת תחזית</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function PickPage() {
  const { id = '' } = useParams();
  const electionQuery = usePlayerElection(id);
  const pickQuery = usePick(id);

  const isLoading = electionQuery.isLoading || pickQuery.isLoading;
  const isError = electionQuery.isError || pickQuery.isError;
  const election = electionQuery.data;

  // Reactive lock: ticks each second so an open page auto-freezes when lockAt passes.
  const { msLeft, locked } = useTimeLeft(election?.lockAt ?? null);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/">
            <ArrowRight className="size-4" />
            חזרה
          </Link>
        </Button>
        <h1 className="text-2xl font-extrabold tracking-tight">{election?.nameHe ?? 'תחזית'}</h1>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      )}

      {!isLoading && isError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="size-4" />
          שגיאה בטעינת התחזית.
        </div>
      )}

      {!isLoading && !isError && election && (
        <>
          {locked ? (
            <FrozenView election={election} pick={pickQuery.data ?? null} />
          ) : (
            <div className="space-y-4">
              <LockCountdown lockAt={election.lockAt} msLeft={msLeft} />
              <PickForm election={election} pick={pickQuery.data ?? null} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
