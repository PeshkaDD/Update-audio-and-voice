import { type FC } from 'react'
import useMediaDevices from '~/hooks/useMediaDevices'
import { useRoomContext } from '~/hooks/useRoomContext'
import { errorMessageMap } from '~/hooks/useUserMedia'
import { Option, Select } from './Select'

export const VideoInputSelector: FC<{ id?: string }> = ({ id }) => {
	const videoInputDevices = useMediaDevices((d) => d.kind === 'videoinput')

	const context = useRoomContext()
	const { userMedia } = context
	
	const { 
		videoUnavailableReason, 
		videoDeviceId, 
		setVideoDeviceId,
		blurVideo,
		setBlurVideo,
		videoStreamTrack
	} = userMedia

	if (videoUnavailableReason) {
		return (
			<div className="max-w-[40ch]">
				<Select
					tooltipContent={errorMessageMap[videoUnavailableReason]}
					id={id}
					defaultValue="unavailable"
				>
					<Option value="unavailable">(Unavailable)</Option>
				</Select>
			</div>
		)
	}

	return (
		<div className="space-y-2">

			{/* Background blur button */}
			<div className="flex items-center gap-2 pt-1">
				<button
					onClick={() => setBlurVideo(!blurVideo)}
					disabled={!videoStreamTrack}
					className={`
						inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded
						transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1
						${blurVideo 
							? 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300' 
							: 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
						}
						${!videoStreamTrack && 'opacity-50 cursor-not-allowed'}
					`}
					title={!videoStreamTrack ? 'Camera not active' : (blurVideo ? 'Disable background blur' : 'Enable background blur')}
				>
					<svg 
						className="w-3.5 h-3.5" 
						fill="none" 
						stroke="currentColor" 
						viewBox="0 0 24 24"
					>
						<path 
							strokeLinecap="round" 
							strokeLinejoin="round" 
							strokeWidth={2} 
							d="M12 4v16M4 12h16" 
						/>
					</svg>
					<span>{blurVideo ? 'Blur active' : 'Blur background'}</span>
				</button>
				
				{/* Activity indicator (optional) */}
				{blurVideo && videoStreamTrack && (
					<span className="text-xs text-green-600 animate-pulse" title="Background blur is active">
						●
					</span>
				)}
			</div>
		</div>
	)
}