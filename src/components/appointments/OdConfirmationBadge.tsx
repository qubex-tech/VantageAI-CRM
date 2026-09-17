import { getOdConfirmationChipClasses } from '@/lib/integrations/opendental/confirmationStatus'

type OdConfirmationBadgeProps = {
  label: string | null | undefined
  className?: string
  /** When true, prefix with a short "Confirm:" label for detail rows. */
  showCaption?: boolean
}

export function OdConfirmationBadge({
  label,
  className = '',
  showCaption = false,
}: OdConfirmationBadgeProps) {
  const text = typeof label === 'string' ? label.trim() : ''
  if (!text) return null

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border font-medium ${getOdConfirmationChipClasses(
        text
      )} ${className}`}
      title={`Open Dental confirmation: ${text}`}
    >
      {showCaption ? <span className="opacity-70 font-normal">Confirm</span> : null}
      {text}
    </span>
  )
}
