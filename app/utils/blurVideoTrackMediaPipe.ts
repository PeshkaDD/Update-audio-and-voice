import { Observable } from 'rxjs';
import { SelfieSegmentation } from '@mediapipe/selfie_segmentation';

let segmenter: SelfieSegmentation | null = null;

async function getSegmenter(): Promise<SelfieSegmentation> {
  if (!segmenter) {
    console.log('Initializing MediaPipe SelfieSegmentation...');
    segmenter = new SelfieSegmentation({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
    });
    segmenter.setOptions({
      modelSelection: 1,   // general model
      selfieMode: false,
    });
    await segmenter.initialize();
    console.log('MediaPipe segmenter initialized');
  }
  return segmenter;
}

export default function blurVideoTrackMediaPipe(
  originalTrack: MediaStreamTrack
): Observable<MediaStreamTrack> {
  console.log('blurVideoTrackMediaPipe called with track:', originalTrack);
  return new Observable((subscriber) => {
    let isActive = true;
    const canvas = document.createElement('canvas');
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;

    const mediaStream = new MediaStream([originalTrack]);
    video.srcObject = mediaStream;

    let animationFrame: number;
    let outputTrack: MediaStreamTrack | null = null;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      subscriber.error(new Error('Could not get canvas 2D context'));
      return;
    }

    const processFrame = async () => {
      if (!isActive) return;
      if (video.readyState < 2) {
        // Video not ready yet, wait for next frame
        animationFrame = requestAnimationFrame(processFrame);
        return;
      }

      const { videoWidth: w, videoHeight: h } = video;
      if (!w || !h) {
        animationFrame = requestAnimationFrame(processFrame);
        return;
      }

      canvas.width = w;
      canvas.height = h;

      try {
        const seg = await getSegmenter();
        await seg.send({ image: video });
        // Results are handled in seg.onResults
      } catch (e) {
        console.error('MediaPipe frame error:', e);
      }

      if (isActive) {
        animationFrame = requestAnimationFrame(processFrame);
      }
    };

    getSegmenter()
      .then((seg) => {
        seg.onResults((results) => {
          if (!isActive || !canvas) return;

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Blurred background
          ctx.filter = 'blur(12px)';
          ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
          ctx.filter = 'none';

          // Person mask
          ctx.globalCompositeOperation = 'destination-in';
          ctx.drawImage(results.segmentationMask, 0, 0, canvas.width, canvas.height);
          ctx.globalCompositeOperation = 'source-over';
        });

        video.onloadedmetadata = () => {
          console.log('Video metadata loaded:', video.videoWidth, 'x', video.videoHeight);
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const stream = canvas.captureStream(30);
          outputTrack = stream.getVideoTracks()[0];
          console.log('Output track created:', outputTrack);
          subscriber.next(outputTrack);
          console.log('Track emitted to subscriber');

          processFrame();
        };

        video.onerror = (e) => {
          console.error('Video element error:', e);
          subscriber.error(e);
        };

        video.play().catch((e) => {
          console.error('Video play failed:', e);
          subscriber.error(e);
        });
      })
      .catch((e) => {
        console.error('Failed to get segmenter:', e);
        subscriber.error(e);
      });

    // Cleanup on unsubscribe
    return () => {
      console.log('Cleaning up blurVideoTrackMediaPipe');
      isActive = false;
      if (animationFrame) cancelAnimationFrame(animationFrame);
      if (outputTrack) {
        outputTrack.stop();
        console.log('Output track stopped');
      }
      video.pause();
      video.srcObject = null;
      mediaStream.getTracks().forEach((t) => t.stop());
      canvas.remove();
    };
  });
}