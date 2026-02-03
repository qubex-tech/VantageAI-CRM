import { InboxShell } from '@/components/communications/InboxShell'

export const dynamic = 'force-dynamic'

export default function CommunicationsPage() {
  return (
    <div className="h-full p-6">
      <InboxShell />
    </div>
  )
}
