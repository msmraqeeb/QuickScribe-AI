import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { Subtitle, SubtitleStyle } from '../types';

interface VideoPlayerProps {
  videoUrl: string | null;
  subtitles: Subtitle[];
  styleConfig: SubtitleStyle;
  fitContainer?: boolean;
  onTimeUpdate?: (time: number) => void;
  onDurationChange?: (duration: number) => void;
}

export const VideoPlayer = React.memo(forwardRef<HTMLVideoElement, VideoPlayerProps>(({ 
  videoUrl, 
  subtitles, 
  styleConfig,
  fitContainer = false,
  onTimeUpdate,
  onDurationChange
}, ref) => {
  const internalRef = useRef<HTMLVideoElement>(null);
  const [localCurrentTime, setLocalCurrentTime] = useState(0);
  const requestRef = useRef<number>(0);

  // Expose the video element to parent via ref
  useImperativeHandle(ref, () => internalRef.current!);

  useEffect(() => {
    const video = internalRef.current;
    if (!video) return;

    const updateLoop = () => {
      if (video && !video.paused && !video.ended) {
        const time = video.currentTime;
        setLocalCurrentTime(time);
        if (onTimeUpdate) onTimeUpdate(time);
      }
      requestRef.current = requestAnimationFrame(updateLoop);
    };

    const handleSeek = () => {
        const time = video.currentTime;
        setLocalCurrentTime(time);
        if (onTimeUpdate) onTimeUpdate(time);
    };

    const handleLoadedMetadata = () => {
        if (onDurationChange) onDurationChange(video.duration);
    };

    requestRef.current = requestAnimationFrame(updateLoop);
    video.addEventListener('seeked', handleSeek);
    video.addEventListener('play', updateLoop);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      video.removeEventListener('seeked', handleSeek);
      video.removeEventListener('play', updateLoop);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [videoUrl, onTimeUpdate, onDurationChange]);

  // Find the active subtitle based on local time (for high perf)
  const activeSubtitle = subtitles.find(
    (sub) => localCurrentTime >= sub.startTime && localCurrentTime <= sub.endTime
  );

  const getPositionClass = () => {
    switch (styleConfig.position) {
      case 'top': return 'top-10';
      case 'middle': return 'top-1/2 -translate-y-1/2';
      case 'bottom': return 'bottom-10';
      default: return 'bottom-10';
    }
  };

  if (!videoUrl) {
    return (
      <div className={`w-full bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-300 ${fitContainer ? 'h-full' : 'aspect-video'}`}>
        <p>No video selected</p>
      </div>
    );
  }

  return (
    <div className={`relative rounded-lg overflow-hidden bg-black shadow-lg ${fitContainer ? 'w-full h-full flex items-center justify-center' : 'w-full'}`}>
      <video
        ref={internalRef}
        src={videoUrl}
        className={`${fitContainer ? 'max-w-full max-h-full object-contain' : 'w-full h-auto'} block`}
        controls
        playsInline
        // Disable native fullscreen to force using our container for overlays
        controlsList="nofullscreen"
      />
      
      {/* Subtitle Overlay */}
      <div className="absolute inset-0 pointer-events-none flex justify-center w-full z-50">
         <div className={`absolute w-full px-8 text-center ${getPositionClass()}`}>
            {activeSubtitle && (
              <span
                className="pointer-events-auto"
                style={{
                  fontSize: `${styleConfig.fontSize}px`,
                  color: styleConfig.color,
                  backgroundColor: styleConfig.backgroundColor === 'transparent' 
                    ? 'transparent' 
                    : `rgba(${parseInt(styleConfig.backgroundColor.slice(1, 3), 16)}, ${parseInt(styleConfig.backgroundColor.slice(3, 5), 16)}, ${parseInt(styleConfig.backgroundColor.slice(5, 7), 16)}, ${styleConfig.backgroundOpacity})`,
                  fontFamily: styleConfig.fontFamily,
                  textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  display: 'inline-block',
                  maxWidth: '90%',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {activeSubtitle.text}
              </span>
            )}
         </div>
      </div>
    </div>
  );
}));

VideoPlayer.displayName = 'VideoPlayer';