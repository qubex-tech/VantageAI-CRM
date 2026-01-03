// This file is a placeholder - will be implemented after API routes are modified
// For now, just render CalSettings with a note that practiceId support is coming

export function CalSettingsWithPracticeId({ practiceId }: { practiceId: string }) {
  return (
    <div className="p-4 border border-gray-200 rounded-lg bg-yellow-50">
      <p className="text-sm text-yellow-800">
        Cal.com API configuration for practice {practiceId} - Implementation in progress
      </p>
    </div>
  )
}

