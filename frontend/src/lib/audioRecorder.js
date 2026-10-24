/**
 * Voice Recording module for Voice Diary
 * Captures user voice audio via MediaRecorder alongside Web Speech dictation
 */

export const audioRecordingSupported =
  typeof window !== 'undefined' &&
  Boolean(window.MediaRecorder) &&
  Boolean(navigator.mediaDevices?.getUserMedia)

export function getBestAudioMimeType() {
  if (typeof MediaRecorder === 'undefined') return ''
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/aac',
  ]
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t
  }
  return ''
}

/**
 * Start recording audio from the microphone
 * @param {Object} options
 * @param {MediaStream} [options.existingStream] - Optional existing MediaStream to share
 * @returns {Promise<{ stop: () => Promise<{ blob: Blob, type: string, duration: number }>, cancel: () => void }>}
 */
export async function startAudioRecording({ existingStream = null } = {}) {
  if (!audioRecordingSupported) {
    throw new Error('Audio recording is not supported in this browser environment.')
  }

  const stream =
    existingStream ||
    (await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    }))

  const mimeType = getBestAudioMimeType()
  const options = mimeType ? { mimeType } : {}
  const recorder = new MediaRecorder(stream, options)
  const actualMimeType = recorder.mimeType || mimeType || 'audio/webm'

  const chunks = []
  const startTime = Date.now()
  let isStopped = false

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data)
    }
  }

  recorder.start(250) // capture in 250ms slices

  return {
    async stop() {
      if (isStopped) return null
      isStopped = true

      return new Promise((resolve) => {
        recorder.onstop = () => {
          // Release microphone tracks if we created the stream
          if (!existingStream) {
            stream.getTracks().forEach((track) => track.stop())
          }

          const durationSeconds = Math.max(
            1,
            Math.round((Date.now() - startTime) / 1000),
          )
          const audioBlob = new Blob(chunks, { type: actualMimeType })
          resolve({
            blob: audioBlob,
            type: actualMimeType,
            duration: durationSeconds,
          })
        }

        if (recorder.state !== 'inactive') {
          recorder.stop()
        }
      })
    },
    cancel() {
      if (isStopped) return
      isStopped = true
      try {
        if (recorder.state !== 'inactive') recorder.stop()
      } catch {
        // ignore
      }
      if (!existingStream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    },
  }
}
