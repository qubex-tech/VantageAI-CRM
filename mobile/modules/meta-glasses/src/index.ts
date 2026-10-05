import { requireOptionalNativeModule } from 'expo-modules-core'

export type GlassesNativeFrame = {
  cardId: string
  title: string
  lines: readonly string[]
  state?: string
}

export type GlassesNativeStatus = {
  state: string
  transport: 'phone-preview' | 'dat'
  linked: boolean
}

type NativeModule = {
  status: () => { state?: string; transport?: string }
  startSession: (cards: GlassesNativeFrame[]) => { state?: string; transport?: string }
  sendFrame: (frame: GlassesNativeFrame) => { state?: string; transport?: string }
  stopSession: () => { state?: string; transport?: string }
}

function nativeModule(): NativeModule | null {
  try {
    return requireOptionalNativeModule<NativeModule>('MetaGlasses')
  } catch {
    return null
  }
}

function readStatus(raw: { state?: string; transport?: string } | null | undefined): GlassesNativeStatus {
  const transport = raw?.transport === 'dat' ? 'dat' : 'phone-preview'
  return {
    state: raw?.state || 'stopped',
    transport,
    linked: transport === 'dat',
  }
}

/** DAT is linked only when the native module reports the glasses transport. */
export function getGlassesStatus(): GlassesNativeStatus {
  const native = nativeModule()
  if (!native) return { state: 'stopped', transport: 'phone-preview', linked: false }
  try {
    return readStatus(native.status())
  } catch {
    return { state: 'stopped', transport: 'phone-preview', linked: false }
  }
}

export function startNativeGlassesSession(cards: GlassesNativeFrame[]): GlassesNativeStatus {
  const native = nativeModule()
  if (!native) return { state: 'started', transport: 'phone-preview', linked: false }
  try {
    return readStatus(native.startSession(cards))
  } catch {
    return { state: 'started', transport: 'phone-preview', linked: false }
  }
}

export function syncGlassesFrame(
  frame: GlassesNativeFrame | null,
  state: string
): GlassesNativeStatus {
  const native = nativeModule()
  if (!native) {
    return {
      state,
      transport: 'phone-preview',
      linked: false,
    }
  }
  try {
    if (state === 'stopped' || !frame) return readStatus(native.stopSession())
    return readStatus(native.sendFrame({ ...frame, state }))
  } catch {
    return { state, transport: 'phone-preview', linked: false }
  }
}

export function stopNativeGlassesSession(): GlassesNativeStatus {
  const native = nativeModule()
  if (!native) return { state: 'stopped', transport: 'phone-preview', linked: false }
  try {
    return readStatus(native.stopSession())
  } catch {
    return { state: 'stopped', transport: 'phone-preview', linked: false }
  }
}
