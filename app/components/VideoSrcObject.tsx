import { forwardRef, useEffect, useRef, useState } from 'react'
import { cn } from '~/utils/style'
import { useBackgroundBlur } from '~/hooks/useBackground'
import { useRoomContext } from '~/hooks/useRoomContext'

export type VideoSrcObjectProps = Omit<
	JSX.IntrinsicElements['video'],
	'ref'
> & {
	videoTrack?: MediaStreamTrack
	onBlurToggle?: (isBlurring: boolean) => void
}

export const VideoSrcObject = forwardRef<HTMLVideoElement, VideoSrcObjectProps>(
	({ videoTrack, onBlurToggle,  className, ...rest }, ref) => {
		const internalRef = useRef<HTMLVideoElement | null>(null)
		const [stream, setStream] = useState<MediaStream | null>(null)
		const { userMedia } = useRoomContext()
		const blurVideo = userMedia?.blurVideo || false
		useEffect(() => {
			onBlurToggle?.(blurVideo)
		}, [blurVideo, onBlurToggle])
		const { processedTrack } = useBackgroundBlur({ 
			videoTrack: blurVideo ? videoTrack : undefined, 
			enabled: Boolean(blurVideo && videoTrack)
		})

		useEffect(() => {
			const track = blurVideo ? processedTrack : videoTrack
			
			const mediaStream = new MediaStream()
			if (track) {
				mediaStream.addTrack(track)
			}
			
			setStream(mediaStream)

			return () => {
			}
		}, [videoTrack, processedTrack, blurVideo])

		useEffect(() => {
			const video = internalRef.current
			if (!video || !stream) return

			video.srcObject = stream
			video.setAttribute('autoplay', 'true')
			video.setAttribute('playsinline', 'true')

			return () => {
				if (video) video.srcObject = null
			}
		}, [stream])
		return (
			<video
				className={cn(
					'bg-zinc-700', 
					blurVideo && 'video-blur-active', 
					className
				)}
				ref={(v) => {
					internalRef.current = v
					if (ref === null) return
					if (typeof ref === 'function') {
						ref(v)
					} else {
						ref.current = v
					}
				}}
				{...rest}
			/>
		)
	}
)

VideoSrcObject.displayName = 'VideoSrcObject'
