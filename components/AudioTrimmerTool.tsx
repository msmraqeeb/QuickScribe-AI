
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { UploadCloud, Scissors, Download, Play, Pause, RefreshCw, Music, AlertCircle } from 'lucide-react';
import { audioBufferToWav } from '../utils/audioHelpers';

export const AudioTrimmerTool: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [waveformPeaks, setWaveformPeaks] = useState<Float32Array | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  
  // Trim Range (seconds)
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  
  const [trimmedBlob, setTrimmedBlob] = useState<Blob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Interaction State
  const [dragTarget, setDragTarget] = useState<'start' | 'end' | 'seek' | null>(null);
  const [hoverTarget, setHoverTarget] = useState<'start' | 'end' | 'seek' | null>(null);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef(0);
  const rafRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      stopPlayback();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Pre-compute Peaks for Performance
  useEffect(() => {
      if (!audioBuffer) {
          setWaveformPeaks(null);
          return;
      }

      const channels = audioBuffer.getChannelData(0);
      const buckets = 2000; // Resolution for drawing
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
  }, [audioBuffer]);


  // Draw Waveform
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !audioBuffer || !waveformPeaks) return;

    canvas.width = container.clientWidth;
    canvas.height = 120;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const amp = height / 2;

    // Clear
    ctx.clearRect(0, 0, width, height);
    
    // Background
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, width, height);

    const buckets = waveformPeaks.length / 2;
    const barWidth = width / buckets;

    // 1. Draw Full Waveform (Gray)
    ctx.fillStyle = '#d1d5db';
    ctx.beginPath();
    for (let i = 0; i < buckets; i++) {
        const min = waveformPeaks[i * 2];
        const max = waveformPeaks[i * 2 + 1];
        ctx.rect(i * barWidth, (1 + min) * amp, Math.max(1, barWidth), Math.max(1, (max - min) * amp));
    }
    ctx.fill();

    // Calculate pixels for selection
    const startX = (startTime / audioBuffer.duration) * width;
    const endX = (endTime / audioBuffer.duration) * width;

    // 2. Draw Selected Waveform (Blue)
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    
    // Map time range to bucket range
    const startBucket = Math.floor((startTime / audioBuffer.duration) * buckets);
    const endBucket = Math.ceil((endTime / audioBuffer.duration) * buckets);

    for (let i = startBucket; i < endBucket; i++) {
        if (i < 0 || i >= buckets) continue;
        const min = waveformPeaks[i * 2];
        const max = waveformPeaks[i * 2 + 1];
        ctx.rect(i * barWidth, (1 + min) * amp, Math.max(1, barWidth), Math.max(1, (max - min) * amp));
    }
    ctx.fill();

    // 3. Selection Overlay Box
    ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
    ctx.fillRect(startX, 0, endX - startX, height);
    
    // 4. Handles (Start / End)
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    // Start Handle
    ctx.moveTo(startX, 0);
    ctx.lineTo(startX, height);
    // End Handle
    ctx.moveTo(endX, 0);
    ctx.lineTo(endX, height);
    ctx.stroke();

    // Handle Knobs (Visual cues)
    ctx.fillStyle = '#2563eb';
    // Top knobs
    ctx.fillRect(startX - 4, 0, 8, 8);
    ctx.fillRect(endX - 4, 0, 8, 8);
    // Bottom knobs
    ctx.fillRect(startX - 4, height - 8, 8, 8);
    ctx.fillRect(endX - 4, height - 8, 8, 8);

    // 5. Playhead
    const playX = (currentTime / audioBuffer.duration) * width;
    if (playX >= startX && playX <= endX) {
        ctx.strokeStyle = '#ef4444'; // Red
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(playX, 0);
        ctx.lineTo(playX, height);
        ctx.stroke();
    }
  }, [audioBuffer, waveformPeaks, startTime, endTime, currentTime]);

  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  // Handle Resize
  useEffect(() => {
      const handleResize = () => requestAnimationFrame(drawWaveform);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, [drawWaveform]);

  // --- Interaction Logic ---

  const getClientX = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    if ('touches' in e) return e.touches[0].clientX;
    return (e as React.MouseEvent).clientX;
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
      if (!containerRef.current || !audioBuffer) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const x = getClientX(e) - rect.left;
      const clickTime = Math.max(0, Math.min((x / rect.width) * audioBuffer.duration, audioBuffer.duration));
      
      // Threshold for grabbing handles (pixels)
      const pxPerSec = rect.width / audioBuffer.duration;
      const thresholdSec = 15 / pxPerSec; // 15px threshold

      const distStart = Math.abs(clickTime - startTime);
      const distEnd = Math.abs(clickTime - endTime);

      if (distStart < thresholdSec) {
          setDragTarget('start');
      } else if (distEnd < thresholdSec) {
          setDragTarget('end');
      } else {
          setDragTarget('seek');
          setCurrentTime(clickTime);
      }
  };

  const handlePointerMove = useCallback((e: MouseEvent | TouchEvent) => {
      if (!dragTarget || !containerRef.current || !audioBuffer) return;
      e.preventDefault(); // Prevent scroll on touch

      const rect = containerRef.current.getBoundingClientRect();
      let x = getClientX(e) - rect.left;
      // Clamp to container
      x = Math.max(0, Math.min(x, rect.width));
      
      const time = (x / rect.width) * audioBuffer.duration;

      if (dragTarget === 'start') {
          // Clamp start: 0 <= start < end - min_duration
          const newStart = Math.min(time, endTime - 0.1);
          setStartTime(Math.max(0, newStart));
      } else if (dragTarget === 'end') {
          // Clamp end: start + min_duration < end <= duration
          const newEnd = Math.max(time, startTime + 0.1);
          setEndTime(Math.min(audioBuffer.duration, newEnd));
      } else if (dragTarget === 'seek') {
          // Clamp seek within selection ideally, or allow full scrub
          setCurrentTime(time);
      }
  }, [dragTarget, audioBuffer, startTime, endTime]);

  const handlePointerUp = useCallback(() => {
      setDragTarget(null);
  }, []);

  // Cursor updates on hover (Mouse only)
  const handleHoverMove = (e: React.MouseEvent) => {
      if (dragTarget || !containerRef.current || !audioBuffer) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const time = (x / rect.width) * audioBuffer.duration;
      
      const pxPerSec = rect.width / audioBuffer.duration;
      const thresholdSec = 15 / pxPerSec;

      if (Math.abs(time - startTime) < thresholdSec || Math.abs(time - endTime) < thresholdSec) {
          setHoverTarget('start'); // cursor style shared
      } else {
          setHoverTarget(null);
      }
  };

  // Attach global listeners for smooth dragging outside canvas
  useEffect(() => {
      if (dragTarget) {
          window.addEventListener('mousemove', handlePointerMove);
          window.addEventListener('mouseup', handlePointerUp);
          window.addEventListener('touchmove', handlePointerMove, { passive: false });
          window.addEventListener('touchend', handlePointerUp);
      }
      return () => {
          window.removeEventListener('mousemove', handlePointerMove);
          window.removeEventListener('mouseup', handlePointerUp);
          window.removeEventListener('touchmove', handlePointerMove);
          window.removeEventListener('touchend', handlePointerUp);
      };
  }, [dragTarget, handlePointerMove, handlePointerUp]);


  // --- File & Playback Logic ---

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setError(null);
      setIsProcessing(true);
      setTrimmedBlob(null);

      try {
        const arrayBuffer = await selectedFile.arrayBuffer();
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = ctx;
        
        const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
        setAudioBuffer(decodedBuffer);
        
        // Default range: full duration
        setStartTime(0);
        setEndTime(decodedBuffer.duration);
        setCurrentTime(0);
        
      } catch (err) {
        console.error(err);
        setError("Failed to decode audio file. Format might not be supported.");
      } finally {
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    }
  };

  const togglePlayback = () => {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  };

  const startPlayback = () => {
    if (!audioContextRef.current || !audioBuffer) return;

    // Logic: If current time is outside selection or at end, restart from selection start
    let startOffset = currentTime;
    if (currentTime < startTime - 0.1 || currentTime >= endTime - 0.1) {
        startOffset = startTime;
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);
    
    // Play until end of selection
    const durationToPlay = Math.max(0, endTime - startOffset);
    
    source.start(0, startOffset, durationToPlay);
    sourceNodeRef.current = source;
    
    setIsPlaying(true);
    startTimeRef.current = audioContextRef.current.currentTime - startOffset;

    const animate = () => {
        if (!audioContextRef.current) return;
        const now = audioContextRef.current.currentTime - startTimeRef.current;
        
        if (now >= endTime) {
            stopPlayback();
            setCurrentTime(startTime); // Loop back to start or stop at end? Stop is better for trimming.
        } else {
            setCurrentTime(now);
            rafRef.current = requestAnimationFrame(animate);
        }
    };
    rafRef.current = requestAnimationFrame(animate);

    source.onended = () => {
        setIsPlaying(false);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  };

  const stopPlayback = () => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch (e) {}
      sourceNodeRef.current = null;
    }
    setIsPlaying(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  };

  const handleTrim = async () => {
    if (!audioBuffer) return;
    setIsProcessing(true);
    
    try {
        const sampleRate = audioBuffer.sampleRate;
        const startSample = Math.floor(startTime * sampleRate);
        const endSample = Math.floor(endTime * sampleRate);
        const frameCount = endSample - startSample;
        
        if (frameCount <= 0) throw new Error("Invalid selection range");

        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const newBuffer = ctx.createBuffer(audioBuffer.numberOfChannels, frameCount, sampleRate);

        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const oldData = audioBuffer.getChannelData(channel);
            const newData = newBuffer.getChannelData(channel);
            for (let i = 0; i < frameCount; i++) {
                newData[i] = oldData[startSample + i];
            }
        }

        const blob = audioBufferToWav(newBuffer);
        setTrimmedBlob(blob);

    } catch (e: any) {
        console.error(e);
        setError("Error processing trim operation.");
    } finally {
        setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!trimmedBlob) return;
    const url = URL.createObjectURL(trimmedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trimmed_audio_${Date.now()}.wav`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">Audio Trimmer</h1>
      <p className="text-center text-gray-500 mb-12">Cut and trim audio files with precision.</p>

      {!file ? (
         <div 
            className="bg-red-50/50 border-2 border-dashed border-red-200 rounded-3xl p-12 text-center transition-all min-h-[320px] flex flex-col justify-center items-center hover:border-red-400 cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
         >
            <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="audio/*"
                className="hidden" 
            />
            <div className="bg-white p-4 rounded-full shadow-sm mb-6">
                <Scissors className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Click to upload audio</h3>
            <p className="text-gray-500 mb-8">MP3, WAV, OGG (Max 50MB)</p>
            <button className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 font-medium transition-colors">
                Select Audio File
            </button>
         </div>
      ) : (
         <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
             <div className="p-6 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                 <div className="flex items-center gap-3">
                     <div className="p-2 bg-white rounded-lg border border-gray-200">
                         <Music className="w-5 h-5 text-gray-600" />
                     </div>
                     <div>
                         <h3 className="font-bold text-gray-900 max-w-[200px] truncate">{file.name}</h3>
                         <p className="text-xs text-gray-500">{audioBuffer ? formatTime(audioBuffer.duration) : 'Loading...'}</p>
                     </div>
                 </div>
                 <button 
                    onClick={() => {
                        stopPlayback();
                        setFile(null);
                        setAudioBuffer(null);
                        setTrimmedBlob(null);
                        setWaveformPeaks(null);
                    }}
                    className="text-sm text-red-500 hover:text-red-700 font-medium"
                 >
                     Change File
                 </button>
             </div>

             <div className="p-6">
                 {audioBuffer ? (
                     <div className="space-y-6">
                         {/* Visualization */}
                         <div 
                            ref={containerRef}
                            className={`relative h-[120px] bg-gray-100 rounded-lg overflow-hidden border border-gray-300 shadow-inner touch-none
                                ${hoverTarget ? 'cursor-col-resize' : 'cursor-text'}
                            `}
                            onMouseDown={handlePointerDown}
                            onTouchStart={handlePointerDown}
                            onMouseMove={handleHoverMove}
                         >
                             <canvas ref={canvasRef} className="w-full h-full block" />
                         </div>

                         {/* Controls */}
                         <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
                             <div className="flex items-center gap-4">
                                 <button
                                    onClick={togglePlayback}
                                    className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-md transition-transform hover:scale-105"
                                 >
                                     {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
                                 </button>
                                 <div className="text-center">
                                     <span className="block text-xs text-gray-500 font-medium uppercase tracking-wider">Current</span>
                                     <span className="font-mono text-lg font-bold text-gray-800">{formatTime(currentTime)}</span>
                                 </div>
                             </div>

                             <div className="flex items-center gap-4 bg-gray-50 p-3 rounded-xl border border-gray-200">
                                 <div className="text-center">
                                     <label className="block text-xs text-gray-500 font-medium uppercase tracking-wider mb-1 text-blue-600">Start</label>
                                     <input 
                                        type="number"
                                        step="0.1"
                                        value={startTime.toFixed(2)}
                                        onChange={(e) => {
                                            const val = Math.max(0, Math.min(Number(e.target.value), endTime));
                                            setStartTime(val);
                                            setCurrentTime(val);
                                        }}
                                        className="w-20 text-center border border-gray-300 rounded-md p-1 font-mono text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                     />
                                 </div>
                                 <span className="text-gray-300">→</span>
                                 <div className="text-center">
                                     <label className="block text-xs text-gray-500 font-medium uppercase tracking-wider mb-1 text-blue-600">End</label>
                                     <input 
                                        type="number"
                                        step="0.1"
                                        value={endTime.toFixed(2)}
                                        onChange={(e) => {
                                            const val = Math.min(audioBuffer.duration, Math.max(Number(e.target.value), startTime));
                                            setEndTime(val);
                                        }}
                                        className="w-20 text-center border border-gray-300 rounded-md p-1 font-mono text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                     />
                                 </div>
                                 <div className="text-center pl-4 border-l border-gray-200 hidden sm:block">
                                     <label className="block text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Duration</label>
                                     <span className="font-mono text-sm font-bold text-gray-700">
                                         {formatTime(endTime - startTime)}
                                     </span>
                                 </div>
                             </div>

                             <div>
                                 {trimmedBlob ? (
                                     <button
                                        onClick={handleDownload}
                                        className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow-md transition-colors flex items-center animate-in zoom-in"
                                     >
                                         <Download className="w-5 h-5 mr-2" /> Download
                                     </button>
                                 ) : (
                                     <button
                                        onClick={handleTrim}
                                        disabled={isProcessing}
                                        className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-md transition-colors flex items-center"
                                     >
                                         {isProcessing ? <RefreshCw className="w-5 h-5 mr-2 animate-spin" /> : <Scissors className="w-5 h-5 mr-2" />}
                                         Trim Audio
                                     </button>
                                 )}
                             </div>
                         </div>
                     </div>
                 ) : (
                     <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                         <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mb-4"></div>
                         <p>Loading waveform...</p>
                     </div>
                 )}
                 
                 {error && (
                    <div className="mt-6 p-4 bg-red-50 text-red-700 rounded-lg text-sm flex items-center animate-in fade-in">
                        <AlertCircle className="w-5 h-5 mr-2" /> {error}
                    </div>
                 )}
             </div>
         </div>
      )}
    </div>
  );
};
