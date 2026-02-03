import { InboxLayout } from '@/components/communications/InboxLayout'

export const dynamic = 'force-dynamic'

export default function CommunicationsPage() {
  return (
    <div className="h-full p-6">
      <InboxLayout />
    </div>
  )
}
