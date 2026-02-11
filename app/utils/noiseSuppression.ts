// adopted from https://github.com/jitsi/jitsi-meet/tree/master/react/features/stream-effects/noise-suppression

import { Observable } from 'rxjs'
import invariant from 'tiny-invariant'

class WebAudioNoiseSuppressor {
    private audioContext: AudioContext;
    private source: MediaStreamAudioSourceNode | null = null;
    private compressor: DynamicsCompressorNode | null = null;
    private filter: BiquadFilterNode | null = null;
    private destination: MediaStreamAudioDestinationNode | null = null;
    
    private enabled = true;
    private level = 0.7;

    constructor() {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    async apply(stream: MediaStream): Promise<MediaStream> {
        if (!this.enabled || !stream.getAudioTracks().length) {
            return stream;
        }

        try {
            this.source = this.audioContext.createMediaStreamSource(stream);
            this.filter = this.audioContext.createBiquadFilter();
            this.compressor = this.audioContext.createDynamicsCompressor();
            this.destination = this.audioContext.createMediaStreamDestination();
            
            this.filter.type = 'highpass';
            this.filter.frequency.value = 100;
            this.updateCompressor();
            
            this.source.connect(this.filter);
            this.filter.connect(this.compressor);
            this.compressor.connect(this.destination);
            
            const processedAudio = this.destination.stream.getAudioTracks()[0];
            const videoTracks = stream.getVideoTracks();
            
            return new MediaStream([processedAudio, ...videoTracks]);

        } catch (error) {
            console.warn('Noise suppression failed:', error);
            return stream;
        }
    }

    updateSettings(enabled: boolean, level: number): void {
        this.enabled = enabled;
        this.level = Math.max(0, Math.min(1, level));
        this.updateCompressor();
    }

    private updateCompressor(): void {
        if (!this.compressor) return;
        this.compressor.threshold.value = -50 * this.level;
        this.compressor.knee.value = 30 + (10 * this.level);
        this.compressor.ratio.value = 5 + (7 * this.level);
        this.compressor.attack.value = 0.005;
        this.compressor.release.value = 0.200;
    }

    dispose(): void {
        this.source?.disconnect();
        this.filter?.disconnect();
        this.compressor?.disconnect();
        if (this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
    }
}

let suppressorInstance: WebAudioNoiseSuppressor | null = null
let currentLevel: number = 0.7 
let currentEnabled: boolean = true

export default function noiseSuppression(
	originalAudioStreamTrack: MediaStreamTrack
): Observable<MediaStreamTrack> {
	return new Observable<MediaStreamTrack>((subscriber) => {
		const mediaStream = new MediaStream()
		mediaStream.addTrack(originalAudioStreamTrack)
		
		if (!suppressorInstance) {
			suppressorInstance = new WebAudioNoiseSuppressor()
		}
		suppressorInstance.updateSettings(currentEnabled, currentLevel)
		
		suppressorInstance.apply(mediaStream).then((outputStream) => {
			const noiseSuppressedTrack = outputStream.getAudioTracks()[0]
			subscriber.add(() => {
				suppressorInstance?.dispose()
			})
			subscriber.next(noiseSuppressedTrack)
		}).catch((error) => {
			console.error('Noise suppression failed:', error)
			subscriber.next(originalAudioStreamTrack) // Fallback
		})
	})
}

export function updateNoiseSuppressionLevel(level: number): void {
	currentLevel = Math.max(0.1, Math.min(1.0, level))
	if (suppressorInstance) {
	  suppressorInstance.updateSettings(currentEnabled, currentLevel)
	}
  }
  
  export function updateNoiseSuppressionEnabled(enabled: boolean): void {
	currentEnabled = enabled
	if (suppressorInstance) {
	  suppressorInstance.updateSettings(currentEnabled, currentLevel)
	}
  }
  
  export function getCurrentNoiseSuppressionLevel(): number {
	return currentLevel
  }
  
  export function isNoiseSuppressionEnabled(): boolean {
	return currentEnabled
  }
/**
 * Effect applies rnnoise denoising on a audio MediaStreamTrack.
 */
class NoiseSuppressionEffect {
	/**
	 * Web audio context.
	 */
	private _audioContext?: AudioContext

	/**
	 * Source that will be attached to the track affected by the effect.
	 */
	private _audioSource?: MediaStreamAudioSourceNode

	/**
	 * Destination that will contain denoised audio from the audio worklet.
	 */
	private _audioDestination?: MediaStreamAudioDestinationNode

	/**
	 * `AudioWorkletProcessor` associated node.
	 */
	private _noiseSuppressorNode?: AudioWorkletNode

	/**
	 * Audio track extracted from the original MediaStream to which the effect is applied.
	 */
	private _originalMediaTrack?: MediaStreamTrack

	/**
	 * Noise suppressed audio track extracted from the media destination node.
	 */
	private _outputMediaTrack?: MediaStreamTrack

	/**
	 * Applies effect that uses a {@code NoiseSuppressor} service initialized with {@code RnnoiseProcessor}
	 * for denoising.
	 *
	 * @param {MediaStream} audioStream - Audio stream which will be mixed with _mixAudio.
	 * @returns {MediaStream} - MediaStream containing both audio tracks mixed together.
	 */
	startEffect(audioStream: MediaStream): MediaStream {
		this._audioContext = new AudioContext()
		this._originalMediaTrack = audioStream.getAudioTracks()[0]
		this._audioSource = this._audioContext.createMediaStreamSource(audioStream)
		this._audioDestination = this._audioContext.createMediaStreamDestination()
		this._outputMediaTrack = this._audioDestination.stream.getAudioTracks()[0]

		const workletUrl = `/noise/noise-suppressor-worklet.esm.js`

		// Connect the audio processing graph MediaStream -> AudioWorkletNode -> MediaStreamAudioDestinationNode
		this._audioContext.audioWorklet
			.addModule(workletUrl)
			.then(() => {
				invariant(this._audioContext)
				if (this._audioContext.state === 'closed') return
				// After the resolution of module loading, an AudioWorkletNode can be constructed.
				this._noiseSuppressorNode = new AudioWorkletNode(
					this._audioContext,
					'NoiseSuppressorWorklet'
				)
				invariant(this._audioSource)
				invariant(this._audioDestination)
				this._audioSource
					.connect(this._noiseSuppressorNode)
					.connect(this._audioDestination)
			})
			.catch((error) => {
				console.error(error)
			})

		// Sync the effect track muted state with the original track state.
		this._outputMediaTrack.enabled = this._originalMediaTrack.enabled

		// We enable the audio on the original track because mute/unmute action will only affect the audio destination
		// output track from this point on.
		this._originalMediaTrack.enabled = true

		return this._audioDestination.stream
	}

	/**
	 * Clean up resources acquired by noise suppressor and rnnoise processor.
	 *
	 * @returns {void}
	 */
	stopEffect(): void {
		// Sync original track muted state with effect state before removing the effect.
		invariant(this._originalMediaTrack)
		invariant(this._outputMediaTrack)
		this._originalMediaTrack.enabled = this._outputMediaTrack.enabled

		// Technically after this process the Audio Worklet along with it's resources should be garbage collected,
		// however on chrome there seems to be a problem as described here:
		// https://bugs.chromium.org/p/chromium/issues/detail?id=1298955
		this._noiseSuppressorNode?.port?.close()
		this._audioDestination?.disconnect()
		this._noiseSuppressorNode?.disconnect()
		this._audioSource?.disconnect()
		this._audioContext?.close()
	}
}
