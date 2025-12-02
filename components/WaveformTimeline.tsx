
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Subtitle } from '../types';

interface WaveformTimelineProps {
  file: File | null;
  subtitles: Subtitle[];
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}

export const WaveformTimeline: React.FC<WaveformTimelineProps> = ({ 
  file, 
  subtitles, 
  currentTime, 
  duration,
  onSeek 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [waveformPeaks, setWaveformPeaks] = useState<Float32Array | null>(null);
  const [isDecoding, setIsDecoding] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  // Decode Audio & Pre-calculate Peaks
  useEffect(() => {
    if (!file) {
        setWaveformPeaks(null);
        return;
    }

    const decodeAudio = async () => {
      setIsDecoding(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // Calculate Peaks
        const channels = decodedBuffer.getChannelData(0);
        const buckets = 2000; // Resolution
        const peaks = new Float32Array(buckets * 2);
        const step = Math.ceil(channels.length / buckets);

        for (let i = 0; i < buckets; i++) {
            let min = 1.0;
            let max = -1.0;
            for (let j = 0; j < step; j++) {
                const idx = i * step + j;
                if (idx < channels.length) {
                    const val = channels[idx];
                    if (val < min) min = val;
                    if (val > max) max = val;
                }
            }
            peaks[i * 2] = min;
            peaks[i * 2 + 1] = max;
        }
        setWaveformPeaks(peaks);

      } catch (error) {
        console.error("Error decoding audio data for waveform:", error);
      } finally {
        setIsDecoding(false);
      }
    };

    decodeAudio();
  }, [file]);

  // Optimized Draw
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = container.clientWidth;
    canvas.height = 80;

    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#f9fafb';
    ctx.fillRect(0, 0, width, height);

    // 1. Draw Waveform from Cache
    if (waveformPeaks) {
        const buckets = waveformPeaks.length / 2;
        const barWidth = width / buckets;
        const amp = height / 2;
        
        ctx.fillStyle = '#cbd5e1'; // Slate-300
        ctx.beginPath();
        for (let i = 0; i < buckets; i++) {
            const min = waveformPeaks[i * 2];
            const max = waveformPeaks[i * 2 + 1];
            ctx.rect(i * barWidth, (1 + min) * amp, Math.max(1, barWidth), Math.max(1, (max - min) * amp));
        }
        ctx.fill();
    }

    // 2. Draw Subtitle Blocks
    if (duration > 0) {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.3)'; 
        ctx.strokeStyle = 'rgba(37, 99, 235, 0.5)';
        
        subtitles.forEach(sub => {
            const startX = (sub.startTime / duration) * width;
            const endX = (sub.endTime / duration) * width;
            const w = Math.max(1, endX - startX);
            
            ctx.fillRect(startX, 10, w, height - 20);
            ctx.strokeRect(startX, 10, w, height - 20);
        });
    }

    // 3. Draw Playhead
    if (duration > 0) {
        const x = (currentTime / duration) * width;
        ctx.beginPath();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();

        ctx.fillStyle = '#ef4444';
        ctx.font = '10px monospace';
        ctx.fillText(formatTime(currentTime), x + 4, 12);
    }
    
    // 4. Draw Hover Line
    if (hoverTime !== null && duration > 0) {
        const x = (hoverTime / duration) * width;
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 2]);
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
        ctx.setLineDash([]);
    }
  }, [waveformPeaks, subtitles, currentTime, duration, hoverTime]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
      const handleResize = () => requestAnimationFrame(draw);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || duration === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / rect.width) * duration;
    setHoverTime(Math.max(0, Math.min(time, duration)));
  };

  const handleMouseLeave = () => {
    setHoverTime(null);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || duration === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / rect.width) * duration;
    onSeek(Math.max(0, Math.min(time, duration)));
  };

  const handleTouch = (e: React.TouchEvent<HTMLDivElement>) => {
      if (!containerRef.current || duration === 0 || e.touches.length === 0) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.touches[0].clientX - rect.left;
      const time = (x / rect.width) * duration;
      const seekTime = Math.max(0, Math.min(time, duration));
      setHoverTime(seekTime);
      onSeek(seekTime);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full select-none">
       {isDecoding && (
           <div className="text-xs text-gray-400 mb-1 flex items-center gap-2">
               <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
               Generating Audio Waveform...
           </div>
       )}
       <div 
         ref={containerRef}
         className="relative h-20 bg-gray-50 rounded-lg overflow-hidden border border-gray-200 cursor-crosshair shadow-inner touch-none"
         onMouseMove={handleMouseMove}
         onMouseLeave={handleMouseLeave}
         onClick={handleClick}
         onTouchStart={handleTouch}
         onTouchMove={handleTouch}
         onTouchEnd={handleMouseLeave}
       >
         <canvas ref={canvasRef} className="block w-full h-full" />
       </div>
    </div>
  );
};
