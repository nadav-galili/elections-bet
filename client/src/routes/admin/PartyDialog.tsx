import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Loader2, Plus, Save } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useCreateParty, useUpdateParty } from '@/lib/admin/hooks';
import { blocLabel } from '@/lib/admin/format';
import { getApiErrorMessage } from '@/lib/utils';
import type { Bloc, ElectionDetail, Party } from '@/lib/admin/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const schema = z.object({
  nameHe: z.string().trim().min(1, 'יש להזין שם למפלגה'),
  logoUrl: z.string(),
  bloc: z.enum(['A', 'B', 'UNALIGNED']),
  displayOrder: z.coerce
    .number({ message: 'יש להזין מספר' })
    .int('יש להזין מספר שלם')
    .min(0, 'הסדר לא יכול להיות שלילי'),
  // Free-text so '' clears the baseline (=> null => no delta). Otherwise a
  // non-negative integer; 0 marks a brand-new entrant.
  baselineMandates: z
    .string()
    .refine((s) => s.trim() === '' || /^\d+$/.test(s.trim()), 'יש להזין מספר שלם אי-שלילי'),
});

type FormValues = z.input<typeof schema>;

const BLOCS: Bloc[] = ['A', 'B', 'UNALIGNED'];

export function PartyDialog({
  open,
  onOpenChange,
  election,
  party,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  election: ElectionDetail;
  /** When set, the dialog edits this party; otherwise it creates a new one. */
  party?: Party | null;
}) {
  const createParty = useCreateParty(election.id);
  const updateParty = useUpdateParty(election.id);
  const isEdit = Boolean(party);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nameHe: '',
      logoUrl: '',
      bloc: 'UNALIGNED',
      displayOrder: 0,
      baselineMandates: '',
    },
  });

  // Sync the form to the party being edited (or reset for create) on open.
  useEffect(() => {
    if (!open) return;
    form.reset({
      nameHe: party?.nameHe ?? '',
      logoUrl: party?.logoUrl ?? '',
      bloc: party?.bloc ?? 'UNALIGNED',
      displayOrder: party?.displayOrder ?? 0,
      baselineMandates: party?.baselineMandates == null ? '' : String(party.baselineMandates),
    });
  }, [open, party, form]);

  const mutation = isEdit ? updateParty : createParty;

  const onSubmit = form.handleSubmit((values) => {
    const baseline = values.baselineMandates.trim();
    const payload = {
      nameHe: values.nameHe.trim(),
      logoUrl: values.logoUrl.trim() || null,
      bloc: values.bloc,
      displayOrder: Number(values.displayOrder),
      baselineMandates: baseline === '' ? null : Number(baseline),
    };

    if (isEdit && party) {
      updateParty.mutate(
        { partyId: party.id, input: payload },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      createParty.mutate(payload, { onSuccess: () => onOpenChange(false) });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'עריכת מפלגה' : 'הוספת מפלגה'}</DialogTitle>
          <DialogDescription>הגדירו את פרטי המפלגה והגוש שאליו היא משויכת.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="nameHe"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שם המפלגה</FormLabel>
                  <FormControl>
                    <Input placeholder="לדוגמה: הליכוד" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="logoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>כתובת לוגו (אופציונלי)</FormLabel>
                  <FormControl>
                    <Input type="url" placeholder="https://…" dir="ltr" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bloc"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>גוש</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {BLOCS.map((bloc) => (
                        <SelectItem key={bloc} value={bloc}>
                          {blocLabel(bloc, election)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="displayOrder"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>סדר תצוגה</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} {...field} value={field.value as number} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="baselineMandates"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>בסיס מנדטים (אופציונלי)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      placeholder="ריק = ללא שינוי; 0 = מפלגה חדשה"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {mutation.isError && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                {getApiErrorMessage(mutation.error, 'שמירת המפלגה נכשלה. נסו שוב.')}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                ביטול
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : isEdit ? (
                  <Save className="size-4" />
                ) : (
                  <Plus className="size-4" />
                )}
                {isEdit ? 'שמירה' : 'הוספה'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default PartyDialog;
