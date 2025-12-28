import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md border border-gray-200">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-gray-900">404 - Page Not Found</CardTitle>
          <CardDescription className="text-sm text-gray-500">
            The page you're looking for doesn't exist
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard">
            <Button className="w-full bg-gray-900 hover:bg-gray-800 text-white">
              Go to Dashboard
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

