import { AlertCircle, Copy, Loader2, Trash2, Users } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useGroup, useDeleteGroup, useLeaveGroup, useRemoveMember } from '@/lib/groups/hooks'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useAuth } from '@clerk/react'

function copyInviteLink(token: string) {
  const url = `${window.location.origin}/join/${token}`
  navigator.clipboard.writeText(url)
  return url
}

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading, isError } = useGroup(id!)
  const { userId } = useAuth()
  const { toast } = useToast()

  const deleteGroup = useDeleteGroup()
  const leaveGroup = useLeaveGroup()
  const removeMember = useRemoveMember()

  const handleCopy = (token: string) => {
    const url = copyInviteLink(token)
    toast({
      title: 'הקישור הועתק',
      description: 'הזמינו חברים באמצעות הקישור',
    })
  }

  const handleDelete = () => {
    deleteGroup.mutate(id!, {
      onSuccess: () => {
        // Redirect to groups list
        window.location.href = '/groups'
      },
    })
  }

  const handleLeave = () => {
    leaveGroup.mutate(id!, {
      onSuccess: () => {
        // Redirect to groups list
        window.location.href = '/groups'
      },
    })
  }

  const handleRemoveMember = (userId: string) => {
    removeMember.mutate({ groupId: id!, userId })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        <AlertCircle className="size-4" />
        שגיאה בטעינת הקבוצה. נסו לרענן את הדף.
      </div>
    )
  }

  const isAdmin = data.adminUserId === userId
  const isMember = data.memberships.some(m => m.userId === userId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight">{data.nameHe}</h1>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleCopy(data.inviteToken)}
            className="gap-2"
          >
            <Copy className="size-3" />
            העתק קישור
          </Button>

          {isMember && (
            <ConfirmDialog
              title="עזוב קבוצה?"
              description="אם אתה המנהל, החבר הראשון שנשאר יהפוך למנהל."
              onConfirm={handleLeave}
              trigger={
                <Button variant="outline" size="sm">
                  עזוב
                </Button>
              }
            />
          )}

          {isAdmin && (
            <ConfirmDialog
              title="מחק קבוצה?"
              description="הקבוצה והחברים בה יימחקו."
              onConfirm={handleDelete}
              trigger={
                <Button variant="destructive" size="sm">
                  <Trash2 className="size-3" />
                  מחק קבוצה
                </Button>
              }
            />
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>חברים</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {data.memberships.map((m) => (
              <li key={m.userId} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {m.user.avatarUrl && (
                    <img
                      src={m.user.avatarUrl}
                      alt={m.user.displayName || ''}
                      className="size-8 rounded-full"
                    />
                  )}
                  <div>
                    <span className="font-medium">{m.user.displayName || 'ללא שם'}</span>
                    {m.userId === userId && <Badge variant="secondary">אתה</Badge>}
                    {m.userId === data.adminUserId && <Badge variant="default">מנהל</Badge>}
                  </div>
                </div>
                {isAdmin && m.userId !== userId && (
                  <ConfirmDialog
                    title="הסר חבר?"
                    description="החבר יכול לחזור באמצעות קישור ההזמנה."
                    onConfirm={() => handleRemoveMember(m.userId)}
                    trigger={
                      <Button variant="ghost" size="sm">
                        <Trash2 className="size-3" />
                      </Button>
                    }
                  />
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="size-3" />
        <span>
          {data._count?.memberships ?? data.memberships.length} חברים • נוצר{' '}
          {new Date(data.createdAt).toLocaleDateString('he-IL')}
        </span>
      </div>

      {/* TODO: add pick status per member, privacy logic */}
    </div>
  )
}