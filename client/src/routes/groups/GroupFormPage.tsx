import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, ArrowRight, Loader2, Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useCreateGroup } from '@/lib/groups/hooks';
import { useDarkSurface } from '@/components/candy/useDarkSurface';
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
  nameHe: z.string().trim().min(1, 'יש להזין שם לקבוצה'),
});

type FormValues = z.input<typeof schema>;

export default function GroupFormPage() {
  useDarkSurface();
  const navigate = useNavigate();
  const createGroup = useCreateGroup();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nameHe: '',
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    createGroup.mutate(
      { nameHe: values.nameHe.trim() },
      {
        onSuccess: (created) => {
          navigate(`/groups/${created.id}`);
        },
      },
    );
  });

  return (
    <div className="theme-candy mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/groups">
            <ArrowRight className="size-4" />
            חזרה
          </Link>
        </Button>
        <h1 className="font-display text-3xl font-bold tracking-tight">קבוצה חדשה</h1>
      </div>

      <Form {...form}>
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <FormField
            control={form.control}
            name="nameHe"
            render={({ field }) => (
              <FormItem>
                <FormLabel>שם הקבוצה</FormLabel>
                <FormControl>
                  <Input placeholder="לדוגמה: המשפחה, החברים מהעבודה" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {createGroup.isError && (
            <div className="flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="size-4" />
              שמירת הקבוצה נכשלה. נסו שוב.
            </div>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={createGroup.isPending}>
              {createGroup.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              צור קבוצה
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
