import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function CallNotFound() {
  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8 max-w-4xl">
      <Card className="border border-gray-200">
        <CardContent className="py-12 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Call Not Found</h2>
          <p className="text-sm text-gray-500 mb-6">
            The call you're looking for doesn't exist or you don't have access to it.
          </p>
          <Link href="/calls">
            <Button variant="outline">Back to Calls</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

