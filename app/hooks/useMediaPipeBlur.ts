import { useEffect, useRef, useState } from 'react';
import { SelfieSegmentation } from '@mediapipe/selfie_segmentation';

export function useMediaPipeBlur(enabled: boolean, videoTrack?: MediaStreamTrack) {
  const [processedTrack, setProcessedTrack] = useState<MediaStreamTrack | null>(null);
  const activeRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  const lastVideoTrackRef = useRef<MediaStreamTrack | null>(null);

  useEffect(() => {
    if (!enabled || !videoTrack || !(videoTrack instanceof MediaStreamTrack)) {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      setProcessedTrack(null);
      activeRef.current = false;
      lastVideoTrackRef.current = null;
      return;
    }

    if (videoTrack.readyState === 'ended') return;
    if (lastVideoTrackRef.current === videoTrack && activeRef.current) return;

    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    lastVideoTrackRef.current = videoTrack;
    activeRef.current = true;

    console.log('MediaPipe blur started');

    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      activeRef.current = false;
      return;
    }

    const mediaStream = new MediaStream([videoTrack]);
    video.srcObject = mediaStream;

    let animationFrame: number;
    let segmenter: SelfieSegmentation | null = null;
    let outputTrack: MediaStreamTrack | null = null;
    let isCleanedUp = false;

    const initSegmenter = async () => {
      const seg = new SelfieSegmentation({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
      });
      seg.setOptions({ modelSelection: 1, selfieMode: false });
      await seg.initialize();
      return seg;
    };

    const processFrame = async () => {
      if (!activeRef.current || !segmenter || isCleanedUp) return;
      if (video.readyState < 2) {
        animationFrame = requestAnimationFrame(processFrame);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      try {
        await segmenter.send({ image: video });
      } catch (e) {
        console.error('MediaPipe frame error:', e);
      }
      animationFrame = requestAnimationFrame(processFrame);
    };

    initSegmenter()
      .then((seg) => {
        if (!activeRef.current || isCleanedUp) {
          seg.close();
          return;
        }
        segmenter = seg;
        segmenter.onResults((results) => {
          if (!activeRef.current || isCleanedUp) return;

          const w = canvas.width;
          const h = canvas.height;

          // Step 1: Draw the original sharp video
          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(results.image, 0, 0, w, h);

          // Step 2: Draw the blurred background behind the person
          ctx.save();
          ctx.filter = 'blur(24px)';
          ctx.globalCompositeOperation = 'destination-over';
          ctx.drawImage(results.image, 0, 0, w, h);
          ctx.restore();

          // Step 3: Apply the segmentation mask to keep the person sharp
          ctx.save();
          ctx.globalCompositeOperation = 'destination-in';
          ctx.drawImage(results.segmentationMask, 0, 0, w, h);
          ctx.restore();
        });

        video.onloadedmetadata = () => {
          if (!activeRef.current || isCleanedUp) return;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const stream = canvas.captureStream(60);
          outputTrack = stream.getVideoTracks()[0];
          console.log('Blur output track created:', outputTrack.id);
          setProcessedTrack(outputTrack);
          processFrame();
        };

        if (video.readyState >= 2) {
          video.onloadedmetadata(null as any);
        }

        video.play().catch(console.warn);
      })
      .catch((err) => {
        console.error('MediaPipe init error:', err);
        activeRef.current = false;
      });

    const cleanup = () => {
      console.log('Cleaning up MediaPipe blur');
      if (isCleanedUp) return;
      isCleanedUp = true;
      activeRef.current = false;
      if (animationFrame) cancelAnimationFrame(animationFrame);
      video.pause();
      video.srcObject = null;
      canvas.remove();
      if (outputTrack) {
        outputTrack.stop();
        outputTrack = null;
      }
      if (segmenter) {
        try {
          segmenter.close();
        } catch (e) {
          console.warn('Segmenter close error:', e);
        }
        segmenter = null;
      }
    };

    cleanupRef.current = cleanup;
    return cleanup;
  }, [enabled, videoTrack]);

  return processedTrack;
}