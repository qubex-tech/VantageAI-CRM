/** Labels for patient notes, Insurance tab, and check messages. Never name internal vendors. */
export function customerFacingVendorName(
  vendorKey?: string | null,
  displayName?: string | null
): string | null {
  if (vendorKey === 'stedi') return null
  return displayName?.trim() || null
}
