import { useEffect, useRef, useCallback, useState } from 'react'
import { SelfieSegmentation } from '@mediapipe/selfie_segmentation'

interface UseBackgroundBlurProps {
  videoTrack?: MediaStreamTrack
  enabled: boolean
}

export function useBackgroundBlur({ videoTrack, enabled }: UseBackgroundBlurProps) {
  const [processedTrack, setProcessedTrack] = useState<MediaStreamTrack | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animationRef = useRef<number>()
  const selfieSegmentationRef = useRef<SelfieSegmentation>()

  useEffect(() => {
    if (typeof window === 'undefined') return

    videoRef.current = document.createElement('video')
    videoRef.current.autoplay = true
    videoRef.current.playsInline = true
    videoRef.current.muted = true

    canvasRef.current = document.createElement('canvas')
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (selfieSegmentationRef.current) {
        selfieSegmentationRef.current.close()
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
    }
  }, [])


  const initSelfieSegmentation = useCallback(async () => {
    if (!canvasRef.current) return null

    const selfieSegmentation = new SelfieSegmentation({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
    })

    selfieSegmentation.setOptions({
      modelSelection: 1, 
      selfieMode: false,
    })

    selfieSegmentation.onResults((results) => {
      if (!canvasRef.current) return
      
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)


      ctx.filter = 'blur(10px)'
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height)
      ctx.filter = 'none'

      ctx.globalCompositeOperation = 'destination-in'
      ctx.drawImage(results.segmentationMask, 0, 0, canvas.width, canvas.height)

      ctx.globalCompositeOperation = 'source-over'
    })

    selfieSegmentationRef.current = selfieSegmentation
    return selfieSegmentation
  }, [])

  useEffect(() => {
    if (!videoTrack || !enabled) {
      setProcessedTrack(null)
      return
    }

    let isActive = true

    const startProcessing = async () => {
      if (!videoRef.current || !canvasRef.current) return

      const mediaStream = new MediaStream([videoTrack])
      videoRef.current.srcObject = mediaStream

      await new Promise((resolve) => {
        if (!videoRef.current) return
        if (videoRef.current.videoWidth) {
          resolve(true)
        } else {
          videoRef.current.onloadedmetadata = () => resolve(true)
        }
      })

      if (!isActive || !videoRef.current) return
      const { videoWidth, videoHeight } = videoRef.current

      const targetWidth = Math.min(videoWidth, 640)
      const targetHeight = (videoHeight / videoWidth) * targetWidth

      canvasRef.current.width = targetWidth
      canvasRef.current.height = targetHeight

      const selfieSegmentation = await initSelfieSegmentation()
      if (!selfieSegmentation || !isActive) return

      const canvasStream = canvasRef.current.captureStream(30)
      const videoTracks = canvasStream.getVideoTracks()
      if (videoTracks.length) {
        setProcessedTrack(videoTracks[0])
      }
      const processFrame = async () => {
        if (!videoRef.current || !selfieSegmentation) return
        
        await selfieSegmentation.send({ image: videoRef.current })
        
        if (isActive) {
          animationRef.current = requestAnimationFrame(processFrame)
        }
      }

      processFrame()
    }

    startProcessing()

    return () => {
      isActive = false
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [videoTrack, enabled, initSelfieSegmentation])

  useEffect(() => {
    if (!enabled && animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
  }, [enabled])

  return { processedTrack }
}