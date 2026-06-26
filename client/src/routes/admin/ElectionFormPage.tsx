import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useCreateElection } from '@/lib/admin/hooks';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

const schema = z.object({
  nameHe: z.string().trim().min(1, 'יש להזין שם לבחירות'),
  lockAt: z.string(),
  revealOffsetMin: z.coerce
    .number({ message: 'יש להזין מספר דקות' })
    .int('יש להזין מספר שלם')
    .min(0, 'מספר הדקות לא יכול להיות שלילי'),
  blocALabel: z.string(),
  blocBLabel: z.string(),
});

type FormValues = z.input<typeof schema>;

export default function ElectionFormPage() {
  const navigate = useNavigate();
  const createElection = useCreateElection();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nameHe: '',
      lockAt: '',
      revealOffsetMin: 2,
      blocALabel: '',
      blocBLabel: '',
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    const offset = Number(values.revealOffsetMin);
    const lockAtIso = values.lockAt ? new Date(values.lockAt).toISOString() : null;
    const revealAtIso = values.lockAt
      ? new Date(new Date(values.lockAt).getTime() + offset * 60000).toISOString()
      : null;

    createElection.mutate(
      {
        nameHe: values.nameHe.trim(),
        lockAt: lockAtIso,
        revealAt: revealAtIso,
        blocALabel: values.blocALabel.trim() || null,
        blocBLabel: values.blocBLabel.trim() || null,
      },
      {
        onSuccess: (created) => {
          navigate(`/admin/elections/${created.id}`);
        },
      },
    );
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin">
            <ArrowRight className="size-4" />
            חזרה
          </Link>
        </Button>
        <h1 className="text-2xl font-extrabold tracking-tight">בחירות חדשות</h1>
      </div>

      <Form {...form}>
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <FormField
            control={form.control}
            name="nameHe"
            render={({ field }) => (
              <FormItem>
                <FormLabel>שם הבחירות</FormLabel>
                <FormControl>
                  <Input placeholder="לדוגמה: הכנסת ה-26" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="lockAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>מועד נעילת התחזיות</FormLabel>
                <FormControl>
                  <Input type="datetime-local" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="revealOffsetMin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>חשיפת תחזיות (דקות אחרי הנעילה)</FormLabel>
                <FormControl>
                  <Input type="number" min={0} {...field} value={field.value as number} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="blocALabel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>תווית גוש א׳ (אופציונלי)</FormLabel>
                  <FormControl>
                    <Input placeholder="לדוגמה: גוש הימין" {...field} />
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
                  <FormLabel>תווית גוש ב׳ (אופציונלי)</FormLabel>
                  <FormControl>
                    <Input placeholder="לדוגמה: גוש המרכז-שמאל" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {createElection.isError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="size-4" />
              שמירת הבחירות נכשלה. נסו שוב.
            </div>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={createElection.isPending}>
              {createElection.isPending && <Loader2 className="size-4 animate-spin" />}
              צור בחירות
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
