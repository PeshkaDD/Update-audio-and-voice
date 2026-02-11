import type { FC, ReactNode } from 'react'
import { useState, useEffect } from 'react'
import { useRoomContext } from '~/hooks/useRoomContext'
import { AudioInputSelector } from './AudioInputSelector'
import { Button } from './Button'
import {
	Dialog,
	DialogContent,
	DialogOverlay,
	DialogTitle,
	Portal,
	Trigger,
} from './Dialog'
import { Icon } from './Icon/Icon'
import { Label } from './Label'
import { Toggle } from './Toggle'
import { Tooltip } from './Tooltip'
import { VideoInputSelector } from './VideoInputSelector'

interface SettingsDialogProps {
	onOpenChange?: (open: boolean) => void
	open?: boolean
	children?: ReactNode
}

export const SettingsButton = () => {
	return (
		<SettingsDialog>
			<Tooltip content="Settings">
				<Trigger asChild>
					<Button className="text-sm" displayType="secondary">
						<Icon type="cog" />
					</Button>
				</Trigger>
			</Tooltip>
		</SettingsDialog>
	)
}

export const SettingsDialog: FC<SettingsDialogProps> = ({
	onOpenChange,
	open,
	children,
}) => {
	const {
		userMedia: { 
			blurVideo, 
			setBlurVideo, 
			suppressNoise, 
			setSuppressNoise, 
		},
		noiseSuppressionLevel = 0.7, 
		setNoiseSuppressionLevel 
	} = useRoomContext()
	
	const [localLevel, setLocalLevel] = useState(noiseSuppressionLevel)

	useEffect(() => {
		setLocalLevel(noiseSuppressionLevel)
	}, [noiseSuppressionLevel])

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			{children}
			<Portal>
				<DialogOverlay />
				<DialogContent>
					<DialogTitle>Settings</DialogTitle>
					<div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-4 mt-8 items-center">
						<Label
							className="text-base -mb-2 md:mb-0 text-left md:text-right"
							htmlFor="camera"
						>
							Camera
						</Label>
						<VideoInputSelector id="camera" />
						<Label
							className="text-base -mb-2 md:mb-0 text-left md:text-right"
							htmlFor="mic"
						>
							Mic
						</Label>
						<AudioInputSelector id="mic" />
						<Label
							className="text-base -mb-2 md:mb-0 text-left md:text-right"
							htmlFor="blurBackground"
						>
							Blur Background
						</Label>
						<div>
							<Toggle
								id="blurBackground"
								checked={blurVideo}
								onCheckedChange={setBlurVideo}
							/>
						</div>
						<Label
							className="text-base -mb-2 md:mb-0 text-left md:text-right"
							htmlFor="suppressNoise"
						>
							Suppress Noise
						</Label>
						<div>
							<Toggle
								id="suppressNoise"
								checked={suppressNoise}
								onCheckedChange={setSuppressNoise}
							/>
						</div>
						
						{}
						{suppressNoise && (
							<>
								{}
								<div></div>
								<div className="ml-2 pl-4 border-l-2 border-blue-500/30 space-y-4">
									<div className="space-y-2">
										<div className="flex justify-between items-center">
											<Label htmlFor="noiseLevel" className="text-sm">
												Suppression Strength
											</Label>
											<span className="text-xs font-mono">
												{Math.round(localLevel * 100)}%
											</span>
										</div>
										{}
										<input
											type="range"
											id="noiseLevel"
											min="0.1"
											max="1"
											step="0.1"
											value={localLevel}
											onChange={(e) => setLocalLevel(parseFloat(e.target.value))}
											onMouseUp={() => setNoiseSuppressionLevel(localLevel)}
											onTouchEnd={() => setNoiseSuppressionLevel(localLevel)}
											className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
										/>
										<div className="flex justify-between text-xs text-gray-500">
											<span>Light</span>
											<span>Medium</span>
											<span>Strong</span>
										</div>
									</div>
								</div>
							</>
						)}
						{}
					</div>
				</DialogContent>
			</Portal>
		</Dialog>
	)
}