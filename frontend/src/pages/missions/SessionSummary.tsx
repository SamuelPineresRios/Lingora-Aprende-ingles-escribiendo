import { useAuth } from '@/lib/hooks/useAuth'
import { SessionSummaryScreen } from '@/features/mission/components/SessionSummaryScreen'
export default function SessionSummaryPage() {
  const { user, loading } = useAuth()
  if (loading || !user) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-amber/30 border-t-amber rounded-full animate-spin"/></div>
  return <SessionSummaryScreen studentId={user.id} />
}
