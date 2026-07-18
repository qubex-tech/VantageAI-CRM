/**
 * Soft wrapper around expo-keep-awake so a broken/mis-resolved install
 * never takes down Aria capture.
 */
type KeepAwakeModule = {
  activateKeepAwakeAsync?: (tag?: string) => Promise<void>
  deactivateKeepAwake?: (tag?: string) => void
}

function load(): KeepAwakeModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-keep-awake') as KeepAwakeModule
  } catch {
    return null
  }
}

export async function activateKeepAwakeSafe(tag = 'aria'): Promise<void> {
  const mod = load()
  if (!mod?.activateKeepAwakeAsync) return
  try {
    await mod.activateKeepAwakeAsync(tag)
  } catch {
    // ignore
  }
}

export function deactivateKeepAwakeSafe(tag = 'aria'): void {
  const mod = load()
  if (!mod?.deactivateKeepAwake) return
  try {
    mod.deactivateKeepAwake(tag)
  } catch {
    // ignore
  }
}
