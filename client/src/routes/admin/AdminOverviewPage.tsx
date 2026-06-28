import { ClipboardCheck, Percent, Users, UsersRound, Vote } from 'lucide-react';
import { useOverview } from '@/lib/admin/hooks';
import { ErrorState, LoadingState } from '@/components/states';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: typeof Users;
  tone: string;
}) {
  return (
    <Card className="transition-transform duration-500 hover:-translate-y-1">
      <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base font-semibold text-muted-foreground">{label}</CardTitle>
        <span
          className={`inline-flex size-9 items-center justify-center rounded-xl text-ink ${tone}`}
        >
          <Icon className="size-5" />
        </span>
      </CardHeader>
      <CardContent>
        <p className="font-display text-3xl font-bold tracking-tight tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function AdminOverviewPage() {
  const { data, isLoading, isError, refetch } = useOverview();

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">סקירה</h1>

      {isLoading && <LoadingState label="טוען נתונים…" />}

      {isError && (
        <ErrorState
          title="שגיאה בטעינת הנתונים"
          description="נסו לרענן את הדף."
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !isError && data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="משתמשים" value={data.users} icon={Users} tone="bg-candy-mint" />
            <StatCard label="קבוצות" value={data.groups} icon={UsersRound} tone="bg-candy-peach" />
            <StatCard label="בחירות" value={data.elections} icon={Vote} tone="bg-candy-butter" />
            <StatCard
              label="תחזיות שהוגשו"
              value={data.picksSubmitted}
              icon={ClipboardCheck}
              tone="bg-candy-mint"
            />
            <StatCard
              label="שיעור השתתפות"
              value={`${Math.round(data.participationRate * 100)}%`}
              icon={Percent}
              tone="bg-candy-peach"
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
