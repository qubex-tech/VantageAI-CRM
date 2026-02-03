import { InboxLayout } from '@/components/communications/InboxLayout'

export const dynamic = 'force-dynamic'

export default function CommunicationDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="h-full p-6">
      <InboxLayout initialConversationId={params.id} />
    </div>
  )
}
