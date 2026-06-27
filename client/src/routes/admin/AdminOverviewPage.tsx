import {
  AlertCircle,
  ClipboardCheck,
  Loader2,
  Percent,
  Users,
  UsersRound,
  Vote,
} from 'lucide-react';
import { useOverview } from '@/lib/admin/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof Users;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base font-semibold text-muted-foreground">{label}</CardTitle>
        <Icon className="size-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-extrabold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function AdminOverviewPage() {
  const { data, isLoading, isError } = useOverview();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tight">סקירה</h1>

      {isLoading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="size-4" />
          שגיאה בטעינת הנתונים. נסו לרענן את הדף.
        </div>
      )}

      {!isLoading && !isError && data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="משתמשים" value={data.users} icon={Users} />
            <StatCard label="קבוצות" value={data.groups} icon={UsersRound} />
            <StatCard label="בחירות" value={data.elections} icon={Vote} />
            <StatCard label="תחזיות שהוגשו" value={data.picksSubmitted} icon={ClipboardCheck} />
            <StatCard
              label="שיעור השתתפות"
              value={`${Math.round(data.participationRate * 100)}%`}
              icon={Percent}
            />
          </div>

          {data.activeElection && (
            <p className="text-base text-muted-foreground">
              בחירות פעילות:{' '}
              <span className="font-semibold text-foreground">{data.activeElection.nameHe}</span>
            </p>
          )}
        </>
      )}
    </div>
  );
}
