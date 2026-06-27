import { Loader2 } from 'lucide-react'
import { useJoinGroup } from '@/lib/groups/hooks'
import { useParams } from 'react-router-dom'

export default function JoinPage() {
  const { token } = useParams<{ token: string }>()
  const joinGroup = useJoinGroup()

  // Auto-join on mount
  if (token) {
    joinGroup.mutate(token, {
      onSuccess: () => {
        window.location.href = '/groups'
      },
      onError: () => {
        // Show error toast maybe
      },
    })
  }

  return (
    <div className="flex items-center justify-center py-16">
      <div className="text-center">
        <Loader2 className="size-6 animate-spin" />
        <p className="mt-4 text-lg">מצטרף לקבוצה...</p>
      </div>
    </div>
  )
}