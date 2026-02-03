import { InboxShell } from '@/components/communications/InboxShell'

export const dynamic = 'force-dynamic'

export default function CommunicationDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="h-full p-6">
      <InboxShell initialConversationId={params.id} />
    </div>
  )
}
