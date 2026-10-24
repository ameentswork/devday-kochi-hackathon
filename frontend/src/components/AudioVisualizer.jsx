import { useEffect, useRef } from 'react'

export default function AudioVisualizer({ listening }) {
  const canvasRef = useRef(null)
  const animRef = useRef(null)
  const audioCtxRef = useRef(null)
  const streamRef = useRef(null)

  useEffect(() => {
    if (!listening) {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {})
        audioCtxRef.current = null
      }
      return
    }

    let isMounted = true

    async function initAudio() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) return
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream

        const AudioContextImpl = window.AudioContext || window.webkitAudioContext
        if (!AudioContextImpl) return
        const ctx = new AudioContextImpl()
        audioCtxRef.current = ctx

        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 64
        analyser.smoothingTimeConstant = 0.8
        source.connect(analyser)

        const bufferLength = analyser.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)

        const canvas = canvasRef.current
        if (!canvas) return
        const drawCtx = canvas.getContext('2d')

        function renderFrame() {
          if (!isMounted) return
          animRef.current = requestAnimationFrame(renderFrame)

          analyser.getByteFrequencyData(dataArray)

          const width = canvas.width
          const height = canvas.height
          drawCtx.clearRect(0, 0, width, height)

          const barCount = 18
          const barWidth = 4
          const gap = (width - barCount * barWidth) / (barCount - 1)

          for (let i = 0; i < barCount; i++) {
            const dataIndex = Math.floor((i / barCount) * (bufferLength / 2))
            const rawVal = dataArray[dataIndex] || 0
            // Normalize with minimum height so it feels alive
            const percent = Math.min(1, Math.max(0.08, rawVal / 255))
            const barHeight = Math.max(4, percent * (height - 4))
            const x = i * (barWidth + gap)
            const y = (height - barHeight) / 2

            // Forest to sage gradient
            const grad = drawCtx.createLinearGradient(0, y, 0, y + barHeight)
            grad.addColorStop(0, '#3a7357')
            grad.addColorStop(0.5, '#2f5d45')
            grad.addColorStop(1, '#a9bfa8')

            drawCtx.fillStyle = grad
            drawCtx.beginPath()
            drawCtx.roundRect(x, y, barWidth, barHeight, 3)
            drawCtx.fill()
          }
        }

        renderFrame()
      } catch {
        // Fallback: visualizer silently degrades if mic stream fails
      }
    }

    initAudio()

    return () => {
      isMounted = false
      if (animRef.current) cancelAnimationFrame(animRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {})
        audioCtxRef.current = null
      }
    }
  }, [listening])

  if (!listening) return null

  return (
    <div className="audio-visualizer-wrap" aria-hidden="true">
      <canvas
        ref={canvasRef}
        width={180}
        height={36}
        className="audio-visualizer-canvas"
      />
    </div>
  )
}
