import { AlertCircle, Check, Copy, LogOut, Trash2, Trophy, Users } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGroup, useDeleteGroup, useLeaveGroup, useRemoveMember } from '@/lib/groups/hooks';
import type {
  GroupDetail,
  GroupMemberBase,
  PostRevealMember,
  PreRevealMember,
} from '@/lib/groups/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { GroupLeaderboardSection } from '@/routes/leaderboard/GroupLeaderboardSection';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Countdown } from '@/components/Countdown';
import { formatDate } from '@/lib/time';

function inviteLink(token: string) {
  return `${window.location.origin}/join/${token}`;
}

function MemberAvatar({
  displayName,
  avatarUrl,
}: {
  displayName: string | null;
  avatarUrl: string | null;
}) {
  if (!avatarUrl) return null;
  return (
    <img
      src={avatarUrl}
      alt={displayName ?? ''}
      className="size-8 rounded-full"
      onError={(e) => {
        e.currentTarget.style.display = 'none';
      }}
    />
  );
}

function PreRevealStatus({ member }: { member: PreRevealMember }) {
  if (member.pickStatus === 'submitted') {
    return (
      <Badge variant="secondary" className="gap-1">
        <Check className="size-3" />
        הגיש
      </Badge>
    );
  }
  return <Badge variant="outline">טרם הגיש</Badge>;
}

function PostRevealPick({ member }: { member: PostRevealMember }) {
  const entries = member.pick?.entries ?? [];
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">לא הגיש</p>;
  }
  return (
    <ul className="mt-2 space-y-1">
      {entries.map((entry) => (
        <li key={entry.partyId} className="flex items-center justify-between gap-3 text-sm">
          <span className="flex items-center gap-2">
            {entry.party.logoUrl && (
              <img
                src={entry.party.logoUrl}
                alt={entry.party.nameHe}
                className="size-5 rounded object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            <span>{entry.party.nameHe}</span>
          </span>
          <span className="font-semibold tabular-nums">{entry.mandates}</span>
        </li>
      ))}
    </ul>
  );
}

function MemberRow({
  member,
  currentUserId,
  adminUserId,
  isAdmin,
  onRemoveMember,
  statusSlot,
  pickSlot,
}: {
  member: GroupMemberBase;
  currentUserId: string;
  adminUserId: string;
  isAdmin: boolean;
  onRemoveMember: (userId: string) => void;
  statusSlot?: ReactNode;
  pickSlot?: ReactNode;
}) {
  return (
    <li className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <MemberAvatar displayName={member.user.displayName} avatarUrl={member.user.avatarUrl} />
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{member.user.displayName || 'ללא שם'}</span>
            {member.userId === currentUserId && <Badge variant="secondary">אתה</Badge>}
            {member.userId === adminUserId && <Badge>מנהל</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {statusSlot}
          {isAdmin && member.userId !== currentUserId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemoveMember(member.userId)}
              aria-label={`הסרת ${member.user.displayName || 'חבר'}`}
            >
              <Trash2 className="size-4 text-destructive" />
            </Button>
          )}
        </div>
      </div>
      {pickSlot}
    </li>
  );
}

function MemberList({
  data,
  isAdmin,
  onRemoveMember,
}: {
  data: GroupDetail;
  isAdmin: boolean;
  onRemoveMember: (userId: string) => void;
}) {
  const shared = {
    currentUserId: data.currentUserId,
    adminUserId: data.adminUserId,
    isAdmin,
    onRemoveMember,
  };

  // Switch on the discriminant so each branch's `m` is narrowed to the right member type.
  if (data.privacyPhase === 'pre_reveal') {
    return (
      <ul className="space-y-4">
        {data.memberships.map((m) => (
          <MemberRow
            key={m.id}
            member={m}
            {...shared}
            statusSlot={<PreRevealStatus member={m} />}
          />
        ))}
      </ul>
    );
  }

  if (data.privacyPhase === 'post_reveal') {
    return (
      <ul className="space-y-4">
        {data.memberships.map((m) => (
          <MemberRow key={m.id} member={m} {...shared} pickSlot={<PostRevealPick member={m} />} />
        ))}
      </ul>
    );
  }

  return (
    <ul className="space-y-4">
      {data.memberships.map((m) => (
        <MemberRow key={m.id} member={m} {...shared} />
      ))}
    </ul>
  );
}

export default function GroupDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useGroup(id);

  const deleteGroup = useDeleteGroup();
  const leaveGroup = useLeaveGroup();
  const removeMember = useRemoveMember();

  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [tab, setTab] = useState<'members' | 'leaderboard'>('members');

  const handleCopy = async (token: string) => {
    const url = inviteLink(token);
    try {
      await navigator.clipboard.writeText(url);
      setCopyError(null);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      setCopyError(url);
    }
  };

  if (isLoading) {
    return <LoadingState label="טוען קבוצה…" />;
  }

  if (isError || !data) {
    return (
      <ErrorState
        title="שגיאה בטעינת הקבוצה"
        description="נסו לרענן את הדף."
        onRetry={() => refetch()}
      />
    );
  }

  const isAdmin = data.adminUserId === data.currentUserId;
  const isMember = data.memberships.some((m) => m.userId === data.currentUserId);

  const memberToRemove = data.memberships.find((m) => m.userId === confirmRemove);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">{data.nameHe}</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleCopy(data.inviteToken)}
            className="gap-2"
          >
            {copied ? (
              <>
                <Check className="size-3" />
                הועתק
              </>
            ) : (
              <>
                <Copy className="size-3" />
                העתק קישור
              </>
            )}
          </Button>

          {isMember && (
            <Button variant="outline" size="sm" onClick={() => setConfirmLeave(true)}>
              <LogOut className="size-3" />
              עזוב קבוצה
            </Button>
          )}

          {isAdmin && (
            <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-3" />
              מחק קבוצה
            </Button>
          )}
        </div>
      </div>

      {copyError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="size-4" />
          העתקת הקישור נכשלה. העתיקו ידנית:{' '}
          <span dir="ltr" className="font-mono [unicode-bidi:isolate]">
            {copyError}
          </span>
        </div>
      )}

      {leaveGroup.isError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="size-4" />
          היציאה מהקבוצה נכשלה. נסו שוב.
        </div>
      )}

      {deleteGroup.isError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="size-4" />
          מחיקת הקבוצה נכשלה. נסו שוב.
        </div>
      )}

      {removeMember.isError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="size-4" />
          הסרת החבר נכשלה. נסו שוב.
        </div>
      )}

      <div className="flex items-center gap-2 border-b">
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={tab === 'members'}
          onClick={() => setTab('members')}
          className={
            tab === 'members'
              ? '-mb-px gap-2 rounded-none border-b-2 border-primary'
              : '-mb-px gap-2 rounded-none border-b-2 border-transparent text-muted-foreground'
          }
        >
          <Users className="size-4" />
          חברים
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={tab === 'leaderboard'}
          onClick={() => setTab('leaderboard')}
          className={
            tab === 'leaderboard'
              ? '-mb-px gap-2 rounded-none border-b-2 border-primary'
              : '-mb-px gap-2 rounded-none border-b-2 border-transparent text-muted-foreground'
          }
        >
          <Trophy className="size-4" />
          טבלת דירוג
        </Button>
      </div>

      {tab === 'members' && (
        <>
          {data.privacyPhase === 'no_active' && (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              אין בחירות פעילות כרגע.
            </div>
          )}

          {data.privacyPhase === 'pre_reveal' && (
            <div className="space-y-3 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              <p>התחזיות מוסתרות עד מועד החשיפה — מוצג רק מי הגיש.</p>
              <Countdown to={data.activeElection.lockAt} />
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>חברים</CardTitle>
            </CardHeader>
            <CardContent>
              {data.memberships.length === 0 ? (
                <EmptyState icon={Users} title="אין עדיין חברים בקבוצה זו." />
              ) : (
                <MemberList data={data} isAdmin={isAdmin} onRemoveMember={setConfirmRemove} />
              )}
            </CardContent>
          </Card>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-3" />
            <span>
              <span className="tabular-nums">
                {data._count?.memberships ?? data.memberships.length}
              </span>{' '}
              חברים • נוצר <span className="tabular-nums">{formatDate(data.createdAt)}</span>
            </span>
          </div>
        </>
      )}

      {tab === 'leaderboard' && <GroupLeaderboardSection groupId={id} />}

      <ConfirmDialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        title="עזיבת קבוצה"
        description="אם אתה המנהל, חבר אחר יהפוך למנהל. תוכל לחזור באמצעות קישור ההזמנה."
        confirmLabel="עזוב"
        pending={leaveGroup.isPending}
        onConfirm={() =>
          leaveGroup.mutate(id, {
            onSuccess: () => {
              setConfirmLeave(false);
              navigate('/groups');
            },
          })
        }
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="מחיקת קבוצה"
        description={`למחוק את "${data.nameHe}"? הקבוצה והחברים בה יימחקו. לא ניתן לשחזר.`}
        confirmLabel="מחיקה"
        pending={deleteGroup.isPending}
        onConfirm={() =>
          deleteGroup.mutate(id, {
            onSuccess: () => {
              setConfirmDelete(false);
              navigate('/groups');
            },
          })
        }
      />

      <ConfirmDialog
        open={confirmRemove !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmRemove(null);
        }}
        title="הסרת חבר"
        description={
          memberToRemove
            ? `להסיר את ${memberToRemove.user.displayName || 'החבר'}? הוא יוכל לחזור באמצעות קישור ההזמנה.`
            : undefined
        }
        confirmLabel="הסרה"
        pending={removeMember.isPending}
        onConfirm={() => {
          if (!confirmRemove) return;
          removeMember.mutate(
            { groupId: id, userId: confirmRemove },
            { onSuccess: () => setConfirmRemove(null) },
          );
        }}
      />
    </div>
  );
}
