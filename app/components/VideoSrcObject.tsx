import { forwardRef, useEffect, useRef } from 'react';
import { cn } from '~/utils/style';
import { useMediaPipeBlur } from '~/hooks/useMediaPipeBlur';
import { useRoomContext } from '~/hooks/useRoomContext';

export type VideoSrcObjectProps = Omit<
  JSX.IntrinsicElements['video'],
  'ref'
> & {
  videoTrack?: MediaStreamTrack;
};

export const VideoSrcObject = forwardRef<HTMLVideoElement, VideoSrcObjectProps>(
  ({ videoTrack, className, ...rest }, ref) => {
    const internalRef = useRef<HTMLVideoElement | null>(null);
    const { userMedia } = useRoomContext();
    const blurEnabled = userMedia?.blurVideo ?? false;

    const blurredTrack = useMediaPipeBlur(blurEnabled, videoTrack);
    const displayTrack = blurEnabled ? (blurredTrack || videoTrack) : videoTrack;

    // Log current display track and blur state for debugging
    console.log('VideoSrcObject displayTrack:', displayTrack?.id, 'blurEnabled:', blurEnabled);

    const prevTrackRef = useRef<MediaStreamTrack | null>(null);
    const timeoutRef = useRef<number>();

    useEffect(() => {
      const video = internalRef.current;
      if (!video) return;

      // Skip if track hasn't changed
      if (prevTrackRef.current === displayTrack) return;

      // Clear any pending timeout
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      if (!displayTrack) {
        video.srcObject = null;
        prevTrackRef.current = null;
        return;
      }

      // Helper to set stream once track is live
      const setStream = () => {
        if (displayTrack.readyState === 'live') {
          const stream = new MediaStream([displayTrack]);
          video.srcObject = stream;
          video.play().catch(console.warn);
          prevTrackRef.current = displayTrack;
        } else {
          // Retry until track becomes live
          timeoutRef.current = window.setTimeout(setStream, 50);
        }
      };

      // Small delay to allow previous track to clean up
      timeoutRef.current = window.setTimeout(setStream, 50);
    }, [displayTrack]);

    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }, []);

    return (
      <video
        className={cn('bg-zinc-700', className)}
        ref={(v) => {
          internalRef.current = v;
          if (ref === null) return;
          if (typeof ref === 'function') ref(v);
          else ref.current = v;
        }}
        {...rest}
      />
    );
  }
);

VideoSrcObject.displayName = 'VideoSrcObject';