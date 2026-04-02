export default function AppointmentsLoading() {
  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8">
      <div className="mb-8">
        <div className="h-8 w-40 rounded bg-gray-200 animate-pulse mb-2" />
        <div className="h-4 w-72 rounded bg-gray-100 animate-pulse" />
      </div>

      <div className="space-y-4">
        <div className="h-12 w-full rounded-lg border border-gray-200 bg-white animate-pulse" />
        <div className="h-24 w-full rounded-lg border border-gray-200 bg-white animate-pulse" />
        <div className="h-28 w-full rounded-lg border border-gray-200 bg-white animate-pulse" />
        <div className="h-28 w-full rounded-lg border border-gray-200 bg-white animate-pulse" />
      </div>
    </div>
  )
}
