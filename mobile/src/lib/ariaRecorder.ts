import { Audio } from 'expo-av'

export type AriaRecorderState = 'idle' | 'recording' | 'paused'

let recording: Audio.Recording | null = null
let startedAtMs = 0
let accumulatedMs = 0

export async function ensureMicPermission(): Promise<boolean> {
  const current = await Audio.getPermissionsAsync()
  if (current.granted) return true
  const requested = await Audio.requestPermissionsAsync()
  return requested.granted
}

export async function startAmbientRecording(): Promise<void> {
  const granted = await ensureMicPermission()
  if (!granted) {
    throw new Error('Microphone permission is required for Aria')
  }

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
  })

  if (recording) {
    try {
      await recording.stopAndUnloadAsync()
    } catch {
      // ignore
    }
    recording = null
  }

  const next = new Audio.Recording()
  await next.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)
  await next.startAsync()
  recording = next
  startedAtMs = Date.now()
  accumulatedMs = 0
}

export async function pauseAmbientRecording(): Promise<void> {
  if (!recording) return
  const status = await recording.getStatusAsync()
  if (status.isRecording) {
    await recording.pauseAsync()
    accumulatedMs += Date.now() - startedAtMs
  }
}

export async function resumeAmbientRecording(): Promise<void> {
  if (!recording) return
  await recording.startAsync()
  startedAtMs = Date.now()
}

export async function stopAmbientRecording(): Promise<{
  uri: string
  durationMs: number
}> {
  if (!recording) {
    throw new Error('No active recording')
  }

  const status = await recording.getStatusAsync()
  if (status.isRecording) {
    accumulatedMs += Date.now() - startedAtMs
  }

  await recording.stopAndUnloadAsync()
  const uri = recording.getURI()
  recording = null

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
  })

  if (!uri) {
    throw new Error('Recording file missing')
  }

  return { uri, durationMs: accumulatedMs || status.durationMillis || 0 }
}

export function getElapsedMs(): number {
  if (!recording) return accumulatedMs
  return accumulatedMs + (Date.now() - startedAtMs)
}

export async function discardActiveRecording(): Promise<void> {
  if (!recording) return
  try {
    await recording.stopAndUnloadAsync()
  } catch {
    // ignore
  }
  recording = null
  accumulatedMs = 0
  startedAtMs = 0
}
