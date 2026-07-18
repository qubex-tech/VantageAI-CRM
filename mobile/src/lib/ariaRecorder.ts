import { Audio } from 'expo-av'

export type AriaRecorderState = 'idle' | 'recording' | 'paused'

/** Rotate ambient audio this often so Whisper can run during the visit. */
export const ARIA_SEGMENT_MS = 35_000

export type AriaAudioSegment = {
  uri: string
  durationMs: number
}

type SegmentHandler = (segment: AriaAudioSegment) => void | Promise<void>

let recording: Audio.Recording | null = null
let startedAtMs = 0
let accumulatedMs = 0
let segmentStartedAtMs = 0
let segmentTimer: ReturnType<typeof setInterval> | null = null
let onSegmentHandler: SegmentHandler | null = null
let rotating = false
let rolling = false
let paused = false

export async function ensureMicPermission(): Promise<boolean> {
  const current = await Audio.getPermissionsAsync()
  if (current.granted) return true
  const requested = await Audio.requestPermissionsAsync()
  return requested.granted
}

async function prepareAudioMode(): Promise<void> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
  })
}

async function startNewRecording(): Promise<void> {
  const next = new Audio.Recording()
  await next.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)
  await next.startAsync()
  recording = next
  startedAtMs = Date.now()
  segmentStartedAtMs = Date.now()
}

async function unloadCurrentRecording(): Promise<AriaAudioSegment | null> {
  if (!recording) return null

  const status = await recording.getStatusAsync()
  if (status.isRecording || status.isDoneRecording === false) {
    // pause path may already have accumulated
  }
  if (status.isRecording) {
    accumulatedMs += Date.now() - startedAtMs
  }

  const segmentMs = Math.max(0, Date.now() - segmentStartedAtMs)
  await recording.stopAndUnloadAsync()
  const uri = recording.getURI()
  recording = null

  if (!uri) return null
  return {
    uri,
    durationMs: segmentMs || status.durationMillis || 0,
  }
}

async function rotateSegment(): Promise<void> {
  if (!rolling || rotating || !recording) return
  rotating = true
  try {
    const segment = await unloadCurrentRecording()
    await startNewRecording()
    if (segment && onSegmentHandler) {
      // Never block the next segment on upload/ASR
      void Promise.resolve(onSegmentHandler(segment)).catch(() => null)
    }
  } catch (err) {
    console.warn('[ariaRecorder] rotate failed', err)
    // Best effort: try to keep recording alive
    if (!recording) {
      try {
        await startNewRecording()
      } catch {
        // ignore
      }
    }
  } finally {
    rotating = false
  }
}

/**
 * Start ambient capture with automatic segment rotation.
 * Each completed segment is handed to `onSegment` for background upload + ASR.
 */
export async function startRollingAmbient(onSegment: SegmentHandler): Promise<void> {
  const granted = await ensureMicPermission()
  if (!granted) {
    throw new Error('Microphone permission is required for Aria')
  }

  await prepareAudioMode()
  await discardActiveRecording()

  onSegmentHandler = onSegment
  rolling = true
  accumulatedMs = 0
  await startNewRecording()

  if (segmentTimer) clearInterval(segmentTimer)
  segmentTimer = setInterval(() => {
    void rotateSegment()
  }, ARIA_SEGMENT_MS)
}

/** @deprecated Prefer startRollingAmbient for ambient visits */
export async function startAmbientRecording(): Promise<void> {
  await startRollingAmbient(() => undefined)
}

export async function pauseAmbientRecording(): Promise<void> {
  if (segmentTimer) {
    clearInterval(segmentTimer)
    segmentTimer = null
  }
  if (!recording || paused) return
  const status = await recording.getStatusAsync()
  if (status.isRecording) {
    await recording.pauseAsync()
    accumulatedMs += Date.now() - startedAtMs
    paused = true
  }
}

export async function resumeAmbientRecording(): Promise<void> {
  if (!recording) return
  await recording.startAsync()
  startedAtMs = Date.now()
  segmentStartedAtMs = Date.now()
  paused = false
  if (rolling && !segmentTimer) {
    segmentTimer = setInterval(() => {
      void rotateSegment()
    }, ARIA_SEGMENT_MS)
  }
}

/**
 * Stop rolling capture and return the final (not-yet-uploaded) segment.
 */
export async function stopRollingAmbient(): Promise<AriaAudioSegment> {
  rolling = false
  if (segmentTimer) {
    clearInterval(segmentTimer)
    segmentTimer = null
  }

  // Wait briefly if a rotate is in flight
  for (let i = 0; i < 20 && rotating; i++) {
    await new Promise((r) => setTimeout(r, 50))
  }

  const segment = await unloadCurrentRecording()
  onSegmentHandler = null

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
  })

  if (!segment) {
    throw new Error('Recording file missing')
  }
  return segment
}

export async function stopAmbientRecording(): Promise<AriaAudioSegment> {
  return stopRollingAmbient()
}

export function getElapsedMs(): number {
  if (!recording || paused) return accumulatedMs
  return accumulatedMs + (Date.now() - startedAtMs)
}

export async function discardActiveRecording(): Promise<void> {
  rolling = false
  if (segmentTimer) {
    clearInterval(segmentTimer)
    segmentTimer = null
  }
  onSegmentHandler = null
  if (recording) {
    try {
      await recording.stopAndUnloadAsync()
    } catch {
      // ignore
    }
  }
  recording = null
  accumulatedMs = 0
  startedAtMs = 0
  segmentStartedAtMs = 0
  rotating = false
  paused = false
}
